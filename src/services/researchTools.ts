import { getAiClient } from './geminiClient';
import { 
  ResearchSource, 
  ResearchEvidence, 
  TaskType, 
  AuthorityTier, 
  SourceCategory,
  ConfidenceTier,
  EpistemicType,
  NumericalEvidenceData,
  SourceConflict
} from '../types';
import { jsonrepair } from 'jsonrepair';

export interface ToolSearchResult {
  sources: ResearchSource[];
  summary: string;
  rawResponse: string;
  searchQueriesUsed: string[];
}

function safeParseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  let text = raw.trim();

  // Strip markdown code fences if present
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
      console.warn("safeParseJson failed after repair:", e);
      return fallback;
    }
  }
}

/**
 * Normalizes raw grounding URLs to strip out Google Search / Vertex AI grounding redirect wrappers
 * (e.g. vertexaisearch.cloud.google.com/grounding-api-redirect/...) so final citations and exports
 * display clean, direct authoritative URLs.
 * 
 * Strict citation handling: Resolves grounding redirect URLs only when the destination can be
 * reliably extracted and validated. Preserves unresolved originals with an explicit warning.
 */
export function normalizeSourceUrl(rawUrl: string, title?: string): { 
  cleanUrl: string; 
  displayDomain: string; 
  isRedirect: boolean; 
  isResolved: boolean; 
  warning?: string; 
} {
  if (!rawUrl) return { cleanUrl: '', displayDomain: '', isRedirect: false, isResolved: true };
  
  const trimmed = rawUrl.trim();
  const isGroundingRedirect = /vertexaisearch\.cloud\.google\.com\/grounding-api-redirect|google\.com\/url\?|googleusercontent\.com\/proxy/i.test(trimmed);

  if (!isGroundingRedirect) {
    let displayDomain = '';
    try {
      const parsed = new URL(trimmed);
      if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
        return { 
          cleanUrl: trimmed, 
          displayDomain: title || 'Source', 
          isRedirect: false, 
          isResolved: false, 
          warning: 'Malformed or invalid URL structure' 
        };
      }
      displayDomain = parsed.hostname.replace(/^www\./, '');
      return { cleanUrl: trimmed, displayDomain, isRedirect: false, isResolved: true };
    } catch {
      return { 
        cleanUrl: trimmed, 
        displayDomain: title || 'Source', 
        isRedirect: false, 
        isResolved: false, 
        warning: 'Malformed or invalid URL structure' 
      };
    }
  }

  // It IS a grounding redirect wrapper. Attempt to reliably extract destination.
  let extractedTarget: string | null = null;
  try {
    const parsed = new URL(trimmed);
    const candidate = parsed.searchParams.get('url') 
      || parsed.searchParams.get('q') 
      || parsed.searchParams.get('dest')
      || parsed.searchParams.get('target')
      || parsed.searchParams.get('uri')
      || parsed.searchParams.get('destination')
      || parsed.searchParams.get('redirect_uri');
      
    if (candidate) {
      const candidateUrl = new URL(candidate);
      if ((candidateUrl.protocol === 'http:' || candidateUrl.protocol === 'https:') && candidateUrl.hostname) {
        if (!/vertexaisearch\.cloud\.google\.com|google\.com\/url/i.test(candidateUrl.hostname)) {
          extractedTarget = candidate;
        }
      }
    }
  } catch {
    extractedTarget = null;
  }

  if (extractedTarget) {
    let displayDomain = '';
    try {
      displayDomain = new URL(extractedTarget).hostname.replace(/^www\./, '');
    } catch {
      displayDomain = title || 'Source';
    }
    return {
      cleanUrl: extractedTarget,
      displayDomain,
      isRedirect: true,
      isResolved: true,
    };
  }

  // Destination could NOT be reliably extracted -> preserve original and add explicit warning
  let displayDomain = '';
  try {
    displayDomain = new URL(trimmed).hostname.replace(/^www\./, '');
  } catch {
    displayDomain = title || 'Redirect';
  }

  return {
    cleanUrl: trimmed,
    displayDomain,
    isRedirect: true,
    isResolved: false,
    warning: 'Unresolved grounding redirect URL: destination could not be reliably extracted from wrapper.',
  };
}

/**
 * Evaluates the quality, authority tier, and taxonomy of a research source.
 * Strict rules prevent unearned high-authority classification.
 * A DOI, university domain, preprint repository, or publisher domain alone does NOT
 * prove that an article is peer-reviewed or that a particular claim is supported.
 * Represents uncertain metadata accurately.
 */
export function evaluateSourceQuality(
  url: string,
  title: string = '',
  snippet: string = ''
): {
  authorityTier: AuthorityTier;
  sourceCategory: SourceCategory;
  isPeerReviewed: boolean;
  peerReviewStatus: 'peer_reviewed' | 'preprint' | 'unconfirmed';
  isGovernment: boolean;
  isAcademic: boolean;
  isPrimarySource: boolean;
  publisher?: string;
  doi?: string;
  arxivId?: string;
} {
  const combined = `${url} ${title} ${snippet}`.toLowerCase();
  let domain = '';
  try {
    domain = new URL(url).hostname.toLowerCase();
  } catch {
    domain = '';
  }

  // DOI extraction
  const doiMatch = combined.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
  const doi = doiMatch ? doiMatch[0] : undefined;

  // arXiv ID extraction
  const arxivMatch = combined.match(/\barxiv:(\d{4}\.\d{4,5}(?:v\d+)?)\b/i) || url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i);
  const arxivId = arxivMatch ? arxivMatch[1] : undefined;

  // 1. Preprint Repositories (arXiv, bioRxiv, medRxiv, SSRN, etc.)
  // Preprints are scholarly research that has NOT undergone peer review.
  const isPreprintRepo = /arxiv\.org|biorxiv\.org|medrxiv\.org|ssrn\.com|preprints\.org|chemrxiv\.org|philpapers\.org|osf\.io\/preprints/i.test(domain) || Boolean(arxivId);
  if (isPreprintRepo) {
    return {
      authorityTier: 'MEDIUM_AUTHORITY',
      sourceCategory: 'preprint',
      isPeerReviewed: false,
      peerReviewStatus: 'preprint',
      isGovernment: false,
      isAcademic: true,
      isPrimarySource: true,
      publisher: 'Preprint Repository (Not Peer-Reviewed)',
      doi,
      arxivId,
    };
  }

  // 2. Government & Intergovernmental (HIGH_AUTHORITY)
  const isGovernment = /\.gov\b|\.mil\b|who\.int|un\.org|oecd\.org|worldbank\.org|imf\.org|europa\.eu|nih\.gov|cdc\.gov|sec\.gov|ftc\.gov|nist\.gov/i.test(domain);
  if (isGovernment) {
    return {
      authorityTier: 'HIGH_AUTHORITY',
      sourceCategory: 'government',
      isPeerReviewed: false,
      peerReviewStatus: 'unconfirmed',
      isGovernment: true,
      isAcademic: false,
      isPrimarySource: true,
      publisher: 'Official Government / Intergovernmental Body',
      doi,
      arxivId,
    };
  }

  // 3. Standards Organizations (HIGH_AUTHORITY)
  const isStandards = /w3\.org|ietf\.org|iso\.org|ieee-ras\.org|nist\.gov|unicode\.org/i.test(domain);
  if (isStandards) {
    return {
      authorityTier: 'HIGH_AUTHORITY',
      sourceCategory: 'standards',
      isPeerReviewed: false,
      peerReviewStatus: 'unconfirmed',
      isGovernment: false,
      isAcademic: true,
      isPrimarySource: true,
      publisher: 'Official Standards Organization',
      doi,
      arxivId,
    };
  }

  // 4. University Institutional Domains (.edu, .ac.uk, etc.)
  // Note: A university domain alone does NOT prove that an article is peer-reviewed (could be course syllabus, student blog, lab note).
  const isUniversity = /\.edu\b|\.ac\.[a-z]{2}\b/i.test(domain);
  if (isUniversity) {
    // Only mark peer-reviewed if explicitly stated in text/title
    const hasPeerReviewProof = /\bpeer-reviewed\b|\brefereed journal\b|\bpeer reviewed publication\b/i.test(combined);
    return {
      authorityTier: 'HIGH_AUTHORITY',
      sourceCategory: 'university',
      isPeerReviewed: hasPeerReviewProof,
      peerReviewStatus: hasPeerReviewProof ? 'peer_reviewed' : 'unconfirmed',
      isGovernment: false,
      isAcademic: true,
      isPrimarySource: false,
      publisher: 'University / Academic Institution',
      doi,
      arxivId,
    };
  }

  // 5. Academic Publishers & Known Scholarly Journals
  // Note: Publisher domain or DOI alone does NOT prove that an article is peer-reviewed (editorials, commentary, datasets exist).
  const isPublisherDomain = /nature\.com|sciencemag\.org|science\.org|ieee\.org|acm\.org|springer\.com|sciencedirect\.com|cell\.com|thelancet\.com|pnas\.org|plos\.org|frontiersin\.org|mdpi\.com|jstor\.org|wiley\.com|tandfonline\.com|oxfordacademic|cambridge\.org/i.test(domain);
  if (isPublisherDomain) {
    const isEditorialOrNews = /news|opinion|editorial|commentary|podcast|blog|correspondence/i.test(combined);
    const hasExplicitPeerReview = !isEditorialOrNews && /\bpeer-reviewed\b|\brefereed journal\b|\bpeer reviewed\b/i.test(combined);

    return {
      authorityTier: 'HIGH_AUTHORITY',
      sourceCategory: 'academic',
      isPeerReviewed: hasExplicitPeerReview,
      peerReviewStatus: hasExplicitPeerReview ? 'peer_reviewed' : 'unconfirmed',
      isGovernment: false,
      isAcademic: true,
      isPrimarySource: true,
      publisher: 'Academic Publisher / Journal',
      doi,
      arxivId,
    };
  }

  // 6. DOI alone (without known academic publisher or university domain)
  // A DOI alone does not prove peer review (datasets, whitepapers, preprints have DOIs).
  if (doi) {
    return {
      authorityTier: 'MEDIUM_AUTHORITY',
      sourceCategory: 'academic',
      isPeerReviewed: false,
      peerReviewStatus: 'unconfirmed',
      isGovernment: false,
      isAcademic: true,
      isPrimarySource: false,
      publisher: 'Digital Object Identifier Repository',
      doi,
      arxivId,
    };
  }

  // 7. Official Technical Documentation (HIGH_AUTHORITY for technical claims)
  const isOfficialDoc = /docs\.|developer\.|help\.|support\.|github\.com\/[a-z0-9-_]+\/[a-z0-9-_]+|kubernetes\.io|python\.org|kernel\.org|apache\.org|mozilla\.org/i.test(domain);
  if (isOfficialDoc) {
    return {
      authorityTier: 'HIGH_AUTHORITY',
      sourceCategory: 'official_doc',
      isPeerReviewed: false,
      peerReviewStatus: 'unconfirmed',
      isGovernment: false,
      isAcademic: false,
      isPrimarySource: true,
      publisher: 'Official Technical Documentation',
      doi,
      arxivId,
    };
  }

  // 8. Industry Analytics & Major News (MEDIUM_AUTHORITY)
  const isMajorNews = /reuters\.com|apnews\.com|ft\.com|wsj\.com|economist\.com|bbc\.com|theguardian\.com|bloomberg\.com/i.test(domain);
  const isIndustry = /gartner\.com|idc\.com|mckinsey\.com|statista\.com|counterpointresearch\.com|trendforce\.com|semianalysis\.com|anandtech\.com|tomshardware\.com|arstechnica\.com/i.test(domain);
  if (isMajorNews || isIndustry) {
    return {
      authorityTier: 'MEDIUM_AUTHORITY',
      sourceCategory: isMajorNews ? 'news' : 'industry',
      isPeerReviewed: false,
      peerReviewStatus: 'unconfirmed',
      isGovernment: false,
      isAcademic: false,
      isPrimarySource: false,
      publisher: domain,
      doi,
      arxivId,
    };
  }

  // 9. General Web (LOW_AUTHORITY)
  return {
    authorityTier: 'LOW_AUTHORITY',
    sourceCategory: 'general_web',
    isPeerReviewed: false,
    peerReviewStatus: 'unconfirmed',
    isGovernment: false,
    isAcademic: false,
    isPrimarySource: false,
    publisher: domain,
    doi,
    arxivId,
  };
}

/**
 * Searches the web using Google Search grounding via Gemini.
 * Normalizes redirect URLs and calculates source quality metrics.
 */
export async function searchWeb(
  query: string,
  options?: { focus?: string; maxSources?: number }
): Promise<ToolSearchResult> {
  const ai = getAiClient();
  const maxSources = options?.maxSources || 5;

  const prompt = `Perform an objective, fact-based search to gather verified data on:
"${query}"
${options?.focus ? `Specific Focus: ${options.focus}` : ''}

Provide a concise factual summary of what the sources report. Highlight concrete facts, publication dates, methodologies, sample sizes, and verifiable figures.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const summary = response.text || '';
    const grounding = response.candidates?.[0]?.groundingMetadata;
    const groundingChunks = grounding?.groundingChunks || [];
    const searchQueriesUsed = (grounding?.webSearchQueries as string[]) || [query];

    const sources: ResearchSource[] = [];
    const seenUrls = new Set<string>();
    const retrievalDate = new Date().toISOString();

    for (const chunk of groundingChunks) {
      if (chunk.web?.uri) {
        const { cleanUrl, displayDomain, isRedirect, isResolved, warning } = normalizeSourceUrl(chunk.web.uri, chunk.web.title);
        if (seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);

        const quality = evaluateSourceQuality(cleanUrl, chunk.web.title || '', summary);

        // Date extraction heuristic from title/snippet
        const dateMatch = (chunk.web.title || '').match(/\b(20\d{2})\b/) || summary.match(/\b(20\d{2})\b/);
        const publishedDate = dateMatch ? dateMatch[1] : undefined;

        sources.push({
          id: `src-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          title: chunk.web.title || displayDomain || 'Authoritative Reference',
          url: chunk.web.uri,
          cleanUrl,
          snippet: summary.slice(0, 240),
          domain: displayDomain,
          publisher: quality.publisher || displayDomain,
          retrievalDate,
          authorityTier: quality.authorityTier,
          sourceCategory: quality.sourceCategory,
          isPeerReviewed: quality.isPeerReviewed,
          peerReviewStatus: quality.peerReviewStatus,
          isGovernment: quality.isGovernment,
          isAcademic: quality.isAcademic,
          isPrimarySource: quality.isPrimarySource,
          authoritative: quality.authorityTier === 'HIGH_AUTHORITY',
          isRedirect,
          isResolved,
          ...(warning ? { urlWarning: warning } : {}),
          ...(publishedDate ? { publicationDate: publishedDate } : {}),
          ...(quality.doi ? { doi: quality.doi } : {}),
          ...(quality.arxivId ? { arxivId: quality.arxivId } : {}),
        });

        if (sources.length >= maxSources) break;
      }
    }

    return {
      sources,
      summary,
      rawResponse: summary,
      searchQueriesUsed,
    };
  } catch (err: any) {
    console.error("searchWeb tool failed:", err);
    return {
      sources: [],
      summary: `Search operation encountered an issue: ${err.message || 'Unknown network error'}`,
      rawResponse: '',
      searchQueriesUsed: [query],
    };
  }
}

/**
 * Searches authoritative academic and peer-reviewed sources.
 */
export async function searchAcademicSources(
  query: string,
  analyticalLens?: string
): Promise<ToolSearchResult> {
  const academicQuery = `${query} peer-reviewed research journal academic findings methodology`;
  const lensContext = analyticalLens && analyticalLens !== 'default' 
    ? `Target academic framework: ${analyticalLens}`
    : 'Target high-rigor academic consensus, empirical studies, and scholarly literature';

  return searchWeb(academicQuery, {
    focus: `${lensContext}. Prioritize journals, university research, and authoritative scientific repositories.`,
    maxSources: 5,
  });
}

/**
 * Searches for quantitative and statistical evidence to avoid fabricated numbers.
 */
export async function searchQuantitativeEvidence(
  query: string
): Promise<ToolSearchResult> {
  const quantitativeQuery = `${query} statistics percentage numbers data empirical benchmark metrics 2024 2025`;
  return searchWeb(quantitativeQuery, {
    focus: "Extract only concrete numerical figures, percentages, verified metrics, sample sizes, and statistics with publication years. Do NOT extrapolate or assume numbers.",
    maxSources: 5,
  });
}

/**
 * Extracts concrete, source-linked evidence from raw tool search output.
 * Preserves units, currency, date, geography, population, and epistemic type.
 */
export async function extractEvidence(
  searchResults: ToolSearchResult,
  taskGoal: string,
  taskType: TaskType
): Promise<ResearchEvidence[]> {
  if (!searchResults.summary || searchResults.sources.length === 0) {
    return [];
  }

  const ai = getAiClient();
  const sourcesPayload = searchResults.sources.map(s => ({
    id: s.id,
    title: s.title,
    url: s.cleanUrl || s.url,
    domain: s.domain,
    authorityTier: s.authorityTier,
  }));

  const prompt = `You are an Evidence Extraction Tool in an autonomous scholarly research assistant.
Goal: Extract verified factual evidence points from the search summary related to this task:
Task: "${taskGoal}" (Type: ${taskType})

Available Sources (Reference by exact id):
${JSON.stringify(sourcesPayload, null, 2)}

Search Findings:
"""
${searchResults.summary}
"""

Instructions:
1. Extract 2-5 distinct, verified factual claims supported by the search findings.
2. Link each claim to the exact sourceId that supports it.
3. If real numerical data (percentages, pricing, market size, benchmarks) is present in the text:
   - Extract it accurately in "numericalData".
   - Record currency (e.g. USD, INR, EUR) if pricing.
   - Record geography / market (e.g. India, Global, US, Enterprise).
   - Record dataDate / year (distinguish when the data was collected vs publication year).
   - If benchmark (e.g. HumanEval, SWE-bench, MLPerf), include benchmarkDetails.
   - NEVER FABRICATE OR GUESS NUMBERS. If no specific numbers exist, omit "numericalData" or set it to null.
4. Classify epistemicType: "FACT" | "INTERPRETATION" | "ESTIMATE" | "PROJECTION" | "OPINION" | "UNCERTAINTY".
5. Assign confidenceCategory: "HIGH" | "MODERATE" | "LOW" | "UNCERTAIN".

Return JSON ONLY matching this schema:
[
  {
    "sourceId": "id from Available Sources",
    "fact": "Clear factual statement grounded in text",
    "epistemicType": "FACT" | "INTERPRETATION" | "ESTIMATE" | "PROJECTION" | "OPINION" | "UNCERTAINTY",
    "confidenceCategory": "HIGH" | "MODERATE" | "LOW" | "UNCERTAIN",
    "numericalData": {
      "metric": "e.g. DDR5 16GB RAM Average Retail Price",
      "value": 45.99,
      "unit": "USD",
      "currency": "USD",
      "year": 2024,
      "dataDate": "Q3 2024",
      "geography": "India",
      "context": "Retail market survey",
      "isBenchmark": false
    } or null,
    "confidence": 0.9,
    "relevance": "high" | "medium" | "low"
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = safeParseJson<any[]>(response.text || '[]', []);
    if (!Array.isArray(parsed)) return [];

    const evidenceList: ResearchEvidence[] = [];
    const sourceMap = new Map(searchResults.sources.map(s => [s.id, s]));
    const retrievalDate = new Date().toISOString();

    for (const item of parsed) {
      if (!item.fact) continue;
      const src = sourceMap.get(item.sourceId) || searchResults.sources[0];
      
      let numData: NumericalEvidenceData | undefined = undefined;
      if (item.numericalData && typeof item.numericalData === 'object' && item.numericalData.value !== undefined) {
        numData = {
          metric: String(item.numericalData.metric || 'Metric'),
          value: item.numericalData.value,
          isBenchmark: Boolean(item.numericalData.isBenchmark),
          ...(item.numericalData.unit ? { unit: String(item.numericalData.unit) } : {}),
          ...(item.numericalData.currency ? { currency: String(item.numericalData.currency) } : {}),
          ...(item.numericalData.year ? { year: item.numericalData.year } : {}),
          ...(item.numericalData.dataDate ? { dataDate: String(item.numericalData.dataDate) } : {}),
          ...(item.numericalData.geography ? { geography: String(item.numericalData.geography) } : {}),
          ...(item.numericalData.populationOrSample ? { populationOrSample: String(item.numericalData.populationOrSample) } : {}),
          ...(item.numericalData.context ? { context: String(item.numericalData.context) } : {}),
          ...(item.numericalData.benchmarkDetails ? { benchmarkDetails: item.numericalData.benchmarkDetails } : {}),
        };
      }

      const epistemicType: EpistemicType = ['FACT', 'INTERPRETATION', 'ESTIMATE', 'PROJECTION', 'OPINION', 'UNCERTAINTY'].includes(item.epistemicType)
        ? item.epistemicType
        : 'FACT';

      const confidenceCategory: ConfidenceTier = ['HIGH', 'MODERATE', 'LOW', 'UNCERTAIN'].includes(item.confidenceCategory)
        ? item.confidenceCategory
        : (src.authorityTier === 'HIGH_AUTHORITY' ? 'HIGH' : src.authorityTier === 'MEDIUM_AUTHORITY' ? 'MODERATE' : 'LOW');

      evidenceList.push({
        id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        sourceId: src.id,
        sourceTitle: src.title,
        sourceUrl: src.cleanUrl || src.url,
        fact: String(item.fact).trim(),
        ...(numData ? { numericalData: numData } : {}),
        confidence: typeof item.confidence === 'number' ? Math.min(Math.max(item.confidence, 0.1), 1) : 0.85,
        confidenceCategory,
        relevance: ['high', 'medium', 'low'].includes(item.relevance) ? item.relevance : 'high',
        epistemicType,
        ...(src.publicationDate ? { publicationDate: src.publicationDate } : {}),
        ...(numData?.dataDate || src.publicationDate ? { dataDate: numData?.dataDate || src.publicationDate } : {}),
        retrievalDate,
      });
    }

    return evidenceList;
  } catch (err) {
    console.error("extractEvidence failed:", err);
    const firstSrc = searchResults.sources[0];
    if (searchResults.summary.length > 30) {
      return [{
        id: `ev-${Date.now().toString(36)}-fallback`,
        sourceId: firstSrc.id,
        sourceTitle: firstSrc.title,
        sourceUrl: firstSrc.cleanUrl || firstSrc.url,
        fact: searchResults.summary.slice(0, 300),
        confidence: 0.75,
        confidenceCategory: 'MODERATE',
        relevance: 'medium',
        epistemicType: 'FACT',
        publicationDate: firstSrc.publicationDate,
        retrievalDate: new Date().toISOString(),
      }];
    }
    return [];
  }
}

/**
 * Checks if existing evidence already sufficiently answers the query, preventing duplicate searches.
 */
export function checkExistingEvidence(
  evidenceList: ResearchEvidence[],
  query: string
): { found: boolean; matchingEvidence: ResearchEvidence[] } {
  if (!evidenceList || evidenceList.length === 0) {
    return { found: false, matchingEvidence: [] };
  }

  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['what', 'with', 'from', 'that', 'this', 'about', 'research', 'identify', 'examine', 'recent'].includes(w));

  if (queryWords.length === 0) {
    return { found: false, matchingEvidence: [] };
  }

  const matching = evidenceList.filter(ev => {
    const factLower = ev.fact.toLowerCase();
    const hits = queryWords.filter(w => factLower.includes(w));
    return (hits.length / queryWords.length) >= 0.6;
  });

  return {
    found: matching.length >= 2,
    matchingEvidence: matching,
  };
}

/**
 * Detects conflicts or material disagreements between collected evidence items from different sources.
 */
export async function detectEvidenceConflicts(
  evidenceList: ResearchEvidence[],
  sourcesList?: ResearchSource[]
): Promise<SourceConflict[]> {
  if (!evidenceList || evidenceList.length < 2) return [];

  const conflicts: SourceConflict[] = [];

  // 1. Programmatic numerical and metric disparity scan
  for (let i = 0; i < evidenceList.length; i++) {
    for (let j = i + 1; j < evidenceList.length; j++) {
      const e1 = evidenceList[i];
      const e2 = evidenceList[j];
      if (e1.sourceId !== e2.sourceId && e1.numericalData && e2.numericalData) {
        const m1 = (e1.numericalData.metric || '').toLowerCase();
        const m2 = (e2.numericalData.metric || '').toLowerCase();
        const words1 = m1.split(/\s+/).filter(w => w.length > 2);
        const hasOverlap = words1.some(w => m2.includes(w)) || (e1.numericalData.unit && e1.numericalData.unit === e2.numericalData.unit);
        if (m1 === m2 || hasOverlap) {
          const v1 = Number(e1.numericalData.value);
          const v2 = Number(e2.numericalData.value);
          if (!isNaN(v1) && !isNaN(v2) && v1 > 0 && v2 > 0) {
            const ratio = Math.max(v1, v2) / Math.min(v1, v2);
            if (ratio >= 1.25) {
              conflicts.push({
                id: `conflict-${i}-${j}`,
                topicOrMetric: e1.numericalData.metric || e2.numericalData.metric,
                sourceA: {
                  sourceId: e1.sourceId,
                  sourceTitle: e1.sourceTitle,
                  claim: e1.fact,
                  metricValue: v1,
                  dataDate: e1.numericalData.dataDate || (e1.numericalData.year ? String(e1.numericalData.year) : undefined),
                },
                sourceB: {
                  sourceId: e2.sourceId,
                  sourceTitle: e2.sourceTitle,
                  claim: e2.fact,
                  metricValue: v2,
                  dataDate: e2.numericalData.dataDate || (e2.numericalData.year ? String(e2.numericalData.year) : undefined),
                },
                differenceExplanation: `Discrepancy detected: ${e1.sourceTitle} reports ${v1} while ${e2.sourceTitle} reports ${v2} (${Math.round((ratio - 1) * 100)}% variance).`,
                synthesis: `Differing estimates (${v1} vs ${v2}) reflect varying analytical scopes or methodologies.`,
              });
            }
          }
        }
      }
    }
  }

  // 2. If 3 or more items, supplement with deep LLM conflict detection when available
  if (evidenceList.length >= 3) {
    try {
      const ai = getAiClient();
      const summaryPayload = evidenceList.map((e) => ({
        id: e.id,
        sourceId: e.sourceId,
        sourceTitle: e.sourceTitle,
        fact: e.fact,
        numericalData: e.numericalData,
        date: e.dataDate || e.publicationDate,
      }));

      const prompt = `You are a Research Dispute & Conflict Detector.
Analyze these factual evidence items collected from multiple web sources to detect any substantive conflicts, contradictory numerical claims, or differing conclusions.

Collected Evidence Items:
${JSON.stringify(summaryPayload.slice(0, 16), null, 2)}

Instructions:
1. Identify if Source A reports X while Source B reports Y on the SAME subject or metric.
2. Note whether difference may stem from different timeframes, geographies, methodologies, or survey samples.
3. If no genuine conflict exists, return an empty array [].
4. Return JSON ONLY matching schema:
[
  {
    "id": "conflict-llm-1",
    "topicOrMetric": "Metric name",
    "sourceA": { "sourceId": "id", "sourceTitle": "title", "claim": "claim", "dataDate": "2024" },
    "sourceB": { "sourceId": "id", "sourceTitle": "title", "claim": "claim", "dataDate": "2024" },
    "differenceExplanation": "Why they differ",
    "synthesis": "Reconciliation"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = safeParseJson<any[]>(response.text || '[]', []);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.topicOrMetric && item.sourceA && item.sourceB) {
            conflicts.push(item);
          }
        }
      }
    } catch (err) {
      // LLM call is optional enhancement over programmatic detection
    }
  }

  return conflicts;
}
