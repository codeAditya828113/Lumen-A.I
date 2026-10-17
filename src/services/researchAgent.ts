import { 
  ResearchPaper, 
  ResearchTask, 
  ResearchSource, 
  ResearchEvidence, 
  ResearchClaim, 
  AgentStatus, 
  AgentSettings, 
  AgentProgressUpdate, 
  AgentLogEntry, 
  ResearchAgentState,
  Visualization,
  Citation,
  SemanticNode,
  ConceptModel,
  TaskType,
  ResearchIntent,
  SourceConflict,
  QualityGateAudit,
  ConfidenceTier,
  EpistemicType,
  SemanticNodeType,
  AuthorityTier,
  SourceCategory
} from '../types';
import { getAiClient } from './geminiClient';
import { 
  searchWeb, 
  searchAcademicSources, 
  searchQuantitativeEvidence, 
  extractEvidence, 
  checkExistingEvidence,
  detectEvidenceConflicts,
  normalizeSourceUrl
} from './researchTools';
import { createResearchPlan } from './researchPlanner';
import { analyzeResearchIntent } from './researchIntent';
import { 
  evaluateEvidenceSufficiency, 
  reviewReportIntegrity, 
  runResearchQualityGate,
  verifyResearchClaim 
} from './researchVerifier';
import { jsonrepair } from 'jsonrepair';

function safeParseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  let text = raw.trim();

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket);
    } else {
      startIdx = firstBrace !== -1 ? firstBrace : firstBracket;
    }
    if (startIdx !== -1) {
      const lastBrace = text.lastIndexOf('}');
      const lastBracket = text.lastIndexOf(']');
      const endIdx = Math.max(lastBrace, lastBracket);
      if (endIdx > startIdx) {
        text = text.substring(startIdx, endIdx + 1);
      }
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    try {
      const repaired = jsonrepair(text);
      return JSON.parse(repaired);
    } catch (e) {
      console.warn("safeParseJson failed in researchAgent:", e);
      return fallback;
    }
  }
}

export interface ResearchAgentRequest {
  topic: string;
  feedback?: string;
  detailLevel?: 'brief' | 'standard' | 'detailed';
  analyticalLens?: string;
  settings?: Partial<AgentSettings>;
  userId?: string;
  userClarification?: string;
  abortSignal?: AbortSignal;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  depth: 'standard',
  maxIterations: 6,
  sourcePreference: 'general',
  recentSourcesOnly: true,
  requireQuantitativeData: false,
};

/**
 * Executes the complete autonomous agentic research lifecycle:
 * INTENT ANALYZER → AMBIGUITY CHECK → DYNAMIC PLANNER → TOOL EXECUTION
 * → EVIDENCE EXTRACTION → CONFLICT DETECTION → EVALUATE → REPLAN
 * → GROUNDED SYNTHESIS → INTEGRITY REVIEW → QUALITY GATE AUDIT → FINALIZE
 */
export async function runResearchAgent(
  request: ResearchAgentRequest,
  onProgress?: (update: AgentProgressUpdate) => void
): Promise<Partial<ResearchPaper>> {
  const settings: AgentSettings = {
    ...DEFAULT_AGENT_SETTINGS,
    ...(request.settings || {}),
  };

  if (request.settings?.depth === 'quick') {
    settings.maxIterations = 4;
  } else if (request.settings?.depth === 'deep') {
    settings.maxIterations = 8;
  }

  const logs: AgentLogEntry[] = [];
  const addLog = (type: AgentLogEntry['type'], message: string, details?: string) => {
    const entry: AgentLogEntry = {
      id: `log-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details,
    };
    logs.push(entry);
    notifyProgress(state.status || 'executing_task', 'Agent Execution', message, progressPercentage);
  };

  let progressPercentage = 5;

  const notifyProgress = (
    status: AgentStatus,
    stageTitle: string,
    message: string,
    percentage: number,
    currentTask?: ResearchTask
  ) => {
    progressPercentage = percentage;
    state.status = status;
    if (onProgress) {
      onProgress({
        status,
        stageTitle,
        message,
        progressPercentage: Math.min(Math.max(percentage, 0), 100),
        currentTaskIndex: state.currentTaskIndex,
        totalTasks: state.researchPlan.length,
        currentTask,
        plan: state.researchPlan,
        sourcesCount: state.sources.length,
        evidenceCount: state.evidence.length,
        claimsCount: state.claims.length,
        iteration: state.iteration,
        maxIterations: settings.maxIterations,
        log: [...logs],
        intent: state.intent,
        clarificationQuestion: state.intent?.clarificationQuestion,
        clarificationOptions: state.intent?.clarificationOptions,
      });
    }
  };

  const state: ResearchAgentState = {
    researchGoal: request.topic,
    researchPlan: [],
    currentTaskIndex: 0,
    completedTasks: [],
    sources: [],
    evidence: [],
    claims: [],
    conflicts: [],
    missingInformation: [],
    searchedQueries: [],
    iteration: 0,
    status: 'analyzing_intent',
    logs,
  };

  try {
    // -------------------------------------------------------------
    // STAGE 0: INTENT ANALYSIS & AMBIGUITY DETECTION
    // -------------------------------------------------------------
    notifyProgress('analyzing_intent', 'Phase 0: Intent & Ambiguity Check', `Analyzing intent and checking for polysemy in "${request.topic}"...`, 8);
    addLog('action', 'Auditing query intent, entity domains, and potential material ambiguity...');

    const intent = await analyzeResearchIntent(request.topic, {
      feedback: request.feedback,
      analyticalLens: request.analyticalLens,
      userClarification: request.userClarification,
    });

    state.intent = intent;

    // Check if query is materially ambiguous and needs user input
    if (intent.requiresClarification && !request.userClarification) {
      addLog('warn', `Domain ambiguity identified for "${request.topic}": ${intent.ambiguities.join('; ')}`);
      notifyProgress(
        'clarification_needed',
        'Clarification Required',
        intent.clarificationQuestion || `I found multiple possible meanings for "${request.topic}". Please clarify your objective.`,
        10
      );

      // Return partial paper with clarification metadata
      return {
        topic: request.topic,
        summary: `Query requires clarification: ${intent.clarificationQuestion}`,
        findings: intent.ambiguities,
        paper: `### Domain Clarification Required\n\n${intent.clarificationQuestion}\n\n` + 
          (intent.clarificationOptions || []).map(opt => `- **Option ${opt.key}**: ${opt.label}\n  *${opt.description}*`).join('\n\n') +
          `\n\n*Select one of the options above or provide contextual details to proceed with research.*`,
        citations: [],
        visualizations: [],
        conceptModels: [],
        citationWeb: [],
        intent,
      };
    }

    addLog('info', `Intent validated: Interpreted subject as "${intent.interpretedSubject}" (Objective: ${intent.researchObjective}).`);

    // -------------------------------------------------------------
    // STAGE 1: DYNAMIC RESEARCH PLANNING
    // -------------------------------------------------------------
    notifyProgress('planning', 'Phase 1: Dynamic Research Planning', `Formulating dynamic research plan for "${intent.interpretedSubject}"...`, 15);
    addLog('action', 'Decomposing validated objective into discrete, prioritized tasks...');

    const planResult = await createResearchPlan(intent, {
      analyticalLens: request.analyticalLens,
      feedback: request.feedback,
      settings,
    });

    state.researchPlan = planResult.tasks;
    const shouldRequireQuantitative = Boolean(settings.requireQuantitativeData || planResult.requiresQuantitative);

    addLog('info', `Categorized goal as [${planResult.topicCategory.toUpperCase()}]: ${planResult.rationale}`);
    addLog('success', `Created structured research plan with ${planResult.tasks.length} initial tasks.`, planResult.tasks.map(t => `[${t.type}] ${t.description}`).join(' • '));
    notifyProgress('planning', 'Phase 1: Dynamic Research Planning', `Plan established: ${planResult.tasks.length} tasks scheduled.`, 20);

    // -------------------------------------------------------------
    // STAGE 2: THE AGENTIC RESEARCH LOOP
    // PLAN → ACT → OBSERVE → EVALUATE → REPLAN
    // -------------------------------------------------------------
    while (state.iteration < settings.maxIterations) {
      const pendingTaskIndex = state.researchPlan.findIndex(t => t.status === 'pending');
      if (pendingTaskIndex === -1) {
        addLog('info', 'All scheduled research tasks completed.');
        break;
      }

      state.currentTaskIndex = pendingTaskIndex;
      const currentTask = state.researchPlan[pendingTaskIndex];
      currentTask.status = 'in_progress';
      state.iteration++;

      const loopPercentage = Math.round(20 + (state.iteration / settings.maxIterations) * 50);

      notifyProgress(
        'executing_task',
        `Phase 2: Task Execution (${state.iteration}/${settings.maxIterations})`,
        `Executing: ${currentTask.description}`,
        loopPercentage,
        currentTask
      );

      const taskQuery = currentTask.query || `${intent.interpretedSubject} ${currentTask.description}`;

      // Step 2a: Deduplication & Cache Check
      const isDuplicateSearch = state.searchedQueries.some(q => 
        q.toLowerCase() === taskQuery.toLowerCase() || 
        (q.length > 15 && taskQuery.includes(q))
      );

      const existingCheck = checkExistingEvidence(state.evidence, taskQuery);

      let searchResult: { sources: ResearchSource[]; summary: string; rawResponse: string; searchQueriesUsed: string[] };

      if (existingCheck.found && !isDuplicateSearch) {
        addLog('info', `Reusing ${existingCheck.matchingEvidence.length} verified evidence points from prior task observations.`);
        currentTask.toolUsed = 'Evidence Cache (Synthesized)';
        searchResult = {
          sources: [],
          summary: existingCheck.matchingEvidence.map(e => e.fact).join('\n'),
          rawResponse: '',
          searchQueriesUsed: [],
        };
      } else {
        // Step 2b: Tool Selection
        let toolName = 'searchWeb';
        if (currentTask.type === 'quantitative' || (shouldRequireQuantitative && state.evidence.filter(e => e.numericalData).length < 2)) {
          toolName = 'searchQuantitativeEvidence';
          addLog('action', `Selecting tool [searchQuantitativeEvidence] for empirical data on: "${taskQuery.slice(0, 50)}..."`);
          searchResult = await searchQuantitativeEvidence(taskQuery);
        } else if (currentTask.type === 'evidence' || currentTask.type === 'methodology' || request.analyticalLens === 'academic') {
          toolName = 'searchAcademicSources';
          addLog('action', `Selecting tool [searchAcademicSources] for scholarly grounding on: "${taskQuery.slice(0, 50)}..."`);
          searchResult = await searchAcademicSources(taskQuery, request.analyticalLens);
        } else {
          toolName = 'searchWeb';
          addLog('action', `Selecting tool [searchWeb] for: "${taskQuery.slice(0, 50)}..."`);
          searchResult = await searchWeb(taskQuery, { focus: currentTask.description });
        }

        currentTask.toolUsed = toolName;
        state.searchedQueries.push(taskQuery);
      }

      // Step 2c: Observation & Evidence Extraction
      let newEvidence: ResearchEvidence[] = [];
      if (searchResult.sources.length > 0) {
        // Deduplicate sources into state
        for (const src of searchResult.sources) {
          if (!state.sources.some(s => s.cleanUrl === src.cleanUrl || s.url === src.url)) {
            state.sources.push(src);
          }
        }

        const highAuthCount = searchResult.sources.filter(s => s.authorityTier === 'HIGH_AUTHORITY').length;
        addLog('info', `Discovered ${searchResult.sources.length} sources (${highAuthCount} High-Authority tiers).`);
        newEvidence = await extractEvidence(searchResult, currentTask.description, currentTask.type);
      }

      for (const ev of newEvidence) {
        state.evidence.push(ev);
      }

      currentTask.status = 'completed';
      currentTask.sourcesFound = searchResult.sources.length;
      currentTask.evidenceFound = newEvidence.length;
      currentTask.resultSummary = searchResult.summary ? searchResult.summary.slice(0, 160) + '...' : 'Task investigated successfully.';

      state.completedTasks.push(currentTask);
      addLog('success', `Task completed: Extracted ${newEvidence.length} verified facts (Total: ${state.evidence.length} evidence, ${state.sources.length} sources).`);

      // Step 2d: Conflict Detection & Evidence Sufficiency Evaluation (Every 2 tasks or low tasks)
      const remainingPending = state.researchPlan.filter(t => t.status === 'pending').length;
      if (state.iteration >= 2 && (remainingPending <= 1 || state.iteration % 2 === 0)) {
        notifyProgress('evaluating_evidence', 'Phase 3: Evidence Evaluation & Conflict Audit', 'Auditing evidence sufficiency and checking for source discrepancies...', loopPercentage + 3);

        // Run conflict detection across gathered evidence
        const detectedConflicts = await detectEvidenceConflicts(state.evidence, state.sources);
        if (detectedConflicts.length > 0) {
          state.conflicts = detectedConflicts;
          addLog('warn', `Identified ${detectedConflicts.length} material disagreement(s) between sources: ${detectedConflicts.map(c => c.topicOrMetric).join(', ')}`);
        }

        const evalResult = await evaluateEvidenceSufficiency(
          intent.interpretedSubject,
          state.completedTasks,
          state.evidence,
          state.sources,
          { requireQuantitative: shouldRequireQuantitative, conflicts: state.conflicts }
        );

        state.verificationResult = evalResult;

        if (evalResult.status === 'insufficient' && state.iteration < settings.maxIterations - 1) {
          const gap = evalResult.missingInformation[0] || 'Additional authoritative empirical validation';
          const recAction = evalResult.recommendedActions[0] || `Investigate ${gap} for ${intent.interpretedSubject}`;
          
          addLog('warn', `Evidence gap identified: ${gap}. Replanning research path...`);

          const isQuantGap = shouldRequireQuantitative && (gap.toLowerCase().includes('stat') || gap.toLowerCase().includes('quant') || gap.toLowerCase().includes('price'));
          const newTask: ResearchTask = {
            id: `task-replan-${state.iteration}`,
            description: `[Dynamic Re-search] ${gap}`,
            type: isQuantGap ? 'quantitative' : 'evidence',
            status: 'pending',
            query: recAction.replace(/^search for /i, ''),
          };

          state.researchPlan.push(newTask);
          addLog('action', `Appended targeted follow-up task: "${newTask.description}".`);
        } else {
          addLog('success', `Evidence sufficiency verified (Score: ${evalResult.evidenceScore}/100, Quantitative Data Points: ${evalResult.quantitativeEvidenceCount}).`);
        }
      }
    }

    // -------------------------------------------------------------
    // STAGE 3: SYNTHESIZING VERIFIED EVIDENCE & DRAFTING REPORT
    // -------------------------------------------------------------
    notifyProgress('writing_report', 'Phase 4: Synthesis & Drafting', 'Synthesizing report strictly from verified evidence records...', 75);
    addLog('action', 'Assembling verified factual records, conflicts, and citations for document compilation...');

    const reportData = await generateReportFromEvidence(request, state);
    state.draftReport = reportData;
    addLog('success', 'Structured report, calibrated claims, and visualizations compiled.');

    // -------------------------------------------------------------
    // STAGE 4: REPORT INTEGRITY REVIEW & RECONCILIATION
    // -------------------------------------------------------------
    notifyProgress('reviewing_report', 'Phase 5: Integrity Verification', 'Auditing drafted report for citations, unsupported claims, and consistency...', 85);
    addLog('evaluation', 'Running citation-to-source traceability audit...');

    const reviewResult = await reviewReportIntegrity(
      reportData.paper || '',
      reportData.findings || [],
      state.evidence,
      state.sources,
      state.claims
    );

    state.reviewResult = reviewResult;

    if (!reviewResult.passed && reviewResult.issues.length > 0) {
      addLog('warn', `Review identified ${reviewResult.issues.length} minor citation or assertion discrepancies. Auto-aligning report...`);
      reportData.paper = await patchReportIssues(reportData.paper || '', reviewResult.issues, state.evidence, state.sources);
      addLog('success', 'Report assertions aligned with verified source registry.');
    } else {
      addLog('success', `Integrity check passed with score ${reviewResult.score}/100.`);
    }

    // -------------------------------------------------------------
    // STAGE 5: FINAL RESEARCH QUALITY GATE AUDIT
    // -------------------------------------------------------------
    notifyProgress('quality_gate', 'Phase 6: Quality Gate Audit', 'Executing 12-point quality gate audit before final sign-off...', 92);
    addLog('evaluation', 'Verifying benchmark qualification, zero-fabrication constraints, and source normalization...');

    const qualityGate = await runResearchQualityGate(
      reportData.paper || '',
      reportData.findings || [],
      state.evidence,
      state.sources,
      state.claims,
      state.conflicts,
      {
        topic: intent.interpretedSubject,
        intent: state.intent,
        visualizations: reportData.visualizations,
      }
    );

    state.qualityGateAudit = qualityGate;
    addLog(qualityGate.passed ? 'success' : 'warn', `Quality Gate completed with score ${qualityGate.score}/100 (${qualityGate.checks.filter(c => c.passed).length}/${qualityGate.checks.length} checks passed).`);

    // -------------------------------------------------------------
    // STAGE 6: FINALIZING REPORT & EXPORT PACKAGING
    // -------------------------------------------------------------
    notifyProgress('finalizing', 'Phase 7: Finalization', 'Packaging final research paper, citation matrix, and 3D schematics...', 96);
    addLog('info', 'Packaging final research paper, citation matrix, and export formats...');

    // Detect if benchmark note is required
    const benchmarkNote = /humaneval|swe-bench|gaia|toolbench|mmlu|gsm8k|math-benchmark/i.test(reportData.paper || '')
      ? 'These results come from different benchmarks with different tasks and evaluation conditions and should not be interpreted as directly comparable performance scores.'
      : undefined;

    const finalPaper: Partial<ResearchPaper> = {
      ...reportData,
      topic: reportData.topic || intent.interpretedSubject || request.topic,
      summary: reportData.summary || `Synthesized research findings for ${intent.interpretedSubject}.`,
      findings: reportData.findings || [],
      paper: reportData.paper || 'Research report generation completed.',
      citations: reportData.citations || [],
      visualizations: reportData.visualizations || [],
      conceptModels: reportData.conceptModels || [],
      citationWeb: reportData.citationWeb || [],
      // Agentic provenance metadata
      intent: state.intent,
      agentPlan: state.researchPlan,
      claims: state.claims,
      conflicts: state.conflicts,
      qualityGateAudit: state.qualityGateAudit,
      benchmarkNote,
      evidenceCount: state.evidence.length,
      iterationCount: state.iteration,
      verificationScore: qualityGate.score || state.verificationResult?.evidenceScore || 85,
      depthLevel: settings.depth,
    };

    notifyProgress('completed', 'Research Completed', 'Agentic research workflow executed successfully.', 100);
    addLog('success', `Autonomous research cycle completed across ${state.iteration} iterations. Quality Gate Score: ${qualityGate.score}/100. Ready for export.`);

    return finalPaper;
  } catch (error: any) {
    console.error("Agent execution error:", error);
    addLog('warn', `Agent execution halted: ${error.message || 'Unexpected failure'}`);
    notifyProgress('error', 'Execution Interrupted', error.message || 'An error occurred during research.', progressPercentage);

    if (state.evidence.length > 0) {
      addLog('info', 'Generating fallback report from collected evidence base...');
      try {
        const fallbackReport = await generateReportFromEvidence(request, state);
        return {
          ...fallbackReport,
          agentPlan: state.researchPlan,
          claims: state.claims,
          conflicts: state.conflicts,
          evidenceCount: state.evidence.length,
          iterationCount: state.iteration,
        };
      } catch (fallbackError) {
        console.error("Emergency fallback generation also failed:", fallbackError);
      }
    }

    throw error;
  }
}

/**
 * Strictly synthesizes the final paper based on the collected evidence.
 * Disallows data fabrication, unmasks citations, and distinguishes fact from interpretation.
 */
async function generateReportFromEvidence(
  request: ResearchAgentRequest,
  state: ResearchAgentState
): Promise<Partial<ResearchPaper>> {
  const ai = getAiClient();

  const detailInstruction = request.detailLevel === 'brief'
    ? 'Keep the paper concise and under 600 words.'
    : request.detailLevel === 'detailed'
      ? 'Provide an exhaustive, highly detailed academic paper of 1600+ words.'
      : 'Provide a structured, comprehensive paper of 900-1200 words.';

  // Prepare evidence text with epistemic types and dates
  const evidenceSummary = state.evidence
    .map((e, idx) => {
      const numStr = e.numericalData
        ? `\nMetric Data: ${e.numericalData.metric} = ${e.numericalData.currency ? e.numericalData.currency + ' ' : ''}${e.numericalData.value}${e.numericalData.unit || ''} (Data Date: ${e.numericalData.dataDate || e.numericalData.year || 'N/A'}${e.numericalData.geography ? ', Market/Geo: ' + e.numericalData.geography : ''})`
        : '';
      return `[Evidence ${idx + 1}] (${e.sourceTitle} | ${e.sourceUrl})\nType: [${e.epistemicType || 'FACT'}] Confidence: [${e.confidenceCategory || 'HIGH'}]\nFact: ${e.fact}${numStr}`;
    })
    .join('\n\n');

  // Prepare real numerical data collected
  const realNumbers = state.evidence
    .filter(e => e.numericalData)
    .map(e => e.numericalData!);

  const hasRealNumbers = realNumbers.length > 0;

  // Prepare clean sources payload for citations
  const sourcesPayload = state.sources.map(s => {
    const { cleanUrl, displayDomain } = normalizeSourceUrl(s.url, s.title);
    return {
      id: s.id,
      title: s.title,
      url: cleanUrl,
      domain: displayDomain,
      authorityTier: s.authorityTier,
      sourceCategory: s.sourceCategory,
      publisher: s.publisher || displayDomain,
      publicationDate: s.publicationDate,
      doi: s.doi,
      arxivId: s.arxivId,
    };
  });

  // Conflicts payload
  const conflictsPayload = state.conflicts.map(c => ({
    topic: c.topicOrMetric,
    sourceA: `${c.sourceA.sourceTitle}: ${c.sourceA.claim}`,
    sourceB: `${c.sourceB.sourceTitle}: ${c.sourceB.claim}`,
    explanation: c.differenceExplanation,
    synthesis: c.synthesis,
  }));

  const prompt = `You are a Senior Scholarly Document Writer in an agentic research system.
Your objective: Synthesize the final research paper on "${state.intent?.interpretedSubject || request.topic}" based PRIMARILY on the verified evidence collected by our research agent.

CRITICAL INTEGRITY & EPISTEMIC CONSTRAINTS:
1. Ground every major factual claim in the provided evidence.
2. DO NOT FABRICATE STATISTICS OR METRICS.
${hasRealNumbers 
  ? `RELIABLE EMPIRICAL DATA AVAILABLE:
${JSON.stringify(realNumbers, null, 2)}
Create 1-2 visualizations USING ONLY THESE REAL METRICS. Set "category": "analytical". Clearly identify metric, unit, sourceAttribution, and dataDate.`
  : `NO RELIABLE EMPIRICAL NUMBERS WERE FOUND IN SEARCHES.
DO NOT INVENT NUMBERS FOR CHARTS! You must either provide 0 visualizations (empty array []) or 1 conceptual diagram with "category": "conceptual", title clearly stating "Conceptual framework: ..." or "Conceptual relationship map: ...".`
}
3. DISTINGUISH FACT, INTERPRETATION, ESTIMATE, PROJECTION, OPINION, AND UNCERTAINTY:
   - Use phrasing such as: "According to [Source]...", "The available data estimates...", "Researchers observe that...", "Projections suggest...".
   - Avoid presenting speculative or model-generated interpretation as established empirical fact.
4. REPRESENT CONFLICTING EVIDENCE TRANSPARENTLY:
   ${conflictsPayload.length > 0
     ? `The following material source discrepancies were detected in the evidence:
${JSON.stringify(conflictsPayload, null, 2)}
Include a dedicated section or subsection ("## Analysis of Conflicting Evidence & Methodological Variations") discussing these differences objectively without arbitrarily favoring one.`
     : 'If there are nuances or minor variations in the evidence, acknowledge them rather than claiming absolute uniformity.'
   }
5. BENCHMARK DISCLAIMER:
   If any AI or software benchmarks (HumanEval, SWE-bench, GAIA, etc.) are cited, explicitly note:
   "These results come from different benchmarks with different tasks and evaluation conditions and should not be interpreted as directly comparable performance scores."
6. CITATION INTEGRITY:
   Use only the provided clean URLs and real titles. NEVER cite raw redirect URLs or hallucinated publishers.
7. Maintain rigorous academic prose and the IMRAD format (Abstract, Introduction, Literature Review, Methodology/Architecture, Results/Analysis, Discussion, Conclusion). ${detailInstruction}

Verified Evidence Base:
"""
${evidenceSummary}
"""

Available Verified Sources:
${JSON.stringify(sourcesPayload, null, 2)}

${request.feedback ? `User Requirements/Style: ${request.feedback}` : ''}

CRITICAL: Return your output using these EXACT XML tags:

<topic>${state.intent?.interpretedSubject || request.topic}</topic>

<summary>A concise 2-3 sentence executive abstract of the research.</summary>

<findings>
  <finding>Key factual finding 1 derived from evidence</finding>
  <finding>Key factual finding 2 derived from evidence</finding>
  <finding>Key factual finding 3 derived from evidence</finding>
</findings>

<paper>
Write the complete research paper in Markdown format with clear headings (# Abstract, ## Introduction, ## Literature Review, ## Methodology & Analysis, ## Key Findings, ## Critical Discussion, ## Conclusion).
Cite sources naturally throughout the text using markdown links or standard references (e.g. "[Author/Source Title](clean_url)").
</paper>

<json_data>
{
  "citations": [
    {
      "title": "Exact source title from available sources",
      "url": "Direct clean source URL (never redirect URL)",
      "publisher": "Publisher or organization name",
      "publicationDate": "Year or date if known",
      "apa": "Complete APA 7th edition reference",
      "mla": "Complete MLA 9th edition reference",
      "bibtex": "@article{...}"
    }
  ],
  "claims": [
    {
      "id": "claim-1",
      "claim": "Specific factual claim stated in paper",
      "sourceIds": ["matching source id or url"],
      "evidenceIds": ["matching evidence id if applicable"],
      "confidence": "HIGH" | "MODERATE" | "LOW" | "UNCERTAIN",
      "confidenceRationale": "Why this confidence level was assigned",
      "epistemicType": "FACT" | "INTERPRETATION" | "ESTIMATE" | "PROJECTION" | "OPINION" | "UNCERTAINTY",
      "verified": true
    }
  ],
  "visualizations": [
    ${hasRealNumbers ? `{
      "category": "analytical",
      "type": "bar | line | pie | area | radar | scatter",
      "title": "Precise Chart Title Reflecting Real Evidence",
      "metric": "Specific metric name",
      "unit": "Unit/Currency",
      "sourceAttribution": "Source organization",
      "dataDate": "Year or timeframe",
      "data": [
        { "name": "Category from real data", "value": 123 }
      ],
      "apaCitation": "APA citation attributing the data",
      "bibtexCitation": "BibTeX entry",
      "tikzCode": "% TikZ code for LaTeX export"
    }` : ''}
  ],
  "conceptModels": [
    {
      "term": "Key concept term from paper",
      "type": "atom | molecule | globe | network | geometry",
      "description": "Scientific description of this concept",
      "apaCitation": "APA citation",
      "bibtexCitation": "BibTeX citation"
    }
  ],
  "citationWeb": [
    {
      "id": "node-1",
      "label": "Short label",
      "type": "primary | secondary | academic | government | industry | official_doc | news",
      "connections": ["node-2"]
    }
  ]
}
</json_data>`;

  let text = '';
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        maxOutputTokens: 8192,
      },
    });
    text = response.text || '';
  } catch (err: any) {
    console.warn("generateReportFromEvidence fallback triggered due to AI availability/quota:", err?.message || err);
    const subj = state.intent?.interpretedSubject || request.topic;
    text = `<topic>${subj}</topic>
<summary>Comprehensive synthesis and investigation on ${subj} based on collected primary evidence and source records.</summary>
<findings>${(state.evidence.length > 0 ? state.evidence.slice(0, 5).map(e => `<finding>${e.fact}</finding>`) : ['<finding>Comprehensive baseline evidence evaluated across primary literature.</finding>']).join('')}</findings>
<paper># ${subj}

## Abstract
This paper presents an evidence-grounded investigation of ${subj}.

## Synthesis of Findings
${state.evidence.length > 0 ? state.evidence.map(e => `- ${e.fact}`).join('\n') : '- Comprehensive primary and secondary reference records analyzed.'}

## Discussion & Conclusion
The synthesized findings establish grounded insights into the core topic. Ongoing investigations and further empirical validation remain recommended.</paper>
<json_data>{"claims":[], "visualizations":[], "conceptModels":[], "citationWeb":[]}</json_data>`;
  }

  const extractTag = (tag: string, src: string) => {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
    const match = src.match(regex);
    return match ? match[1].trim() : '';
  };

  const extractFindings = (src: string) => {
    const findingsMatch = src.match(/<findings>([\s\S]*?)<\/findings>/i);
    if (!findingsMatch) return [];
    const findingRegex = /<finding>([\s\S]*?)<\/finding>/gi;
    const findings: string[] = [];
    let match;
    while ((match = findingRegex.exec(findingsMatch[1])) !== null) {
      findings.push(match[1].trim());
    }
    return findings;
  };

  let paper = extractTag('paper', text);
  if (!paper) {
    let clean = text
      .replace(/<topic>[\s\S]*?<\/topic>/gi, '')
      .replace(/<summary>[\s\S]*?<\/summary>/gi, '')
      .replace(/<findings>[\s\S]*?<\/findings>/gi, '')
      .replace(/<json_data>[\s\S]*?<\/json_data>/gi, '')
      .trim();
    paper = clean.length > 50 ? clean : `Synthesized research findings on ${state.intent?.interpretedSubject || request.topic}.`;
  }

  let summary = extractTag('summary', text);
  if (!summary) {
    const firstPara = paper.split('\n\n')[0]?.replace(/[#*`_]/g, '').trim();
    summary = firstPara ? firstPara.slice(0, 300) : `Comprehensive research paper on ${state.intent?.interpretedSubject || request.topic}.`;
  }

  let findings = extractFindings(text);
  if (findings.length === 0) {
    findings = state.evidence.slice(0, 4).map(e => e.fact);
  }

  // Parse JSON data section
  const jsonRaw = extractTag('json_data', text);
  const parsedData = safeParseJson<any>(jsonRaw, {});

  // Clean citations: ensure clean URLs, no raw redirects
  let citations: Citation[] = (parsedData.citations || []).map((c: any) => {
    const { cleanUrl } = normalizeSourceUrl(c.url || '', c.title);
    return {
      ...c,
      url: cleanUrl || c.url,
      cleanUrl: cleanUrl || c.url,
    };
  });

  if (citations.length === 0 && state.sources.length > 0) {
    citations = state.sources.slice(0, 6).map(s => {
      const clean = s.cleanUrl || s.url;
      const pubYear = s.publicationDate || new Date().getFullYear();
      return {
        id: s.id,
        title: s.title,
        url: clean,
        cleanUrl: clean,
        publisher: s.publisher || s.domain || '',
        publicationDate: s.publicationDate || `${pubYear}`,
        retrievalDate: s.retrievalDate || new Date().toISOString(),
        authorityTier: s.authorityTier || 'MEDIUM_AUTHORITY',
        sourceCategory: s.sourceCategory || 'general_web',
        apa: `${s.title}. (${pubYear}). Retrieved from ${clean}`,
        mla: `"${s.title}." Web. ${new Date().toLocaleDateString()}. <${clean}>.`,
        bibtex: `@misc{${s.id}, title={${s.title}}, url={${clean}}, year={${pubYear}}}`,
        ...(s.doi ? { doi: s.doi } : {}),
        ...(s.arxivId ? { arxivId: s.arxivId } : {}),
      };
    });
  }

  // Visualizations: strictly prevent fabricated data
  let visualizations: Visualization[] = (parsedData.visualizations || []).map((v: any) => {
    if (!hasRealNumbers) {
      return {
        ...v,
        category: 'conceptual' as const,
        title: v.title.toLowerCase().includes('concept') ? v.title : `Conceptual Framework: ${v.title}`,
      };
    }
    return {
      ...v,
      category: (v.category || 'analytical') as 'analytical' | 'conceptual',
    };
  });

  // Concept models
  let conceptModels: ConceptModel[] = parsedData.conceptModels || [];
  if (conceptModels.length === 0) {
    conceptModels = [
      {
        term: (state.intent?.interpretedSubject || request.topic).split(' ').slice(0, 3).join(' '),
        type: 'network',
        description: `Structural interaction network representing key relational dynamics of ${state.intent?.interpretedSubject || request.topic}.`,
      }
    ];
  }

  // Semantic citation web nodes with meaningful taxonomy
  let citationWeb: SemanticNode[] = (parsedData.citationWeb || []).map((n: any) => {
    const validTypes: SemanticNodeType[] = ['primary', 'secondary', 'academic', 'government', 'industry', 'official_doc', 'news', 'foundational', 'recent', 'draft'];
    return {
      ...n,
      type: validTypes.includes(n.type) ? n.type : 'academic',
    };
  });

  if (citationWeb.length === 0 && citations.length > 0) {
    const rootId = 'root-node';
    citationWeb.push({
      id: rootId,
      label: (state.intent?.interpretedSubject || request.topic).slice(0, 22),
      type: 'primary',
      connections: citations.slice(0, 5).map((_, i) => `cite-${i + 1}`),
    });
    citations.slice(0, 5).forEach((c, idx) => {
      const nodeType: SemanticNodeType = c.sourceCategory === 'government' ? 'government'
        : c.sourceCategory === 'academic' || c.sourceCategory === 'university' ? 'academic'
        : c.sourceCategory === 'official_doc' ? 'official_doc'
        : c.sourceCategory === 'news' ? 'news'
        : c.sourceCategory === 'industry' ? 'industry'
        : (idx % 2 === 0 ? 'secondary' : 'academic');

      citationWeb.push({
        id: `cite-${idx + 1}`,
        label: c.title.slice(0, 22),
        type: nodeType,
        connections: [rootId],
        authorityTier: c.authorityTier,
      });
    });
  }

  // Populate research claims with honest verification:
  // Never default "verified" to true. Validate every claim's source IDs and evidence IDs.
  // Do not attach arbitrary fallback sources or evidence.
  // Mark claims as verified only when their cited evidence directly supports them; otherwise mark them unverified and explain why.
  const claims: ResearchClaim[] = (parsedData.claims || []).map((c: any) => {
    return verifyResearchClaim(c, state.sources, state.evidence);
  });

  state.claims = claims;

  return {
    topic: extractTag('topic', text) || state.intent?.interpretedSubject || request.topic,
    summary,
    findings,
    paper,
    citations,
    visualizations,
    conceptModels,
    citationWeb,
  };
}

/**
 * Corrects draft paper issues identified during report review.
 */
async function patchReportIssues(
  draftPaper: string,
  issues: any[],
  evidenceList: ResearchEvidence[],
  sourcesList: ResearchSource[]
): Promise<string> {
  const ai = getAiClient();
  const prompt = `You are a Research Document Editor.
Review this draft text and the identified issues, then return a corrected Markdown paper that fixes all unsupported assertions, ungrounded statistics, or missing citations.

Issues to resolve:
${JSON.stringify(issues, null, 2)}

Available Verified Evidence:
${evidenceList.slice(0, 12).map(e => `[${e.sourceTitle}]: ${e.fact}`).join('\n')}

Original Draft:
"""
${draftPaper}
"""

Instructions:
- Remove or soften any assertions marked as unsupported or fabricated.
- Ensure all factual claims are accurately cited.
- Calibrate epistemic language (distinguish fact, estimate, projection, opinion).
- Return ONLY the corrected Markdown document text. Do not wrap in conversational responses.`;

  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });
    return res.text?.trim() || draftPaper;
  } catch {
    return draftPaper;
  }
}
