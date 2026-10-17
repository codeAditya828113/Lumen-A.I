import { getAiClient } from './geminiClient';
import { ResearchTask, TaskType, AgentSettings, ResearchIntent } from '../types';
import { jsonrepair } from 'jsonrepair';

export interface ResearchPlanResult {
  tasks: ResearchTask[];
  requiresQuantitative: boolean;
  topicCategory: 'historical' | 'conceptual' | 'scientific' | 'comparative' | 'socio-economic' | 'pricing-market' | 'general';
  rationale: string;
}

/**
 * Evaluates whether a research topic/objective inherently requires empirical quantitative metrics,
 * or whether it is qualitative/conceptual/historical.
 * Guarantees that quantitative data is strictly conditional on the research objective.
 */
export function isTopicQuantitative(researchGoal: string, intent?: ResearchIntent): boolean {
  const text = `${researchGoal} ${intent?.researchObjective || ''} ${intent?.constraints?.join(' ') || ''}`.toLowerCase();
  
  // Strong indicators of quantitative inquiry
  const hasQuantitativeKeywords = /\b(prices?|pricing|costs?|financial|market share|revenue|gdp|inflation|interest rates?|stock|valuation|salary|wages|metrics?|benchmarks?|latency|throughput|accuracy rate|fps|statistics|quantitative data)\b/i.test(text);

  // Strong indicators of qualitative/conceptual inquiry
  const hasQualitativeKeywords = /\b(history|origins?|evolution|philosophy|ethics?|conceptual|framework|theoretical|critique|qualitative|definition|meanings?|literature review|perspectives?)\b/i.test(text);

  if (hasQualitativeKeywords && !hasQuantitativeKeywords) {
    return false;
  }
  return hasQuantitativeKeywords;
}

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
      console.warn("safeParseJson failed in planner:", e);
      return fallback;
    }
  }
}

/**
 * Creates a dynamic research plan tailored to the validated intent and specific nature of the research goal.
 * Uses structured intent to avoid raw ambiguous query traps and appropriately schedules quantitative vs qualitative tasks.
 */
export async function createResearchPlan(
  researchGoalOrIntent: string | ResearchIntent,
  options?: {
    analyticalLens?: string;
    feedback?: string;
    settings?: Partial<AgentSettings>;
  }
): Promise<ResearchPlanResult> {
  const isIntentObj = typeof researchGoalOrIntent === 'object' && researchGoalOrIntent !== null;
  const researchGoal: string = typeof researchGoalOrIntent === 'string' 
    ? researchGoalOrIntent 
    : (researchGoalOrIntent.interpretedSubject || '');
  const intentObjective = isIntentObj ? researchGoalOrIntent.researchObjective : '';
  const intentConstraints = isIntentObj && researchGoalOrIntent.constraints ? researchGoalOrIntent.constraints.join('; ') : '';
  const temporalScope = isIntentObj && researchGoalOrIntent.temporalContext ? researchGoalOrIntent.temporalContext : '';

  const ai = getAiClient();
  const depth = options?.settings?.depth || 'standard';
  const targetTaskCount = depth === 'quick' ? 3 : depth === 'deep' ? 6 : 4;

  let lensDirective = '';
  if (options?.analyticalLens && options.analyticalLens !== 'default') {
    switch (options.analyticalLens) {
      case 'academic':
        lensDirective = 'Focus specifically on peer-reviewed methodology, academic frameworks, and scholarly debates.';
        break;
      case 'patent':
        lensDirective = 'Focus on novel engineering architectures, industrial patent claims, and utility applications.';
        break;
      case 'socio-technical':
        lensDirective = 'Focus on socio-economic impact, regulatory/ethical policy, and environmental implications.';
        break;
      case 'clinical':
        lensDirective = 'Focus on clinical trials, patient outcomes, biomedical protocols, and cohort metrics.';
        break;
    }
  }

  const prompt = `You are an Autonomous Scholarly Research Planner.
Your role: Analyze the validated research objective and produce a customized, prioritized sequence of research tasks.

Target Subject: "${researchGoal}"
${intentObjective ? `Research Objective: "${intentObjective}"` : ''}
${intentConstraints ? `Constraints / Geography / Market: "${intentConstraints}"` : ''}
${temporalScope ? `Temporal Context: "${temporalScope}"` : ''}
${options?.feedback ? `User Requirements/Feedback: "${options.feedback}"` : ''}
${lensDirective ? `Analytical Perspective: "${lensDirective}"` : ''}
Target Task Count: exactly ${targetTaskCount} tasks.

CRITICAL INSTRUCTIONS ON TASK SELECTION & QUANTITATIVE DATA:
1. Understand the NATURE of the question:
   - Pricing & Market Data (e.g. "Recent computer RAM prices in India", "Solar panel installation costs"):
     Focus on actual real-world prices, currency metrics, supplier/retail benchmarks, and market trends.
     Set "requiresQuantitative": true. Include targeted "quantitative" pricing tasks with specific queries.
   - Historical (e.g. "History of cloud computing", "Origins of cryptography"):
     Focus on origins, historical inflection points, architectural evolution, and legacy impact.
     DO NOT FORCE quantitative metrics or statistics tasks! Set "requiresQuantitative": false.
   - Conceptual / Theoretical (e.g. "Philosophy of mind", "Ethical frameworks in AI"):
     Focus on definitions, core philosophical debates, theoretical tensions, and modern perspectives.
     DO NOT FORCE statistics! Set "requiresQuantitative": false.
   - Comparative (e.g. "Compare serverless computing and traditional cloud architecture"):
     Focus on architectural differences, deployment models, operational trade-offs, and practical adoption trade-offs.
     Set "requiresQuantitative": false unless comparative empirical benchmarks are central.
   - Socio-Economic / Empirical (e.g. "Impact of AI on employment", "Renewable energy adoption"):
     Focus on economic mechanisms, labor/industry data, empirical studies, and policy responses.
     Set "requiresQuantitative": true. Include ONE targeted "quantitative" task.
   - Scientific / Benchmark (e.g. "Recent advances in quantum computing", "mRNA vaccine efficacy"):
     Focus on state-of-the-art benchmarks, technical breakthroughs, limitations, and empirical data.
     Set "requiresQuantitative": true. Include ONE targeted "quantitative" task.

2. NEVER use a generic fixed checklist. Every task must be tailored specifically to "${researchGoal}".
3. Formulate realistic search queries for each task.

Return JSON ONLY:
{
  "topicCategory": "historical" | "conceptual" | "scientific" | "comparative" | "socio-economic" | "pricing-market" | "general",
  "requiresQuantitative": boolean,
  "rationale": "1-2 sentence explanation of why this plan was chosen for this topic",
  "tasks": [
    {
      "id": "task-1",
      "description": "Clear imperative description of what to investigate",
      "type": "background" | "applications" | "risks" | "evidence" | "quantitative" | "analysis",
      "query": "Precise search query string"
    }
  ]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = safeParseJson<any>(response.text || '{}', null);
    if (parsed && parsed.tasks && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
      const tasks: ResearchTask[] = parsed.tasks.map((t: any, idx: number) => ({
        id: t.id || `task-${idx + 1}`,
        description: t.description || `Investigate aspect ${idx + 1} of ${researchGoal}`,
        type: (['background', 'applications', 'risks', 'evidence', 'quantitative', 'methodology', 'analysis'].includes(t.type)
          ? t.type
          : 'background') as TaskType,
        status: 'pending',
        query: t.query || `${researchGoal} ${t.description || ''}`,
      }));

      return {
        tasks,
        requiresQuantitative: Boolean(parsed.requiresQuantitative),
        topicCategory: parsed.topicCategory || 'general',
        rationale: parsed.rationale || `Tailored research plan for ${researchGoal}`,
      };
    }
  } catch (err) {
    console.error("createResearchPlan failed:", err);
  }

  // Resilient heuristic-based fallback plan
  const lowerGoal = researchGoal.toLowerCase();
  const isHistorical = /history|evolution|origin|ancient|medieval|century|timeline|development of/i.test(lowerGoal);
  const isConceptual = /philosophy|ethics|framework|theory|theoretical|definition|conceptual|meaning|critique|epistemology|ontology/i.test(lowerGoal);
  const isComparative = /compare|vs\.?|versus|difference|comparison|trade-?offs/i.test(lowerGoal);
  const isQuantitative = /employment|impact on|market|economic|growth|statistics|rate|gdp|cost|benchmark|price|pricing/i.test(lowerGoal);

  if (isConceptual) {
    const conceptualTasks: ResearchTask[] = [
      {
        id: 'task-1',
        description: `Define core theoretical frameworks, epistemological concepts, and foundational definitions of ${researchGoal}`,
        type: 'background',
        status: 'pending',
        query: `${researchGoal} theoretical framework definition foundations concepts`,
      },
      {
        id: 'task-2',
        description: `Analyze major philosophical debates, competing schools of thought, and seminal arguments`,
        type: 'analysis',
        status: 'pending',
        query: `${researchGoal} philosophical debates competing theories critique perspectives`,
      },
      {
        id: 'task-3',
        description: `Examine modern applications, conceptual tensions, and contemporary perspectives`,
        type: 'applications',
        status: 'pending',
        query: `${researchGoal} modern synthesis contemporary perspective practical implications`,
      },
    ];

    return {
      topicCategory: 'conceptual',
      requiresQuantitative: false,
      rationale: 'Conceptual and theoretical inquiry focusing on foundational frameworks, dialectical debates, and qualitative perspectives.',
      tasks: conceptualTasks.slice(0, targetTaskCount),
    };
  }

  if (isHistorical) {
    const historicalTasks: ResearchTask[] = [
      {
        id: 'task-1',
        description: `Trace the origins, early precursors, and foundational context of ${researchGoal}`,
        type: 'background',
        status: 'pending',
        query: `${researchGoal} origins early history timeline foundations`,
      },
      {
        id: 'task-2',
        description: `Identify major evolutionary inflection points, architectural shifts, and key figures`,
        type: 'applications',
        status: 'pending',
        query: `${researchGoal} milestones key developments historical breakthrough`,
      },
      {
        id: 'task-3',
        description: `Analyze historical impact, technological maturation, and enduring legacy`,
        type: 'analysis',
        status: 'pending',
        query: `${researchGoal} historical impact evolution modern legacy`,
      },
    ];

    return {
      topicCategory: 'historical',
      requiresQuantitative: false,
      rationale: 'Historical inquiry focusing on evolutionary milestones and conceptual origins.',
      tasks: historicalTasks.slice(0, targetTaskCount),
    };
  }

  if (isComparative) {
    const comparativeTasks: ResearchTask[] = [
      {
        id: 'task-1',
        description: `Define structural architectures and operational paradigms being compared in ${researchGoal}`,
        type: 'background',
        status: 'pending',
        query: `${researchGoal} architectural definitions paradigm overview`,
      },
      {
        id: 'task-2',
        description: `Compare operational scalability, management overhead, and deployment trade-offs`,
        type: 'analysis',
        status: 'pending',
        query: `${researchGoal} trade-offs scalability operational comparison`,
      },
      {
        id: 'task-3',
        description: `Examine real-world case studies, best-fit scenarios, and industry consensus`,
        type: 'applications',
        status: 'pending',
        query: `${researchGoal} case studies best practices decision framework`,
      },
    ];

    return {
      topicCategory: 'comparative',
      requiresQuantitative: false,
      rationale: 'Comparative architecture analysis focusing on structural differences and trade-offs.',
      tasks: comparativeTasks.slice(0, targetTaskCount),
    };
  }

  if (isQuantitative) {
    const quantitativeTasks: ResearchTask[] = [
      {
        id: 'task-1',
        description: `Define foundational mechanisms and economic scope of ${researchGoal}`,
        type: 'background',
        status: 'pending',
        query: `${researchGoal} overview economic mechanisms framework`,
      },
      {
        id: 'task-2',
        description: `Gather authoritative empirical statistics, labor metrics, and quantitative studies`,
        type: 'quantitative',
        status: 'pending',
        query: `${researchGoal} empirical statistics labor metrics study data 2024 2025`,
      },
      {
        id: 'task-3',
        description: `Examine counter-perspectives, sectoral variations, and long-term implications`,
        type: 'analysis',
        status: 'pending',
        query: `${researchGoal} sectoral impact analysis policy implications`,
      },
    ];

    return {
      topicCategory: 'socio-economic',
      requiresQuantitative: true,
      rationale: 'Socio-economic research requiring empirical statistics and labor metrics.',
      tasks: quantitativeTasks.slice(0, targetTaskCount),
    };
  }

  // General default fallback
  const defaultTasks: ResearchTask[] = [
    {
      id: 'task-1',
      description: `Define foundational architecture and core principles of ${researchGoal}`,
      type: 'background',
      status: 'pending',
      query: `${researchGoal} overview principles core concepts`,
    },
    {
      id: 'task-2',
      description: `Investigate practical implementations and authoritative evidence for ${researchGoal}`,
      type: 'evidence',
      status: 'pending',
      query: `${researchGoal} practical implementations authoritative findings`,
    },
    {
      id: 'task-3',
      description: `Analyze limitations, risk factors, and future outlook for ${researchGoal}`,
      type: 'analysis',
      status: 'pending',
      query: `${researchGoal} challenges limitations future perspectives`,
    },
  ];

  return {
    topicCategory: 'general',
    requiresQuantitative: false,
    rationale: 'Comprehensive multi-perspective analysis.',
    tasks: defaultTasks.slice(0, targetTaskCount),
  };
}
