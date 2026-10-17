export type AuthorityTier = 'HIGH_AUTHORITY' | 'MEDIUM_AUTHORITY' | 'LOW_AUTHORITY';

export type SourceCategory = 
  | 'academic' 
  | 'government' 
  | 'standards' 
  | 'university' 
  | 'preprint'
  | 'official_doc' 
  | 'industry' 
  | 'news' 
  | 'general_web';

export type EpistemicType = 'FACT' | 'INTERPRETATION' | 'ESTIMATE' | 'PROJECTION' | 'OPINION' | 'UNCERTAINTY';
export type ConfidenceTier = 'HIGH' | 'MODERATE' | 'LOW' | 'UNCERTAIN';

export interface ClarificationOption {
  key: string;
  label: string;
  description: string;
  resolvedQuery: string;
}

export interface ResearchIntent {
  originalQuery: string;
  interpretedSubject: string;
  researchObjective: string;
  ambiguities: string[];
  requiresClarification: boolean;
  clarificationQuestion?: string | null;
  clarificationOptions?: ClarificationOption[];
  constraints?: string[];
  temporalContext?: string | null;
  suggestedLenses?: string[];
}

export interface Citation {
  id?: string;
  title: string;
  url: string;
  cleanUrl?: string;
  snippet?: string;
  author?: string;
  publisher?: string;
  publicationDate?: string;
  retrievalDate?: string;
  doi?: string;
  arxivId?: string;
  reportId?: string;
  apa?: string;
  mla?: string;
  bibtex?: string;
  authorityTier?: AuthorityTier;
  sourceCategory?: SourceCategory;
  warning?: string;
  isRedirect?: boolean;
  isResolved?: boolean;
}

export interface Visualization {
  category?: 'analytical' | 'conceptual';
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'scatter';
  title: string;
  data: any[];
  apaCitation?: string;
  bibtexCitation?: string;
  tikzCode?: string;
  metric?: string;
  unit?: string;
  sourceAttribution?: string;
  dataDate?: string;
  benchmarkNote?: string;
}

export interface ConceptModel {
  term: string;
  type: 'atom' | 'molecule' | 'globe' | 'network' | 'geometry';
  description: string;
  apaCitation?: string;
  bibtexCitation?: string;
}

export type SemanticNodeType = 
  | 'primary' 
  | 'secondary' 
  | 'academic' 
  | 'government' 
  | 'industry' 
  | 'official_doc' 
  | 'news' 
  | 'foundational' 
  | 'recent' 
  | 'draft';

export interface SemanticNode {
  id: string;
  label: string;
  type: SemanticNodeType;
  connections: string[]; // IDs of connected nodes
  subLabel?: string;
  authorityTier?: AuthorityTier;
}

export type TaskType = 'background' | 'applications' | 'risks' | 'evidence' | 'analysis' | 'quantitative' | 'methodology';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface ResearchTask {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  query?: string;
  toolUsed?: string;
  resultSummary?: string;
  sourcesFound?: number;
  evidenceFound?: number;
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  cleanUrl?: string;
  snippet?: string;
  domain?: string;
  author?: string;
  publisher?: string;
  publicationDate?: string;
  dataDate?: string;
  retrievalDate?: string;
  doi?: string;
  arxivId?: string;
  reportId?: string;
  authorityTier: AuthorityTier;
  sourceCategory: SourceCategory;
  isPeerReviewed?: boolean;
  peerReviewStatus?: 'peer_reviewed' | 'preprint' | 'unconfirmed';
  isPrimarySource?: boolean;
  isGovernment?: boolean;
  isAcademic?: boolean;
  authoritative?: boolean;
  urlWarning?: string;
  isRedirect?: boolean;
  isResolved?: boolean;
}

export interface NumericalEvidenceData {
  metric: string;
  value: number | string;
  unit?: string;
  currency?: string;
  year?: string | number;
  dataDate?: string;
  geography?: string;
  populationOrSample?: string;
  context?: string;
  isBenchmark?: boolean;
  benchmarkDetails?: {
    benchmarkName?: string;
    modelOrSystem?: string;
    taskType?: string;
    datasetOrVersion?: string;
    scoreMetric?: string;
  };
}

export interface ResearchEvidence {
  id: string;
  taskId?: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  fact: string;
  numericalData?: NumericalEvidenceData;
  confidence?: number; // 0 to 1
  confidenceCategory?: ConfidenceTier;
  relevance?: 'high' | 'medium' | 'low';
  epistemicType?: EpistemicType;
  dataDate?: string;
  publicationDate?: string;
  retrievalDate?: string;
  verificationStatus?: 'verified' | 'unverified';
  extractedAt?: string;
}

export interface ResearchClaim {
  id: string;
  claim: string;
  sourceIds: string[];
  evidenceIds?: string[];
  confidence?: ConfidenceTier;
  confidenceRationale?: string;
  epistemicType?: EpistemicType;
  verified: boolean;
  supportStatus?: 'supported' | 'contradicted' | 'unsupported';
  unverifiedReason?: string;
  supportingEvidence?: string[];
  hasConflict?: boolean;
  conflictDetails?: string;
  notes?: string;
  verificationMethod?: string;
  consistencyChecks?: {
    numeric: boolean;
    unit: boolean;
    date: boolean;
    scope: boolean;
    substantiveEntailment: boolean;
  };
}

export interface SourceConflict {
  id: string;
  topicOrMetric: string;
  sourceA: {
    sourceId: string;
    sourceTitle: string;
    claim: string;
    dataDate?: string;
    methodology?: string;
    metricValue?: number;
  };
  sourceB: {
    sourceId: string;
    sourceTitle: string;
    claim: string;
    dataDate?: string;
    methodology?: string;
    metricValue?: number;
  };
  differenceExplanation: string;
  synthesis: string;
}

export interface QualityGateAudit {
  passed: boolean;
  score: number;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
  criticalIssues: string[];
}

export type AgentStatus = 
  | 'idle' 
  | 'analyzing_intent'
  | 'clarification_needed'
  | 'planning' 
  | 'executing_task' 
  | 'evaluating_evidence' 
  | 'replanning' 
  | 'writing_report' 
  | 'reviewing_report' 
  | 'quality_gate'
  | 'finalizing' 
  | 'completed' 
  | 'error';

export interface AgentSettings {
  depth: 'quick' | 'standard' | 'deep';
  maxIterations: number;
  sourcePreference: 'general' | 'academic' | 'authoritative' | 'industry';
  recentSourcesOnly: boolean;
  requireQuantitativeData: boolean;
}

export interface VerificationResult {
  status: 'sufficient' | 'insufficient';
  missingInformation: string[];
  recommendedActions: string[];
  evidenceScore: number; // 0 to 100
  quantitativeEvidenceCount: number;
  conflictsDetected?: SourceConflict[];
}

export interface ReportReviewIssue {
  type: 'unsupported_claim' | 'missing_citation' | 'citation_mismatch' | 'repeated_info' | 'weak_conclusion' | 'unsupported_statistic';
  claim?: string;
  action: string;
}

export interface ReportReviewResult {
  passed: boolean;
  issues: ReportReviewIssue[];
  score: number; // 0 to 100
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'action' | 'success' | 'warn' | 'evaluation';
  message: string;
  details?: string;
}

export interface AgentProgressUpdate {
  status: AgentStatus;
  stageTitle: string;
  message: string;
  progressPercentage: number;
  currentTaskIndex?: number;
  totalTasks?: number;
  currentTask?: ResearchTask;
  plan?: ResearchTask[];
  sourcesCount: number;
  evidenceCount: number;
  claimsCount: number;
  iteration: number;
  maxIterations: number;
  log?: AgentLogEntry[];
  intent?: ResearchIntent;
  clarificationQuestion?: string | null;
  clarificationOptions?: ClarificationOption[];
}

export interface ResearchAgentState {
  researchGoal: string;
  intent?: ResearchIntent;
  researchPlan: ResearchTask[];
  currentTaskIndex: number;
  completedTasks: ResearchTask[];
  sources: ResearchSource[];
  evidence: ResearchEvidence[];
  claims: ResearchClaim[];
  conflicts: SourceConflict[];
  missingInformation: string[];
  searchedQueries: string[];
  searchCallCount?: number;
  draftReport?: Partial<ResearchPaper>;
  verificationResult?: VerificationResult;
  reviewResult?: ReportReviewResult;
  qualityGateAudit?: QualityGateAudit;
  iteration: number;
  status: AgentStatus;
  logs: AgentLogEntry[];
}

export interface ResearchPaper {
  id?: string;
  userId: string;
  topic: string;
  summary: string;
  findings: string[];
  paper: string;
  citations: Citation[];
  visualizations: Visualization[];
  conceptModels?: ConceptModel[];
  citationWeb?: SemanticNode[];
  // Agentic Metadata
  intent?: ResearchIntent;
  agentPlan?: ResearchTask[];
  claims?: ResearchClaim[];
  conflicts?: SourceConflict[];
  qualityGateAudit?: QualityGateAudit;
  benchmarkNote?: string;
  evidenceCount?: number;
  iterationCount?: number;
  verificationScore?: number;
  depthLevel?: string;
  createdAt: any;
  updatedAt?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
