import { getAiClient } from './geminiClient';
import { ResearchIntent, ClarificationOption } from '../types';
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
    } catch {
      return fallback;
    }
  }
}

/**
 * Deterministic domain ambiguity guard to guarantee high-precision disambiguation
 * on known polysemous/acronym entities before expensive tool executions.
 */
export function checkKnownAmbiguity(query: string): ClarificationOption[] | null {
  const clean = query.trim().toLowerCase();

  // Pattern: "RAM" without computer/memory/hardware, medical, or mythology qualifiers
  const hasRam = /\bram\b/i.test(clean);
  const hasRamComputerContext = /computer|pc|laptop|desktop|server|memory|ddr\d?|dimm|sodimm|hardware|semiconductor|chip|gigabyte|gb\b|mb\b|tb\b|price|prices|pricing|cost|costs|market|smartphone|phone|device|speed|mhz|ghz|latency|cl\d+|cas|module|modules|ecc|nvram|vram|dram|sram|sdram|bus|motherboard|cpu|gpu|specs|specification|benchmark|benchmarks|storage|performance|upgrade|upgrades/i.test(clean);
  const hasRamMedicalContext = /drug|medicine|oncology|cancer|cyramza|ramucirumab|pharma|clinical|dosage|fda/i.test(clean);
  const hasRamMythologyContext = /hindu|shri|ayodhya|deity|god|mythology|temple|valmiki|ramayana/i.test(clean);
  const hasRamAutomotiveContext = /dodge|truck|pickup|hemi|cummins|vehicle|chrysler|towing/i.test(clean);

  if (hasRam && !hasRamComputerContext && !hasRamMedicalContext && !hasRamMythologyContext && !hasRamAutomotiveContext) {
    return [
      {
        key: 'A',
        label: 'Computer RAM / Memory Hardware',
        description: 'DRAM memory modules (DDR4, DDR5, PC/laptop/server system memory specifications, architecture, and market supply)',
        resolvedQuery: `${query} (Computer DRAM memory modules, DDR4/DDR5 hardware technology)`,
      },
      {
        key: 'B',
        label: 'Ramucirumab Oncology Pharmaceutical Drug',
        description: 'Ramucirumab (Cyramza) oncology pharmaceutical monoclonal antibody, clinical indications, and healthcare costs',
        resolvedQuery: `Ramucirumab (Cyramza) drug clinical indications, pharmacology, and healthcare costs`,
      },
      {
        key: 'C',
        label: 'Shri Ram (Cultural History & Literature)',
        description: 'Major deity in Hinduism, central figure of the epic Ramayana, historical and philosophical traditions',
        resolvedQuery: `Shri Ram in Indian philosophy, cultural history, and Ramayana literature`,
      },
    ];
  }

  // Pattern: "Apple" without tech/company or fruit context
  const hasApple = /\bapple\b/i.test(clean);
  const hasAppleTech = /iphone|mac|ipad|stock|aapl|inc\b|silicon|ios|company|tech|tim cook/i.test(clean);
  const hasAppleFruit = /fruit|agriculture|orchard|honeycrisp|nutrition|harvest|cider|farming/i.test(clean);
  if (hasApple && !hasAppleTech && !hasAppleFruit && clean.split(/\s+/).length <= 4 && !/record|records|pie|cider/i.test(clean)) {
    return [
      {
        key: 'A',
        label: 'Apple Inc. (Technology Corporation)',
        description: 'Consumer electronics, iPhone, software ecosystems, and market capitalization',
        resolvedQuery: `Apple Inc. technology company ${query}`,
      },
      {
        key: 'B',
        label: 'Apple (Agricultural Fruit)',
        description: 'Malus domestica agricultural fruit cultivation, nutritional metrics, and pomology',
        resolvedQuery: `Apple fruit agriculture production harvest and market prices`,
      },
    ];
  }

  // Pattern: "Mercury" without planetary, chemical, or automotive context
  const hasMercury = /\bmercury\b/i.test(clean);
  const hasMercuryContext = /planet|astronomy|nasa|orbit|space|solar system|chemical|element|hg\b|toxicity|metal|thermometer|ford|car|automobile|insurance/i.test(clean);
  if (hasMercury && !hasMercuryContext && clean.split(/\s+/).length <= 3) {
    return [
      {
        key: 'A',
        label: 'Planet Mercury (Astronomy)',
        description: 'Innermost planet of the Solar System, orbital dynamics, and planetary geology',
        resolvedQuery: `Planet Mercury astronomy geology orbit and planetary exploration`,
      },
      {
        key: 'B',
        label: 'Mercury (Chemical Element / Metal)',
        description: 'Chemical element Hg (atomic number 80), toxicity, industrial uses, and environmental regulation',
        resolvedQuery: `Mercury chemical element Hg toxicity industrial uses environmental regulation`,
      },
    ];
  }

  // Pattern: "Java" without programming or geographical context
  const hasJava = /\bjava\b/i.test(clean);
  const hasJavaContext = /programming|code|jvm|jdk|oracle|language|software|developer|island|indonesia|coffee|beans|geography/i.test(clean);
  if (hasJava && !hasJavaContext && clean.split(/\s+/).length <= 3) {
    return [
      {
        key: 'A',
        label: 'Java Programming Language & JVM',
        description: 'Software development platform, JVM ecosystem, enterprise computing, and JDK releases',
        resolvedQuery: `Java programming language JVM ecosystem enterprise architecture`,
      },
      {
        key: 'B',
        label: 'Java Island (Indonesia / Geography / Coffee)',
        description: 'Indonesian island geography, demographics, history, and coffee production',
        resolvedQuery: `Java island Indonesia geography demographics and history`,
      },
    ];
  }

  // Pattern: "Rust" without programming or corrosion context
  const hasRust = /\brust\b/i.test(clean);
  const hasRustContext = /programming|language|compiler|cargo|borrow|memory safety|crate|code|developer|iron|oxide|corrosion|metal|oxidation|coating|galvaniz|fungus|pucciniales|wheat|crop|cereal/i.test(clean);
  if (hasRust && !hasRustContext && clean.split(/\s+/).length <= 3) {
    return [
      {
        key: 'A',
        label: 'Rust Programming Language',
        description: 'Systems programming language focused on memory safety, concurrency, and performance',
        resolvedQuery: `Rust programming language systems architecture memory safety`,
      },
      {
        key: 'B',
        label: 'Iron Oxide & Corrosion (Chemistry/Materials)',
        description: 'Chemical oxidation of iron and alloys, galvanic corrosion mechanisms, and prevention',
        resolvedQuery: `Rust iron oxide chemical corrosion mechanisms and prevention`,
      },
    ];
  }

  // Pattern: "Jaguar" without animal or automobile context
  const hasJaguar = /\bjaguar\b/i.test(clean);
  const hasJaguarContext = /animal|panthera|species|cat|feline|wildlife|amazon|rainforest|conservation|car|automobile|vehicle|land rover|f-type|xj|sedan|luxury/i.test(clean);
  if (hasJaguar && !hasJaguarContext && clean.split(/\s+/).length <= 3) {
    return [
      {
        key: 'A',
        label: 'Panthera onca (Jaguar Animal & Ecology)',
        description: 'Large felid apex predator native to the Americas, habitat ecology, and conservation',
        resolvedQuery: `Panthera onca jaguar species biology ecology and conservation`,
      },
      {
        key: 'B',
        label: 'Jaguar Cars & Automobile Engineering',
        description: 'British luxury vehicle marque, automotive engineering, electric vehicles, and motorsport',
        resolvedQuery: `Jaguar automobile engineering luxury vehicle lineup history`,
      },
    ];
  }

  return null;
}

/**
 * Analyzes user research query for intent, entity subject, objective, temporal scope,
 * constraints, and domain ambiguity before the planning phase.
 */
export async function analyzeResearchIntent(
  query: string,
  options?: {
    feedback?: string;
    analyticalLens?: string;
    userClarification?: string;
  }
): Promise<ResearchIntent> {
  const effectiveQuery = (query || '').trim();

  // If the user already provided clarification in feedback or userClarification option
  if (options?.userClarification) {
    return {
      originalQuery: effectiveQuery,
      interpretedSubject: options.userClarification,
      researchObjective: `Investigate ${options.userClarification} based on user-clarified intent`,
      ambiguities: [],
      requiresClarification: false,
      clarificationQuestion: null,
      clarificationOptions: [],
      constraints: [],
      temporalContext: 'recent',
      suggestedLenses: ['academic', 'industry'],
    };
  }

  // Check known heuristic ambiguities first
  const knownOptions = checkKnownAmbiguity(effectiveQuery);
  if (knownOptions) {
    return {
      originalQuery: effectiveQuery,
      interpretedSubject: effectiveQuery,
      researchObjective: `Investigate ${effectiveQuery}`,
      ambiguities: [
        `Term in query '${effectiveQuery}' has multiple divergent prominent meanings.`,
      ],
      requiresClarification: true,
      clarificationQuestion: `I found multiple possible meanings for "${effectiveQuery}". Which domain would you like to investigate?`,
      clarificationOptions: knownOptions,
      constraints: [],
      temporalContext: null,
      suggestedLenses: [],
    };
  }

  // Use Gemini LLM for deep semantic intent & context-aware ambiguity detection
  const ai = getAiClient();
  const prompt = `You are a Senior Research Intent Analyzer in an autonomous scholarly research assistant.
Analyze the user's research query to determine the exact intended subject, objective, temporal scope, and whether the query is ambiguous.

User Query: "${effectiveQuery}"
${options?.feedback ? `User Context/Feedback: "${options.feedback}"` : ''}
${options?.analyticalLens ? `Analytical Perspective: "${options.analyticalLens}"` : ''}

CRITICAL AMBIGUITY RULES:
1. Contextual Disambiguation:
   - If the query already provides contextual words that make the intended meaning obvious (e.g., "Recent computer RAM prices in India", "Java memory management", "Research the impact of AI on cybersecurity", "History of cloud computing"), then the meaning IS CLEAR. Set "requiresClarification": false.
   - Do NOT create unnecessary clarification questions when the meaning is obvious from context.
2. Significant Material Ambiguity:
   - ONLY set "requiresClarification": true if the query uses an ambiguous polysemous or acronym term (like "RAM", "Mercury", "Apple", "Python", "Tesla", "Windows", "Corona") in a way that materially branches into completely divergent research domains without sufficient contextual clue.
   - When "requiresClarification" is true, provide 2-3 distinct "clarificationOptions" with key, label, description, and "resolvedQuery".

Return JSON ONLY matching this schema:
{
  "interpretedSubject": "Precise name of the core subject/entity being researched",
  "researchObjective": "1-2 sentence description of what the user wants to learn or establish",
  "ambiguities": ["Specific ambiguity if any, else empty array"],
  "requiresClarification": boolean,
  "clarificationQuestion": "Question to ask user if clarification is needed, else null",
  "clarificationOptions": [
    {
      "key": "A",
      "label": "Option label",
      "description": "Short explanation",
      "resolvedQuery": "Disambiguated query to run"
    }
  ],
  "constraints": ["e.g. specific geography, market, date range, or demographic"],
  "temporalContext": "e.g. historical, 2024-2026 recent, or general",
  "suggestedLenses": ["academic" | "industry" | "patent" | "socio-technical"]
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
    if (parsed && parsed.interpretedSubject) {
      const optionsList: ClarificationOption[] = Array.isArray(parsed.clarificationOptions)
        ? parsed.clarificationOptions.filter((o: any) => o && (o.label || typeof o === 'string')).map((o: any, idx: number) => {
            if (typeof o === 'string') {
              return {
                key: String.fromCharCode(65 + idx),
                label: o,
                description: `Investigate ${o}`,
                resolvedQuery: `${o} ${effectiveQuery}`,
              };
            }
            return {
              key: o.key || String.fromCharCode(65 + idx),
              label: o.label || `Option ${idx + 1}`,
              description: o.description || '',
              resolvedQuery: o.resolvedQuery || o.label || effectiveQuery,
            };
          })
        : [];

      const requiresClarification = Boolean(parsed.requiresClarification) && optionsList.length >= 2;

      return {
        originalQuery: effectiveQuery,
        interpretedSubject: String(parsed.interpretedSubject),
        researchObjective: String(parsed.researchObjective || `Conduct rigorous research on ${effectiveQuery}`),
        ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities : [],
        requiresClarification,
        clarificationQuestion: requiresClarification ? (parsed.clarificationQuestion || null) : null,
        clarificationOptions: requiresClarification ? optionsList : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        temporalContext: parsed.temporalContext || null,
        suggestedLenses: Array.isArray(parsed.suggestedLenses) ? parsed.suggestedLenses : [],
      };
    }
  } catch (err) {
    console.warn("Gemini intent analysis encountered error, applying safe fallback:", err);
  }

  // Safe fallback
  return {
    originalQuery: effectiveQuery,
    interpretedSubject: effectiveQuery,
    researchObjective: `Conduct objective research on ${effectiveQuery}`,
    ambiguities: [],
    requiresClarification: false,
    clarificationQuestion: null,
    clarificationOptions: [],
    constraints: [],
    temporalContext: null,
    suggestedLenses: ['academic', 'general'],
  };
}
