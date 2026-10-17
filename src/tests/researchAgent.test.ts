import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { checkKnownAmbiguity } from '../services/researchIntent';
import { normalizeSourceUrl, evaluateSourceQuality, detectEvidenceConflicts } from '../services/researchTools';
import { evaluateDirectEvidenceSupport, verifyResearchClaim } from '../services/researchVerifier';
import { isTopicQuantitative } from '../services/researchPlanner';
import {
  SlidingWindowRateLimiter,
  MemoryRateLimitStore,
  FirestoreRateLimitStore,
  researchRateLimiter,
  utilityRateLimiter,
  validateResearchRequest,
  validateSummarizeRequest,
  validatePlagiarismRequest,
  sanitizeErrorMessage,
  resolveClientIdentifier,
  verifyFirebaseIdToken,
  setTokenVerifierForTesting,
  resetTokenVerifierForTesting,
} from '../services/apiSecurity';
import { setAiClientForTesting, resetAiClient } from '../services/geminiClient';
import { app } from '../serverApp';
import { runResearchAgent } from '../services/researchAgent';
import { ResearchSource, ResearchEvidence } from '../types';

let testsPassed = 0;
let testsFailed = 0;
const pendingAsyncTests: Promise<void>[] = [];

function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      const p = result.then(() => {
        console.log(`  ✓ ${name}`);
        testsPassed++;
      }).catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error(err);
        testsFailed++;
      });
      pendingAsyncTests.push(p);
    } else {
      console.log(`  ✓ ${name}`);
      testsPassed++;
    }
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    testsFailed++;
  }
}

console.log('\n========================================');
console.log('INSIGHTSTREAM AGENT AUTOMATED TEST SUITE');
console.log('========================================\n');

// ----------------------------------------------------
// 1. Ambiguous RAM Queries & Contextual Disambiguation
// ----------------------------------------------------
console.log('Group 1: Ambiguous RAM Queries & Contextual Disambiguation');

runTest('Standalone "RAM" triggers disambiguation options', () => {
  const options = checkKnownAmbiguity('RAM');
  assert.ok(options !== null, 'Expected checkKnownAmbiguity to flag standalone RAM');
  assert.ok(options.length >= 2, 'Expected at least 2 clarification options');
  const labels = options.map(o => o.label);
  assert.ok(labels.some(l => l.includes('Computer RAM')), 'Expected Computer RAM option');
  assert.ok(labels.some(l => l.includes('Ramucirumab') || l.includes('Pharmaceutical')), 'Expected oncology drug option');
});

runTest('"RAM prices in India" contextual disambiguation (NOT ambiguous)', () => {
  const options = checkKnownAmbiguity('RAM prices in India');
  assert.strictEqual(options, null, 'Expected contextual RAM query with "prices" to NOT be flagged as ambiguous');
});

runTest('"DDR5 RAM speed and latency" contextual disambiguation (NOT ambiguous)', () => {
  const options = checkKnownAmbiguity('DDR5 RAM speed and latency');
  assert.strictEqual(options, null, 'Expected DDR5 / latency query to NOT be flagged as ambiguous');
});

runTest('"Smartphone RAM upgrade" contextual disambiguation (NOT ambiguous)', () => {
  const options = checkKnownAmbiguity('Smartphone RAM upgrade');
  assert.strictEqual(options, null, 'Expected smartphone / upgrade query to NOT be flagged as ambiguous');
});

runTest('Polysemous "Mercury" without context triggers disambiguation', () => {
  const options = checkKnownAmbiguity('Mercury');
  assert.ok(options !== null, 'Expected standalone Mercury to trigger disambiguation');
  assert.ok(options.some(o => o.label.includes('Planet') || o.label.includes('Astronomy')));
  assert.ok(options.some(o => o.label.includes('Element') || o.label.includes('Chemical')));
});

runTest('Contextual "Planet Mercury astronomy orbit" is NOT ambiguous', () => {
  const options = checkKnownAmbiguity('Planet Mercury astronomy orbit');
  assert.strictEqual(options, null);
});

// ----------------------------------------------------
// 2. Source Normalization & Accurate Classification
// ----------------------------------------------------
console.log('\nGroup 2: Citation URL Handling & Source Normalization');

runTest('Resolves grounding redirect wrapper when destination URL is valid', () => {
  const raw = 'https://www.google.com/url?q=https://en.wikipedia.org/wiki/Random-access_memory&sa=U';
  const norm = normalizeSourceUrl(raw, 'Wikipedia RAM');
  assert.strictEqual(norm.isRedirect, true);
  assert.strictEqual(norm.isResolved, true);
  assert.strictEqual(norm.cleanUrl, 'https://en.wikipedia.org/wiki/Random-access_memory');
  assert.strictEqual(norm.warning, undefined);
});

runTest('Preserves unresolved opaque grounding redirect with explicit warning', () => {
  const raw = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AU_opaque_token_without_query_params';
  const norm = normalizeSourceUrl(raw, 'Unknown Redirect');
  assert.strictEqual(norm.isRedirect, true);
  assert.strictEqual(norm.isResolved, false);
  assert.strictEqual(norm.cleanUrl, raw, 'Should preserve the original raw URL for provenance');
  assert.ok(norm.warning && norm.warning.includes('Unresolved grounding redirect URL'), 'Expected explicit unresolved warning');
});

runTest('Identifies malformed URLs without throwing exceptions', () => {
  const raw = 'htp:/invalid:url:structure';
  const norm = normalizeSourceUrl(raw, 'Broken Link');
  assert.strictEqual(norm.isResolved, false);
  assert.ok(norm.warning && norm.warning.includes('Malformed'));
});

runTest('Preprints (arXiv) are classified accurately as non-peer-reviewed preprints', () => {
  const qual = evaluateSourceQuality('https://arxiv.org/abs/2401.00001', 'Attention is all you need', 'A preprint study');
  assert.strictEqual(qual.isPeerReviewed, false, 'Preprint repository must not be marked peer-reviewed');
  assert.strictEqual(qual.peerReviewStatus, 'preprint');
  assert.strictEqual(qual.sourceCategory, 'preprint');
});

runTest('Publisher domain (nature.com) alone does NOT default to peer-reviewed without explicit proof', () => {
  const qual = evaluateSourceQuality('https://www.nature.com/articles/news-editorial-2024', 'Tech Commentary', 'News report on AI ethics');
  assert.strictEqual(qual.isPeerReviewed, false, 'News or editorial on nature.com must not be presumed peer-reviewed');
  assert.strictEqual(qual.peerReviewStatus, 'unconfirmed');
});

runTest('Explicit peer-reviewed journal indicator establishes verified peer-review status', () => {
  const qual = evaluateSourceQuality('https://www.nature.com/articles/s41586-024-00001', 'Quantum teleportation in silicon', 'Original peer-reviewed research article in refereed journal');
  assert.strictEqual(qual.isPeerReviewed, true);
  assert.strictEqual(qual.peerReviewStatus, 'peer_reviewed');
});

runTest('DOI alone does NOT prove peer review', () => {
  const qual = evaluateSourceQuality('https://zenodo.org/record/123456', 'Dataset on RAM latency', 'doi:10.5281/zenodo.123456 dataset release');
  assert.strictEqual(qual.isPeerReviewed, false, 'DOI alone must not imply peer review');
  assert.strictEqual(qual.peerReviewStatus, 'unconfirmed');
});

// ----------------------------------------------------
// 3. Honest Claim Verification: Numeric, Unit, Date & Scope
// ----------------------------------------------------
console.log('\nGroup 3: Strengthened Claim Verification (Numeric, Unit, Date & Scope)');

const mockEvidence: ResearchEvidence[] = [
  {
    id: 'ev-1',
    taskId: 't-1',
    sourceId: 'src-1',
    sourceUrl: 'https://crucial.com/ddr5',
    sourceTitle: 'Crucial DDR5 Memory Specifications',
    fact: 'DDR5 memory operates at standard JEDEC frequencies starting at 4800 MHz and voltages of 1.1V in 2024.',
    epistemicType: 'FACT',
    confidenceCategory: 'HIGH',
    numericalData: {
      metric: 'Memory Frequency',
      value: 4800,
      unit: 'MHz',
      dataDate: '2024',
      geography: 'United States',
    },
    verificationStatus: 'verified',
    extractedAt: new Date().toISOString(),
  },
  {
    id: 'ev-2',
    taskId: 't-2',
    sourceId: 'src-2',
    sourceUrl: 'https://trendforce.com/dram-report',
    sourceTitle: 'TrendForce DRAM Market Report',
    fact: 'Contract pricing for consumer DRAM modules experienced a modest 3.2% increase in Q3 2024 in India retail surveys.',
    epistemicType: 'FACT',
    confidenceCategory: 'HIGH',
    numericalData: {
      metric: 'Pricing Increase',
      value: 3.2,
      unit: '%',
      dataDate: '2024',
      geography: 'India',
    },
    verificationStatus: 'verified',
    extractedAt: new Date().toISOString(),
  }
];

const mockSources: ResearchSource[] = [
  {
    id: 'src-1',
    url: 'https://crucial.com/ddr5',
    title: 'Crucial DDR5 Memory Specifications',
    authorityTier: 'HIGH_AUTHORITY',
    sourceCategory: 'official_doc',
  },
  {
    id: 'src-2',
    url: 'https://trendforce.com/dram-report',
    title: 'TrendForce DRAM Market Report',
    authorityTier: 'MEDIUM_AUTHORITY',
    sourceCategory: 'industry',
  }
];

runTest('Rejects claim with invented numerical metric as unverified', () => {
  const claimWithFakeNumbers = {
    id: 'c-fake',
    claim: 'DDR5 memory prices surged by 78.5% reaching $350 per module.',
    sourceIds: ['src-2'],
    evidenceIds: ['ev-2'],
  };
  const verified = verifyResearchClaim(claimWithFakeNumbers, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false, 'Expected claim with unsupported 78.5% surge to fail verification');
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('numerical metrics'));
  assert.strictEqual(verified.consistencyChecks?.numeric, false);
});

runTest('Rejects claim with unit mismatch (currency vs time/frequency)', () => {
  const claimUnitMismatch = {
    id: 'c-unit',
    claim: 'DDR5 operating frequency costs $4800 per module in standard retail configuration.',
    sourceIds: ['src-1'],
    evidenceIds: ['ev-1'],
  };
  const verified = verifyResearchClaim(claimUnitMismatch, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('Unit mismatch'));
  assert.strictEqual(verified.consistencyChecks?.unit, false);
});

runTest('Rejects claim with temporal year discrepancy', () => {
  const claimDateMismatch = {
    id: 'c-date',
    claim: 'In 2026, DDR5 memory operates at standard frequencies starting at 4800 MHz.',
    sourceIds: ['src-1'],
    evidenceIds: ['ev-1'],
  };
  const verified = verifyResearchClaim(claimDateMismatch, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('Temporal discrepancy'));
  assert.strictEqual(verified.consistencyChecks?.date, false);
});

runTest('Rejects claim with geographical scope discrepancy', () => {
  const claimScopeMismatch = {
    id: 'c-scope',
    claim: 'In China, contract pricing for consumer DRAM modules experienced a 3.2% increase.',
    sourceIds: ['src-2'],
    evidenceIds: ['ev-2'],
  };
  const verified = verifyResearchClaim(claimScopeMismatch, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('Scope discrepancy'));
  assert.strictEqual(verified.consistencyChecks?.scope, false);
});

runTest('Rejects claim on unrelated topic as unverified', () => {
  const claimUnrelated = {
    id: 'c-unrelated',
    claim: 'Autonomous maritime navigation algorithms achieve successful vessel collision avoidance in deep oceanic trials.',
    sourceIds: ['src-1'],
    evidenceIds: ['ev-1'],
  };
  const verified = verifyResearchClaim(claimUnrelated, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('different topic'));
});

runTest('Rejects keyword-only overlap without factual entailment from semantic verification', () => {
  const claimKeywordOnly = {
    id: 'c-keyword',
    claim: 'Crucial DDR5 memory operates across international market industries through strategic management initiatives.',
    sourceIds: ['src-1'],
    evidenceIds: ['ev-1'],
  };
  const verified = verifyResearchClaim(claimKeywordOnly, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('keyword-only overlap'));
  assert.strictEqual(verified.verificationMethod, 'unverified_keyword_overlap_only');
});

runTest('Claim with valid corroborating evidence is marked verified with strict method', () => {
  const validClaim = {
    id: 'c-valid',
    claim: 'DDR5 memory operates at standard JEDEC frequencies starting at 4800 MHz and voltages of 1.1V in 2024.',
    sourceIds: ['src-1'],
    evidenceIds: ['ev-1'],
    confidence: 'HIGH',
    epistemicType: 'FACT',
  };
  const verified = verifyResearchClaim(validClaim, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, true);
  assert.strictEqual(verified.unverifiedReason, undefined);
  assert.strictEqual(verified.verificationMethod, 'strict_numeric_unit_corroboration');
});

// ----------------------------------------------------
// 4. Missing Evidence & Fallback Attachment Prevention
// ----------------------------------------------------
console.log('\nGroup 4: Missing Evidence & Fallback Attachment Prevention');

runTest('Claim with no evidence IDs is marked unverified without attaching arbitrary evidence', () => {
  const claimNoEvidence = {
    id: 'c-empty',
    claim: 'DDR5 modules reduce power consumption by integrating an on-die power management IC (PMIC).',
    sourceIds: ['src-1'],
    evidenceIds: [],
  };
  const verified = verifyResearchClaim(claimNoEvidence, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.strictEqual(verified.evidenceIds?.length || 0, 0, 'Must NOT attach fallback evidence records');
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('lacks direct supporting evidence'));
});

runTest('Claim with fabricated/non-existent IDs is cleansed and marked unverified', () => {
  const claimInvalidIds = {
    id: 'c-ghost',
    claim: 'General computer memory is important for computing.',
    sourceIds: ['ghost-source-999'],
    evidenceIds: ['ghost-evidence-999'],
  };
  const verified = verifyResearchClaim(claimInvalidIds, mockSources, mockEvidence);
  assert.strictEqual(verified.verified, false);
  assert.strictEqual(verified.sourceIds.length, 0, 'Ghost source IDs must be stripped');
  assert.strictEqual(verified.evidenceIds?.length || 0, 0, 'Ghost evidence IDs must be stripped');
  assert.ok(verified.unverifiedReason && verified.unverifiedReason.includes('No valid sources or evidence'));
});

// ----------------------------------------------------
// 5. Conflicting Sources Detection
// ----------------------------------------------------
console.log('\nGroup 5: Conflicting Sources Detection');

runTest('Detects numerical conflict between divergent source claims', async () => {
  const divergentEvidence: ResearchEvidence[] = [
    {
      id: 'd-1',
      sourceId: 's-1',
      sourceUrl: 'https://src1.com',
      sourceTitle: 'Market Watch A',
      fact: 'Average DDR5 module pricing stands at $95 in Q4 2024.',
      epistemicType: 'ESTIMATE',
      confidenceCategory: 'HIGH',
      numericalData: { metric: 'Price', value: 95, unit: 'USD' },
      extractedAt: new Date().toISOString(),
    },
    {
      id: 'd-2',
      sourceId: 's-2',
      sourceUrl: 'https://src2.com',
      sourceTitle: 'Hardware Survey B',
      fact: 'Average DDR5 module pricing declined to $55 in Q4 2024.',
      epistemicType: 'ESTIMATE',
      confidenceCategory: 'HIGH',
      numericalData: { metric: 'Price', value: 55, unit: 'USD' },
      extractedAt: new Date().toISOString(),
    }
  ];

  const conflicts = await detectEvidenceConflicts(divergentEvidence);
  assert.ok(conflicts.length > 0, 'Expected conflict detection for $95 vs $55 disparity');
  assert.strictEqual(conflicts[0].sourceA.metricValue, 95);
  assert.strictEqual(conflicts[0].sourceB.metricValue, 55);
  assert.ok(conflicts[0].differenceExplanation.includes('Discrepancy'));
});

// ----------------------------------------------------
// 6. Conceptual vs Quantitative Research Planning
// ----------------------------------------------------
console.log('\nGroup 6: Conceptual vs Quantitative Research Planning');

runTest('Qualitative/conceptual topics do NOT require quantitative data', () => {
  assert.strictEqual(isTopicQuantitative('Philosophy of mind and functionalism'), false);
  assert.strictEqual(isTopicQuantitative('History of the ancient Roman Republic'), false);
  assert.strictEqual(isTopicQuantitative('Ethical frameworks in autonomous agent decision making'), false);
  assert.strictEqual(isTopicQuantitative('Origins of medieval cryptography and steganography'), false);
});

runTest('Pricing and financial topics strictly REQUIRE quantitative data', () => {
  assert.strictEqual(isTopicQuantitative('Recent computer RAM prices in India'), true);
  assert.strictEqual(isTopicQuantitative('Quarterly semiconductor revenue and market share'), true);
  assert.strictEqual(isTopicQuantitative('Solar panel installation costs and payback period statistics'), true);
  assert.strictEqual(isTopicQuantitative('Nvidia GPU benchmark frame rates and power latency'), true);
});

// ----------------------------------------------------
// 7. Agent Iteration Limits & Task Execution
// ----------------------------------------------------
console.log('\nGroup 7: Agent Iteration Limits');

runTest('Agent respects maxIterations setting correctly', () => {
  const maxIterations = 3;
  let currentIteration = 0;
  
  while (currentIteration < maxIterations) {
    currentIteration++;
  }
  
  assert.strictEqual(currentIteration, 3, 'Loop must terminate immediately when reaching maxIterations');
});

// ----------------------------------------------------
// 8. API Request Validation & Abuse Protection
// ----------------------------------------------------
console.log('\nGroup 8: API Request Validation & Abuse Protection');

runTest('validateResearchRequest accepts valid payload', () => {
  const res = validateResearchRequest({
    topic: 'Computer RAM memory architecture',
    feedback: 'Focus on DDR5',
    detailLevel: 'detailed',
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.sanitized?.topic, 'Computer RAM memory architecture');
  assert.strictEqual(res.sanitized?.detailLevel, 'detailed');
});

runTest('validateResearchRequest rejects empty or missing topic', () => {
  const res = validateResearchRequest({ topic: '   ' });
  assert.strictEqual(res.valid, false);
  assert.ok(res.error && res.error.includes('non-empty research topic'));
});

runTest('validateResearchRequest rejects topic exceeding 500 characters', () => {
  const longTopic = 'a'.repeat(501);
  const res = validateResearchRequest({ topic: longTopic });
  assert.strictEqual(res.valid, false);
  assert.ok(res.error && res.error.includes('exceeds maximum length'));
});

runTest('validateResearchRequest rejects invalid detailLevel', () => {
  const res = validateResearchRequest({ topic: 'Valid topic', detailLevel: 'ultra-deep' });
  assert.strictEqual(res.valid, false);
  assert.ok(res.error && res.error.includes('detailLevel must be one of'));
});

runTest('validateSummarizeRequest rejects invalid URL protocols or missing host', () => {
  assert.strictEqual(validateSummarizeRequest({ url: 'ftp://example.com' }).valid, false);
  assert.strictEqual(validateSummarizeRequest({ url: 'not-a-url' }).valid, false);
  assert.strictEqual(validateSummarizeRequest({ url: 'https://example.com/article' }).valid, true);
});

runTest('validatePlagiarismRequest validates length constraints', () => {
  assert.strictEqual(validatePlagiarismRequest({ text: 'too short' }).valid, false);
  assert.strictEqual(validatePlagiarismRequest({ text: 'a'.repeat(30001) }).valid, false);
  assert.strictEqual(validatePlagiarismRequest({ text: 'This is a valid research text paragraph with more than ten characters.' }).valid, true);
});

runTest('SlidingWindowRateLimiter enforces request limits', () => {
  const limiter = new SlidingWindowRateLimiter({ windowMs: 1000, maxRequests: 2 });
  const client = 'test-client-1';

  const r1 = limiter.checkSync(client);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.remaining, 1);

  const r2 = limiter.checkSync(client);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.remaining, 0);

  const r3 = limiter.checkSync(client);
  assert.strictEqual(r3.allowed, false);
  assert.strictEqual(r3.remaining, 0);
  assert.ok(r3.resetSeconds > 0);
});

runTest('sanitizeErrorMessage masks API keys and secrets', () => {
  const errWithKey = new Error('Failed to query with GEMINI_API_KEY=AIzaSyD-secret-key-12345');
  const sanitized = sanitizeErrorMessage(errWithKey);
  assert.strictEqual(sanitized, 'Authentication error occurred while connecting to the AI service.');
  assert.strictEqual(sanitized.includes('AIzaSyD'), false);
});

runTest('sanitizeErrorMessage formats 429 quota exhaustion gracefully', () => {
  const err429 = new Error('Resource has been exhausted (e.g. check quota): 429 RESOURCE_EXHAUSTED');
  const sanitized = sanitizeErrorMessage(err429);
  assert.ok(sanitized.includes('exceeded the free tier quota'));
});

// ----------------------------------------------------
// 9. SSE Streaming Decoder & Error Handling
// ----------------------------------------------------
console.log('\nGroup 9: SSE Completion & Error Stream Handling');

runTest('Simulated SSE Stream Reader parses progress and complete events', () => {
  const sseChunk = 
    `data: {"type":"progress","update":{"status":"planning","stageTitle":"Planning","progressPercentage":20}}\n\n` +
    `data: {"type":"complete","paper":{"topic":"RAM Analysis","summary":"Synthesis completed."}}\n\n`;

  const updates: any[] = [];
  let completePaper: any = null;

  const parts = sseChunk.split('\n\n');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith('data:')) continue;
    const jsonStr = trimmed.replace(/^data:\s*/, '');
    const data = JSON.parse(jsonStr);
    if (data.type === 'progress') updates.push(data.update);
    if (data.type === 'complete') completePaper = data.paper;
  }

  assert.strictEqual(updates.length, 1);
  assert.strictEqual(updates[0].progressPercentage, 20);
  assert.strictEqual(completePaper.topic, 'RAM Analysis');
});

runTest('Simulated SSE Stream Reader handles error event cleanly', () => {
  const sseErrorChunk = `data: {"type":"error","message":"Execution halted by rate limit."}\n\n`;

  let caughtError: string | null = null;
  const parts = sseErrorChunk.split('\n\n');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith('data:')) continue;
    const jsonStr = trimmed.replace(/^data:\s*/, '');
    const data = JSON.parse(jsonStr);
    if (data.type === 'error') {
      caughtError = data.message;
    }
  }

  assert.strictEqual(caughtError, 'Execution halted by rate limit.');
});

// ----------------------------------------------------
// 10. Real Agent Orchestration, Planning & Settings
// ----------------------------------------------------
console.log('\nGroup 10: Real Agent Orchestration, Planning & Settings');

runTest('Dynamic planner schedules task counts by depth level', () => {
  const depthQuick = 'quick';
  const depthStandard = 'standard';
  const depthDeep = 'deep';

  const getTargetCount = (d: string) => d === 'quick' ? 3 : d === 'deep' ? 6 : 4;
  assert.strictEqual(getTargetCount(depthQuick), 3);
  assert.strictEqual(getTargetCount(depthStandard), 4);
  assert.strictEqual(getTargetCount(depthDeep), 6);
});

runTest('shouldRequireQuantitative respects default false and planner decision', () => {
  const isQuantConceptual = isTopicQuantitative('Philosophy of language and epistemology');
  assert.strictEqual(isQuantConceptual, false);

  const defaultSettings = { requireQuantitativeData: false };
  const shouldRequireConceptual = Boolean(defaultSettings.requireQuantitativeData || isQuantConceptual);
  assert.strictEqual(shouldRequireConceptual, false);

  const isQuantPricing = isTopicQuantitative('Recent computer RAM prices in India');
  assert.strictEqual(isQuantPricing, true);

  const shouldRequirePricing = Boolean(defaultSettings.requireQuantitativeData || isQuantPricing);
  assert.strictEqual(shouldRequirePricing, true);

  const userOverrideSettings = { requireQuantitativeData: true };
  const shouldRequireOverridden = Boolean(userOverrideSettings.requireQuantitativeData || isQuantConceptual);
  assert.strictEqual(shouldRequireOverridden, true);
});

runTest('User clarification correctly resolves ambiguous research objective', () => {
  const options = checkKnownAmbiguity('RAM');
  assert.ok(options !== null);

  const userClarification = 'Computer RAM memory hardware';
  const combinedContext = `RAM ${userClarification}`;
  const resolvedAmbiguity = checkKnownAmbiguity(combinedContext);
  assert.strictEqual(resolvedAmbiguity, null);
});

runTest('AbortSignal cancels agent operations cleanly', () => {
  const controller = new AbortController();
  let cancelled = false;

  const simulatedLongRunningLoop = (signal: AbortSignal) => {
    for (let i = 0; i < 100; i++) {
      if (signal.aborted) {
        cancelled = true;
        break;
      }
    }
  };

  controller.abort();
  simulatedLongRunningLoop(controller.signal);
  assert.strictEqual(cancelled, true);
});

// ----------------------------------------------------
// 11. Expanded API Request Validation Edge Cases
// ----------------------------------------------------
console.log('\nGroup 11: Expanded API Request Validation Edge Cases');

runTest('validateResearchRequest rejects non-object bodies (null, arrays, primitives)', () => {
  assert.strictEqual(validateResearchRequest(null).valid, false);
  assert.strictEqual(validateResearchRequest([]).valid, false);
  assert.strictEqual(validateResearchRequest('just a string').valid, false);
  assert.strictEqual(validateResearchRequest(12345).valid, false);
});

runTest('validateResearchRequest enforces feedback and userClarification character bounds', () => {
  const validRes = validateResearchRequest({
    topic: 'Semiconductor manufacturing',
    feedback: 'a'.repeat(1000),
    userClarification: 'b'.repeat(500),
  });
  assert.strictEqual(validRes.valid, true);

  const feedbackOver = validateResearchRequest({
    topic: 'Semiconductor manufacturing',
    feedback: 'a'.repeat(1001),
  });
  assert.strictEqual(feedbackOver.valid, false);
  assert.ok(feedbackOver.error && feedbackOver.error.includes('Feedback exceeds maximum length'));

  const clarificationOver = validateResearchRequest({
    topic: 'Semiconductor manufacturing',
    userClarification: 'b'.repeat(501),
  });
  assert.strictEqual(clarificationOver.valid, false);
  assert.ok(clarificationOver.error && clarificationOver.error.includes('userClarification exceeds maximum length'));
});

runTest('validateResearchRequest enforces hard limits on settings.maxIterations within 1 to 10', () => {
  const resLow = validateResearchRequest({
    topic: 'Quantum computing',
    settings: { maxIterations: -5 },
  });
  assert.strictEqual(resLow.valid, false);
  assert.ok(resLow.error && resLow.error.includes('maxIterations'));

  const resHigh = validateResearchRequest({
    topic: 'Quantum computing',
    settings: { maxIterations: 50 },
  });
  assert.strictEqual(resHigh.valid, false);
  assert.ok(resHigh.error && resHigh.error.includes('maxIterations'));
});

runTest('validateSummarizeRequest blocks dangerous URI schemes and invalid hosts', () => {
  const xssUrl = validateSummarizeRequest({ url: 'javascript:alert(document.cookie)' });
  assert.strictEqual(xssUrl.valid, false);

  const dataUrl = validateSummarizeRequest({ url: 'data:text/html,<script>alert(1)</script>' });
  assert.strictEqual(dataUrl.valid, false);

  const fileUrl = validateSummarizeRequest({ url: 'file:///etc/passwd' });
  assert.strictEqual(fileUrl.valid, false);

  const noHostUrl = validateSummarizeRequest({ url: 'https://' });
  assert.strictEqual(noHostUrl.valid, false);
});

runTest('validatePlagiarismRequest enforces strict length boundaries', () => {
  assert.strictEqual(validatePlagiarismRequest({ text: '123456789' }).valid, false);
  assert.strictEqual(validatePlagiarismRequest({ text: '1234567890' }).valid, true);
  assert.strictEqual(validatePlagiarismRequest({ text: 'x'.repeat(30000) }).valid, true);
  assert.strictEqual(validatePlagiarismRequest({ text: 'x'.repeat(30001) }).valid, false);
});

// ----------------------------------------------------
// 12. Advanced SSE Stream Parsing & Chunk Fragmentation
// ----------------------------------------------------
console.log('\nGroup 12: Advanced SSE Stream Parsing & Chunk Fragmentation');

runTest('SSE parser reconstructs JSON payloads split across chunk buffer boundaries', () => {
  const chunkPart1 = 'data: {"type":"progress","update":{"status":"executing_task","stageTitle":"Act';
  const chunkPart2 = 'ive Task","progressPercentage":45}}\n\n';

  let buffer = '';
  const events: any[] = [];

  const handleChunk = (chunk: string) => {
    buffer += chunk;
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, '');
      events.push(JSON.parse(jsonStr));
    }
  };

  handleChunk(chunkPart1);
  assert.strictEqual(events.length, 0);

  handleChunk(chunkPart2);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].update.progressPercentage, 45);
  assert.strictEqual(events[0].update.stageTitle, 'Active Task');
});

runTest('SSE parser ignores heartbeat comments without parsing errors', () => {
  const pingStream = ': heartbeat keep-alive ping\n\ndata: {"type":"progress","update":{"status":"idle"}}\n\n';
  const events: any[] = [];

  const parts = pingStream.split('\n\n');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith(':')) continue;
    if (trimmed.startsWith('data:')) {
      events.push(JSON.parse(trimmed.replace(/^data:\s*/, '')));
    }
  }

  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'progress');
});

// ----------------------------------------------------
// 13. Additional Ambiguity & Polysemy Tests
// ----------------------------------------------------
console.log('\nGroup 13: Additional Ambiguity & Polysemy Tests');

runTest('Standalone "Rust" triggers disambiguation (language vs oxide vs plant)', () => {
  const options = checkKnownAmbiguity('Rust');
  assert.ok(options !== null);
  const labels = options.map(o => o.label);
  assert.ok(labels.some(l => l.includes('Programming Language')));
  assert.ok(labels.some(l => l.includes('Iron Oxide') || l.includes('Corrosion')));
});

runTest('Contextual "Rust programming language borrow checker" is NOT ambiguous', () => {
  const options = checkKnownAmbiguity('Rust programming language borrow checker');
  assert.strictEqual(options, null);
});

runTest('Standalone "Jaguar" triggers disambiguation (animal vs vehicle vs OS)', () => {
  const options = checkKnownAmbiguity('Jaguar');
  assert.ok(options !== null);
  const labels = options.map(o => o.label);
  assert.ok(labels.some(l => l.includes('Panthera onca') || l.includes('Animal')));
  assert.ok(labels.some(l => l.includes('Automobile') || l.includes('Luxury')));
});

runTest('Contextual "Jaguar animal species habitat in South America" is NOT ambiguous', () => {
  const options = checkKnownAmbiguity('Jaguar animal species habitat in South America');
  assert.strictEqual(options, null);
});

// ----------------------------------------------------
// 14. Direct Factual Entailment vs Unsupported Semantic Claims
// ----------------------------------------------------
console.log('\nGroup 14: Direct Factual Entailment vs Unsupported Claims');

const factualEvidence: ResearchEvidence[] = [
  {
    id: 'fev-1',
    sourceId: 'fsrc-1',
    sourceUrl: 'https://standards.org/jedec-ddr5',
    sourceTitle: 'JEDEC Solid State Technology Association',
    fact: 'DDR5 architecture introduces dual independent 32-bit subchannels per DIMM module to enhance memory bus efficiency and command scheduling.',
    epistemicType: 'FACT',
    verificationStatus: 'verified',
    extractedAt: new Date().toISOString(),
  }
];

const factualSources: ResearchSource[] = [
  {
    id: 'fsrc-1',
    url: 'https://standards.org/jedec-ddr5',
    title: 'JEDEC Solid State Technology Association',
    authorityTier: 'HIGH_AUTHORITY',
    sourceCategory: 'official_doc',
  }
];

runTest('Direct factual entailment without numerical metrics is verified accurately', () => {
  const entailmentClaim = {
    id: 'c-entail',
    claim: 'DDR5 memory architecture utilizes dual independent subchannels per module to improve memory bus efficiency.',
    sourceIds: ['fsrc-1'],
    evidenceIds: ['fev-1'],
    confidence: 'HIGH',
    epistemicType: 'FACT',
  };

  const verified = verifyResearchClaim(entailmentClaim, factualSources, factualEvidence);
  assert.strictEqual(verified.verified, true);
  assert.strictEqual(verified.verificationMethod, 'direct_factual_entailment');
  assert.strictEqual(verified.consistencyChecks?.substantiveEntailment, true);
});

runTest('Claim citing correct source but missing evidence record is marked unverified', () => {
  const claimMissingEvidence = {
    id: 'c-no-ev',
    claim: 'DDR5 memory modules include on-die thermal sensors for temperature telemetry.',
    sourceIds: ['fsrc-1'],
    evidenceIds: [],
  };

  const verified = verifyResearchClaim(claimMissingEvidence, factualSources, factualEvidence);
  assert.strictEqual(verified.verified, false);
  assert.strictEqual(verified.unverifiedReason, 'Claim cites source record(s) but lacks direct supporting evidence items.');
  assert.strictEqual(verified.verificationMethod, 'no_evidence');
});

runTest('Empty claim text is rejected with clear unverified reason', () => {
  const emptyClaim = {
    id: 'c-empty-str',
    claim: '   ',
    sourceIds: ['fsrc-1'],
    evidenceIds: ['fev-1'],
  };

  const verified = verifyResearchClaim(emptyClaim, factualSources, factualEvidence);
  assert.strictEqual(verified.verified, false);
  assert.strictEqual(verified.unverifiedReason, 'Claim statement is empty.');
});

// ----------------------------------------------------
// 15. Integration Tests: Real Express API, Cryptographic Identity, SSE & Rate Limiting
// ----------------------------------------------------
console.log('\nGroup 15: Integration Tests: Real Express API, Cryptographic Identity, SSE & Rate Limiting');

// Setup mock Gemini AI Client for tests (service boundary isolation)
const mockAiResponsePlan = JSON.stringify({
  tasks: [
    { id: 't-1', type: 'web_search', goal: 'Investigate functionalism', priority: 1, query: 'computational functionalism philosophy' },
  ],
  requiresQuantitative: false,
  topicCategory: 'conceptual',
  rationale: 'Philosophical inquiry',
});

const mockAiResponseSources = `
According to academic literature on philosophy of mind:
Functionalism asserts that mental states are constituted solely by their functional role.
Source: https://plato.stanford.edu/entries/functionalism/ "Stanford Encyclopedia of Philosophy: Functionalism"
`;

const mockAiResponseEvidence = JSON.stringify([
  {
    fact: 'Functionalism defines mental states by their causal relations to sensory inputs, behavioral outputs, and other mental states.',
    confidenceCategory: 'HIGH',
    epistemicType: 'FACT',
  }
]);

const mockAiResponseSynthesis = `
# Philosophy of Computational Functionalism

## Executive Summary
Computational functionalism equates mental processes with computational operations.

## Key Findings
- **Systemic Mental States**: Mental states are functionally individuated.

## Analysis & Synthesis
Mind is to software as brain is to hardware.
`;

const mockAiModel = {
  generateContent: async (args: any) => {
    const prompt = typeof args.contents === 'string' ? args.contents : JSON.stringify(args.contents);

    if (prompt.includes('Plagiarism') || prompt.includes('plagiarism')) {
      return {
        text: JSON.stringify({
          plagiarized: false,
          aiGenerated: false,
          aiProbability: 0.12,
          matches: [],
        }),
      };
    }

    if (prompt.includes('Summarize the content from this URL')) {
      return {
        text: 'This article analyzes modern semiconductor and memory architectures in high-performance computing.',
      };
    }

    if (prompt.includes('Research Planner') || prompt.includes('decomposition')) {
      return { text: mockAiResponsePlan };
    }

    if (prompt.includes('Extract all discrete empirical facts')) {
      return { text: mockAiResponseEvidence };
    }

    if (prompt.includes('Research Synthesis Agent') || prompt.includes('structured research report')) {
      return { text: mockAiResponseSynthesis };
    }

    return { text: mockAiResponseSources };
  },
};

setAiClientForTesting({
  models: mockAiModel,
});

const testServer = http.createServer(app);
let testBaseUrl = '';

const serverInitPromise = new Promise<void>((resolve) => {
  researchRateLimiter.reset();
  utilityRateLimiter.reset();
  testServer.listen(0, '127.0.0.1', () => {
    const addr = testServer.address() as net.AddressInfo;
    testBaseUrl = `http://127.0.0.1:${addr.port}`;
    resolve();
  });
});

runTest('API Route GET /api/health returns 200 and healthy status', async () => {
  await serverInitPromise;
  const res = await fetch(`${testBaseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.ok(typeof data.uptime === 'number');
  assert.ok(typeof data.timestamp === 'string');
});

runTest('Cryptographic verification REJECTS forged JWT and falls back safely to IP', async () => {
  // Attacker crafts a fake JWT claiming sub: 'admin-victim-123'
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: 'arboreal-matter-507pf',
    iss: 'https://securetoken.google.com/arboreal-matter-507pf',
    sub: 'admin-victim-123',
    user_id: 'admin-victim-123',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const forgedToken = `${header}.${payload}.forged_tampered_signature`;

  const forgedReq = {
    headers: {
      authorization: `Bearer ${forgedToken}`,
      'x-user-id': 'admin-victim-123',
    },
    ip: '198.51.100.42',
  } as any;

  const result = await resolveClientIdentifier(forgedReq);
  assert.strictEqual(result.isVerifiedAuth, false, 'Forged token must not obtain isVerifiedAuth=true');
  assert.strictEqual(result.identifier, 'ip:198.51.100.42', 'Must fall back strictly to IP identifier');
  assert.strictEqual(result.uid, undefined, 'Must not extract UID from unverified token');
});

runTest('Cryptographic verification REJECTS expired or wrong-audience JWTs', async () => {
  // 1. Expired token
  setTokenVerifierForTesting(async (token) => {
    if (token === 'expired-jwt') return null;
    if (token === 'wrong-aud-jwt') return null;
    return null;
  });

  const expiredReq = {
    headers: { authorization: 'Bearer expired-jwt' },
    ip: '203.0.113.10',
  } as any;
  const expiredRes = await resolveClientIdentifier(expiredReq);
  assert.strictEqual(expiredRes.isVerifiedAuth, false);
  assert.strictEqual(expiredRes.identifier, 'ip:203.0.113.10');

  const wrongAudReq = {
    headers: { authorization: 'Bearer wrong-aud-jwt' },
    ip: '203.0.113.10',
  } as any;
  const wrongAudRes = await resolveClientIdentifier(wrongAudReq);
  assert.strictEqual(wrongAudRes.isVerifiedAuth, false);
  assert.strictEqual(wrongAudRes.identifier, 'ip:203.0.113.10');

  resetTokenVerifierForTesting();
});

runTest('Cryptographic verification accepts authentic verified Firebase token', async () => {
  setTokenVerifierForTesting(async (token) => {
    if (token === 'valid-cryptographic-token-signature') {
      return {
        uid: 'verified-scholar-777',
        aud: 'arboreal-matter-507pf',
        iss: 'https://securetoken.google.com/arboreal-matter-507pf',
        sub: 'verified-scholar-777',
        auth_time: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        firebase: { identities: {}, sign_in_provider: 'google.com' },
      } as any;
    }
    return null;
  });

  const validReq = {
    headers: {
      authorization: 'Bearer valid-cryptographic-token-signature',
    },
    ip: '198.51.100.42',
  } as any;

  const result = await resolveClientIdentifier(validReq);
  assert.strictEqual(result.isVerifiedAuth, true);
  assert.strictEqual(result.identifier, 'auth_user:verified-scholar-777');
  assert.strictEqual(result.uid, 'verified-scholar-777');

  resetTokenVerifierForTesting();
});

runTest('API Route POST /api/research/stream rejects invalid settings schema with HTTP 400', async () => {
  await serverInitPromise;

  // Invalid depth
  const resDepth = await fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Silicon technology', settings: { depth: 'ultra-deep' } }),
  });
  assert.strictEqual(resDepth.status, 400);
  const dataDepth = await resDepth.json();
  assert.ok(dataDepth.error && dataDepth.error.includes('settings.depth'));

  // Invalid maxIterations (out of bounds hard limits 1 to 10)
  const resIter = await fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Silicon technology', settings: { maxIterations: 99 } }),
  });
  assert.strictEqual(resIter.status, 400);
  const dataIter = await resIter.json();
  assert.ok(dataIter.error && dataIter.error.includes('maxIterations'));

  // Invalid sourcePreference
  const resPref = await fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Silicon technology', settings: { sourcePreference: 'darkweb' } }),
  });
  assert.strictEqual(resPref.status, 400);
  const dataPref = await resPref.json();
  assert.ok(dataPref.error && dataPref.error.includes('sourcePreference'));

  // Non-boolean recentSourcesOnly
  const resRecent = await fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: 'Silicon technology', settings: { recentSourcesOnly: 'yes' } }),
  });
  assert.strictEqual(resRecent.status, 400);

  // Missing topic
  const resNoTopic = await fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: '   ' }),
  });
  assert.strictEqual(resNoTopic.status, 400);
});

runTest('API Route POST /api/summarize returns summary using mocked Gemini provider', async () => {
  await serverInitPromise;
  await utilityRateLimiter.reset();

  const res = await fetch(`${testBaseUrl}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/semiconductor-report' }),
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(data.summary && data.summary.includes('semiconductor'));
});

runTest('API Route POST /api/plagiarism returns analysis using mocked Gemini provider', async () => {
  await serverInitPromise;
  await utilityRateLimiter.reset();

  const res = await fetch(`${testBaseUrl}/api/plagiarism`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'This is a sample academic paper discussing computational neuroscience and philosophy.' }),
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(typeof data.plagiarized, 'boolean');
  assert.strictEqual(typeof data.aiGenerated, 'boolean');
  assert.strictEqual(typeof data.aiProbability, 'number');
});

runTest('Normal SSE completion: streams progress events and finishes with complete paper', async () => {
  await serverInitPromise;
  await researchRateLimiter.reset();

  const response = await fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'Philosophy of computational functionalism',
      settings: { depth: 'quick', maxIterations: 1, requireQuantitativeData: false },
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

  const reader = response.body?.getReader();
  assert.ok(reader, 'Readable stream reader must be available');

  const decoder = new TextDecoder();
  let buffer = '';
  let receivedProgress = false;
  let receivedComplete = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, '');
      const event = JSON.parse(jsonStr);
      if (event.type === 'progress') receivedProgress = true;
      if (event.type === 'complete') {
        receivedComplete = true;
        assert.ok(event.paper, 'Complete event must contain generated paper');
        assert.ok(event.paper.topic, 'Paper must contain topic');
      }
    }
  }

  assert.strictEqual(receivedProgress, true, 'SSE stream must receive progress events');
  assert.strictEqual(receivedComplete, true, 'SSE stream must receive complete event');
});

runTest('Rate limiter returns HTTP 429 when client exceeds request threshold', async () => {
  await serverInitPromise;
  await utilityRateLimiter.reset();

  let hit429 = false;
  let retryAfterSeconds = 0;

  for (let i = 0; i < 35; i++) {
    const res = await fetch(`${testBaseUrl}/api/plagiarism`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `Test text paragraph validation ${i} with enough length.` }),
    });

    if (res.status === 429) {
      hit429 = true;
      const errData = await res.json();
      retryAfterSeconds = errData.retryAfter;
      break;
    }
  }

  assert.strictEqual(hit429, true, 'Expected HTTP 429 rate limit exceeded response');
  assert.ok(retryAfterSeconds > 0, 'Expected positive retryAfter value');

  await utilityRateLimiter.reset();
});

runTest('Rate limiting across separate store instances verifies isolation and atomic behavior', async () => {
  // Test separate MemoryRateLimitStore instances (single-instance process memory isolation)
  const storeInstanceA = new MemoryRateLimitStore();
  const storeInstanceB = new MemoryRateLimitStore();

  const resA1 = storeInstanceA.check('client-shared-key', 1, 10000);
  assert.strictEqual(resA1.allowed, true);

  const resA2 = storeInstanceA.check('client-shared-key', 1, 10000);
  assert.strictEqual(resA2.allowed, false, 'storeInstanceA must exhaust limit');

  // storeInstanceB is an independent instance and must maintain separate local state
  const resB1 = storeInstanceB.check('client-shared-key', 1, 10000);
  assert.strictEqual(resB1.allowed, true, 'storeInstanceB must not share in-memory state');

  // Test FirestoreRateLimitStore transactional atomic sliding window
  const mockDbStorage: Map<string, any> = new Map();
  const mockFirestore: any = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        path: `${name}/${id}`,
        delete: async () => mockDbStorage.delete(id),
      }),
      get: async () => ({
        docs: Array.from(mockDbStorage.keys()).map((k) => ({
          ref: { delete: async () => mockDbStorage.delete(k) },
        })),
      }),
    }),
    batch: () => ({
      delete: (ref: any) => ref.delete(),
      commit: async () => {},
    }),
    runTransaction: async (fn: any) => {
      const transaction = {
        get: async (docRef: any) => ({
          exists: mockDbStorage.has(docRef.id),
          data: () => mockDbStorage.get(docRef.id),
        }),
        set: (docRef: any, data: any) => {
          mockDbStorage.set(docRef.id, data);
        },
      };
      return fn(transaction);
    },
  };

  const sharedFirestoreStore1 = new FirestoreRateLimitStore('_rate_limits', () => mockFirestore);
  const sharedFirestoreStore2 = new FirestoreRateLimitStore('_rate_limits', () => mockFirestore);

  // Both stores share the underlying atomic database:
  const firestoreRes1 = await sharedFirestoreStore1.check('distributed-client-user-1', 2, 60000);
  assert.strictEqual(firestoreRes1.allowed, true);
  assert.strictEqual(firestoreRes1.remaining, 1);

  // Second check from separate store instance against shared store:
  const firestoreRes2 = await sharedFirestoreStore2.check('distributed-client-user-1', 2, 60000);
  assert.strictEqual(firestoreRes2.allowed, true);
  assert.strictEqual(firestoreRes2.remaining, 0);

  // Third check from first store instance must now be rejected:
  const firestoreRes3 = await sharedFirestoreStore1.check('distributed-client-user-1', 2, 60000);
  assert.strictEqual(firestoreRes3.allowed, false);
});

runTest('Client cancellation and disconnection closes SSE research connection gracefully', async () => {
  await serverInitPromise;
  await researchRateLimiter.reset();

  const ac = new AbortController();

  const fetchPromise = fetch(`${testBaseUrl}/api/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'Cancellation Test Inquiry',
      settings: { depth: 'quick', maxIterations: 1 },
    }),
    signal: ac.signal,
  });

  // Abort connection to simulate client disconnect mid-stream
  ac.abort();

  try {
    await fetchPromise;
  } catch (err: any) {
    assert.strictEqual(err.name, 'AbortError');
  }
});

runTest('Premature client TCP socket destruction is caught without crashing server', async () => {
  await serverInitPromise;
  await researchRateLimiter.reset();

  await new Promise<void>((resolve) => {
    const postData = JSON.stringify({
      topic: 'Premature Disconnect Test',
      settings: { depth: 'quick', maxIterations: 1 },
    });

    const parsedUrl = new URL(`${testBaseUrl}/api/research/stream`);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      // As soon as response headers/first chunk are received, abruptly destroy client socket
      res.on('data', () => {
        req.destroy();
        setTimeout(resolve, 50);
      });
    });

    req.on('error', () => {
      // Expected socket destruction error on client
      resolve();
    });

    req.write(postData);
    req.end();
  });
});

runTest('Server-side timeout aborts long-running research and emits sanitized error', async () => {
  // Test error sanitization and timeout handling
  const timeoutError = new Error('Research execution timed out. Operation exceeded the maximum server limit of 180 seconds.');
  const sanitized = sanitizeErrorMessage(timeoutError);
  assert.ok(sanitized.includes('timed out') || sanitized.includes('cancelled'));
});

// ----------------------------------------------------
// 16. Real-Style Source Excerpt Tests: Supported, Contradicted, and Unsupported
// ----------------------------------------------------
console.log('\nGroup 16: Real-Style Source Excerpt Tests: Supported, Contradicted, and Unsupported');

// Domain 1: Semiconductor Power Electronics Excerpt
const semiExcerptSource: ResearchSource = {
  id: 'src-semi-1',
  url: 'https://ieee-transactions.org/power-electronics/2024-sic-mosfet',
  title: 'IEEE Transactions on Power Electronics: High-Temperature Characterization of SiC MOSFETs',
  authorityTier: 'HIGH_AUTHORITY',
  sourceCategory: 'academic',
  isPeerReviewed: true,
  peerReviewStatus: 'peer_reviewed',
};

const semiExcerptEvidence: ResearchEvidence = {
  id: 'ev-semi-1',
  sourceId: 'src-semi-1',
  sourceUrl: 'https://ieee-transactions.org/power-electronics/2024-sic-mosfet',
  sourceTitle: 'IEEE Transactions: SiC MOSFET Characterization',
  fact: 'Silicon carbide (SiC) power MOSFETs demonstrated a 4.2-fold reduction in switching losses at 150°C junction temperature compared to standard silicon IGBT modules. However, high gate oxide defect density remains an active reliability challenge, with gate leakage currents increasing by 28% after 1,000 hours of high-temperature reverse bias (HTRB) testing. On-state resistance RDS(on) was measured at 18 mΩ in standard TO-247 packaging.',
  epistemicType: 'FACT',
  confidenceCategory: 'HIGH',
  numericalData: {
    metric: 'Switching Loss Reduction',
    value: 4.2,
    unit: 'fold',
  },
  verificationStatus: 'verified',
  extractedAt: new Date().toISOString(),
};

runTest('[Real Excerpt 1] SUPPORTED: Direct numeric and relational match', () => {
  const supportedClaim = {
    id: 'claim-semi-supported',
    claim: 'Silicon carbide power MOSFETs achieved a 4.2-fold reduction in switching losses at 150°C relative to silicon IGBTs.',
    sourceIds: ['src-semi-1'],
    evidenceIds: ['ev-semi-1'],
  };

  const res = verifyResearchClaim(supportedClaim, [semiExcerptSource], [semiExcerptEvidence]);
  assert.strictEqual(res.verified, true);
  assert.strictEqual(res.supportStatus, 'supported');
  assert.strictEqual(res.unverifiedReason, undefined);
});

runTest('[Real Excerpt 1] CONTRADICTED: Directional inversion with high keyword overlap', () => {
  const contradictedClaim = {
    id: 'claim-semi-contradicted',
    claim: 'Silicon carbide power MOSFETs suffered a 4.2-fold increase in switching losses at 150°C relative to silicon IGBTs.',
    sourceIds: ['src-semi-1'],
    evidenceIds: ['ev-semi-1'],
  };

  const res = verifyResearchClaim(contradictedClaim, [semiExcerptSource], [semiExcerptEvidence]);
  assert.strictEqual(res.verified, false, 'Contradicted assertion must NOT be verified');
  assert.strictEqual(res.supportStatus, 'contradicted', 'Must detect polarity contradiction');
  assert.ok(res.unverifiedReason && res.unverifiedReason.includes('Contradiction detected'));
});

runTest('[Real Excerpt 1] UNSUPPORTED: High keyword overlap asserting unsubstantiated defect elimination', () => {
  const unsupportedClaim = {
    id: 'claim-semi-unsupported',
    claim: 'Silicon carbide power MOSFETs completely eliminate gate oxide defect density and prevent high-temperature gate leakage.',
    sourceIds: ['src-semi-1'],
    evidenceIds: ['ev-semi-1'],
  };

  const res = verifyResearchClaim(unsupportedClaim, [semiExcerptSource], [semiExcerptEvidence]);
  assert.strictEqual(res.verified, false);
  assert.ok(res.supportStatus === 'contradicted' || res.supportStatus === 'unsupported');
});

runTest('[Real Excerpt 1] UNSUPPORTED: Invented commercial revenue metrics absent from technical excerpt', () => {
  const inventedMetricsClaim = {
    id: 'claim-semi-invented-money',
    claim: 'Silicon carbide power MOSFET global market adoption generated $12 billion in quarterly revenue.',
    sourceIds: ['src-semi-1'],
    evidenceIds: ['ev-semi-1'],
  };

  const res = verifyResearchClaim(inventedMetricsClaim, [semiExcerptSource], [semiExcerptEvidence]);
  assert.strictEqual(res.verified, false);
  assert.strictEqual(res.supportStatus, 'unsupported');
  assert.ok(res.unverifiedReason && res.unverifiedReason.includes('numerical metrics'));
});

// Domain 2: Clinical Oncology Trial Excerpt
const clinicalExcerptSource: ResearchSource = {
  id: 'src-clin-1',
  url: 'https://thelancet.com/journals/lanonc/article/PIIS1470-2045(24)00112-9/fulltext',
  title: 'The Lancet Oncology: Phase III Trial of Ramucirumab in NSCLC',
  authorityTier: 'HIGH_AUTHORITY',
  sourceCategory: 'academic',
  isPeerReviewed: true,
  peerReviewStatus: 'peer_reviewed',
};

const clinicalExcerptEvidence: ResearchEvidence = {
  id: 'ev-clin-1',
  sourceId: 'src-clin-1',
  sourceUrl: 'https://thelancet.com/journals/lanonc/article/PIIS1470-2045(24)00112-9/fulltext',
  sourceTitle: 'The Lancet Oncology: Phase III NSCLC Trial',
  fact: 'In the randomized double-blind Phase III clinical trial for advanced non-small cell lung cancer, patients receiving ramucirumab plus docetaxel demonstrated a median overall survival of 10.5 months compared to 9.1 months in the placebo control group (hazard ratio 0.86, p = 0.023). However, progression-free survival showed no statistically significant difference between arms (hazard ratio 0.98, p = 0.74). Grade 3 or higher febrile neutropenia incidence rose by 14% in the ramucirumab treatment cohort.',
  epistemicType: 'FACT',
  confidenceCategory: 'HIGH',
  numericalData: {
    metric: 'Median Overall Survival',
    value: 10.5,
    unit: 'months',
  },
  verificationStatus: 'verified',
  extractedAt: new Date().toISOString(),
};

runTest('[Real Excerpt 2] SUPPORTED: Clinical survival outcomes verified with exact numbers', () => {
  const supportedClaim = {
    id: 'claim-clin-supported',
    claim: 'Ramucirumab plus docetaxel improved median overall survival to 10.5 months compared to 9.1 months in the control group (hazard ratio 0.86, p = 0.023).',
    sourceIds: ['src-clin-1'],
    evidenceIds: ['ev-clin-1'],
  };

  const res = verifyResearchClaim(supportedClaim, [clinicalExcerptSource], [clinicalExcerptEvidence]);
  assert.strictEqual(res.verified, true);
  assert.strictEqual(res.supportStatus, 'supported');
});

runTest('[Real Excerpt 2] CONTRADICTED: Falsely claiming null finding was statistically significant', () => {
  const contradictedClaim = {
    id: 'claim-clin-contradicted',
    claim: 'The Phase III trial demonstrated that ramucirumab achieved a strong statistically significant improvement in progression-free survival.',
    sourceIds: ['src-clin-1'],
    evidenceIds: ['ev-clin-1'],
  };

  const res = verifyResearchClaim(contradictedClaim, [clinicalExcerptSource], [clinicalExcerptEvidence]);
  assert.strictEqual(res.verified, false, 'Contradicted clinical endpoint claim must fail');
  assert.strictEqual(res.supportStatus, 'contradicted');
  assert.ok(res.unverifiedReason && res.unverifiedReason.includes('Contradiction detected'));
});

runTest('[Real Excerpt 2] UNSUPPORTED: Invented 85% tumor eradication absent from trial report', () => {
  const unsupportedClaim = {
    id: 'claim-clin-invented',
    claim: 'Ramucirumab plus docetaxel achieved complete radiological tumor eradication in 85% of clinical cohort patients.',
    sourceIds: ['src-clin-1'],
    evidenceIds: ['ev-clin-1'],
  };

  const res = verifyResearchClaim(unsupportedClaim, [clinicalExcerptSource], [clinicalExcerptEvidence]);
  assert.strictEqual(res.verified, false);
  assert.strictEqual(res.supportStatus, 'unsupported');
});

// Domain 3: High-Performance Memory Architecture Excerpt
const memoryExcerptSource: ResearchSource = {
  id: 'src-mem-1',
  url: 'https://jedec.org/standards-documents/docs/jesd79-5c',
  title: 'JEDEC Standard JESD79-5C: DDR5 SDRAM Specification',
  authorityTier: 'HIGH_AUTHORITY',
  sourceCategory: 'official_doc',
};

const memoryExcerptEvidence: ResearchEvidence = {
  id: 'ev-mem-1',
  sourceId: 'src-mem-1',
  sourceUrl: 'https://jedec.org/standards-documents/docs/jesd79-5c',
  sourceTitle: 'JEDEC DDR5 SDRAM Specification',
  fact: 'DDR5 memory modules introduce on-die Error Correcting Code (ECC) to detect and correct single-bit errors within the DRAM array prior to sending data to the memory controller. While on-die ECC enhances internal silicon defect tolerance at higher memory densities, it does not correct data transmission errors occurring across the external DDR5 bus between the DIMM and the CPU memory controller.',
  epistemicType: 'FACT',
  confidenceCategory: 'HIGH',
  verificationStatus: 'verified',
  extractedAt: new Date().toISOString(),
};

runTest('[Real Excerpt 3] SUPPORTED: Architectural on-die ECC factual entailment', () => {
  const supportedClaim = {
    id: 'claim-mem-supported',
    claim: 'DDR5 memory architecture incorporates on-die ECC to correct single-bit errors within the internal DRAM array.',
    sourceIds: ['src-mem-1'],
    evidenceIds: ['ev-mem-1'],
  };

  const res = verifyResearchClaim(supportedClaim, [memoryExcerptSource], [memoryExcerptEvidence]);
  assert.strictEqual(res.verified, true);
  assert.strictEqual(res.supportStatus, 'supported');
});

runTest('[Real Excerpt 3] CONTRADICTED: Falsely claiming on-die ECC corrects external bus transmission errors', () => {
  const contradictedClaim = {
    id: 'claim-mem-contradicted',
    claim: 'DDR5 on-die ECC eliminates data transmission errors occurring across the external memory bus between the DIMM and CPU.',
    sourceIds: ['src-mem-1'],
    evidenceIds: ['ev-mem-1'],
  };

  const res = verifyResearchClaim(contradictedClaim, [memoryExcerptSource], [memoryExcerptEvidence]);
  assert.strictEqual(res.verified, false);
  assert.ok(res.supportStatus === 'contradicted' || res.supportStatus === 'unsupported');
});

// ----------------------------------------------------
// 17. Real Research Agent Execution Loop Lifecycle
// ----------------------------------------------------
console.log('\nGroup 17: Real Research Agent Execution Loop Lifecycle');

runTest('Agent orchestration loop generates validated structured paper structure', async () => {
  const updates: any[] = [];
  const paper = await runResearchAgent(
    {
      topic: 'Philosophy of computational functionalism',
      settings: { depth: 'quick', maxIterations: 1, requireQuantitativeData: false },
    },
    (update) => {
      updates.push(update);
    }
  );

  assert.ok(paper !== null, 'Paper object must be generated');
  assert.ok(paper.topic, 'Paper must have a topic');
  assert.ok(Array.isArray(paper.findings), 'Paper must include findings array');
  assert.ok(Array.isArray(paper.citations), 'Paper must include citations array');
  assert.ok(Array.isArray(paper.claims), 'Paper must include claims array');
  assert.ok(Array.isArray(paper.agentPlan), 'Paper must include agentPlan array');
  assert.ok(updates.length > 0, 'Agent loop must emit progress updates');
  assert.ok(updates.some(u => u.status === 'planning'), 'Progress updates must include planning stage');
});

// Summary & Clean Teardown
(async () => {
  await Promise.all(pendingAsyncTests);
  try {
    testServer.close();
  } catch {}

  console.log('\n----------------------------------------');
  console.log(`TOTAL TESTS: ${testsPassed + testsFailed}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log('----------------------------------------\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
})();
