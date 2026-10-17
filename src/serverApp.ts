import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runResearchAgent } from './services/researchAgent';
import { getAiClient } from './services/geminiClient';
import { jsonrepair } from 'jsonrepair';
import {
  researchRateLimiter,
  utilityRateLimiter,
  resolveClientIdentifier,
  validateResearchRequest,
  validateSummarizeRequest,
  validatePlagiarismRequest,
  sanitizeErrorMessage,
  HARD_LIMITS,
} from './services/apiSecurity';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root directory is one level up from src/
const rootDir = path.resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

export const app = express();

// Configure trusted reverse proxies:
// In Cloud Run / GCP environments, the first proxy hop is trusted, correctly populating req.ip
// and discarding client-spoofed X-Forwarded-For headers.
app.set('trust proxy', 1);

// Enforce strict request size limits (1MB body limit prevents payload-bloat abuse)
app.use(express.json({ limit: '1mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: isProd ? 'production' : 'development',
  });
});

// SSE Streaming Research Agent Endpoint
app.post('/api/research/stream', async (req, res) => {
  // 1. Request Body & Full Settings Schema Validation
  const validation = validateResearchRequest(req.body);
  if (!validation.valid || !validation.sanitized) {
    res.status(400).json({ error: validation.error || 'Invalid research request parameters.' });
    return;
  }

  // 2. Cryptographic Identity & Rate Limiting Check
  const clientInfo = await resolveClientIdentifier(req);
  const clientId = clientInfo.identifier;
  const rateLimit = await researchRateLimiter.check(clientId);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded. You have initiated too many concurrent research cycles. Please wait a few minutes.',
      retryAfter: rateLimit.resetSeconds,
    });
    return;
  }

  const { topic, feedback, detailLevel, analyticalLens, settings, userClarification } = validation.sanitized;

  // 3. Setup SSE Stream Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isClientConnected = true;
  const abortController = new AbortController();

  // Enforce server-side execution timeout (hard limit prevents hung operations)
  const executionTimer = setTimeout(() => {
    if (isClientConnected && !res.writableEnded && !res.finished) {
      abortController.abort(new Error(`Research execution timed out. Operation exceeded the maximum server limit of ${HARD_LIMITS.RESEARCH_EXECUTION_TIMEOUT_MS / 1000} seconds.`));
    }
  }, HARD_LIMITS.RESEARCH_EXECUTION_TIMEOUT_MS);

  // Monitor genuine client disconnection via response lifecycle.
  // Note: We MUST NOT abort on req.on('close') because incoming request emits 'close' as soon
  // as the request POST body has been completely consumed by Express, while the response SSE stream is still active.
  // Instead, listen for res.on('close') and verify whether the response was closed prematurely (!res.writableEnded && !res.finished).
  const handleClientDisconnect = () => {
    if (!res.writableEnded && !res.finished) {
      isClientConnected = false;
      clearTimeout(executionTimer);
      abortController.abort(new Error('Client disconnected before response completed.'));
    }
  };

  res.on('close', handleClientDisconnect);

  const sendSSE = (eventObj: any) => {
    if (!isClientConnected || res.writableEnded || res.finished) return;
    try {
      res.write(`data: ${JSON.stringify(eventObj)}\n\n`);
    } catch (writeErr) {
      console.error('Error writing SSE chunk:', writeErr);
    }
  };

  try {
    const paper = await runResearchAgent(
      {
        topic,
        feedback,
        detailLevel,
        analyticalLens,
        settings,
        userClarification,
        abortSignal: abortController.signal,
      },
      (progressUpdate) => {
        sendSSE({ type: 'progress', update: progressUpdate });
      }
    );

    clearTimeout(executionTimer);
    if (!res.writableEnded && !res.finished) {
      sendSSE({ type: 'complete', paper });
      res.end();
    }
  } catch (error: any) {
    clearTimeout(executionTimer);
    if (!res.writableEnded && !res.finished) {
      console.error('Server research error:', error);
      const sanitizedMsg = sanitizeErrorMessage(error);
      sendSSE({
        type: 'error',
        message: sanitizedMsg,
      });
      res.end();
    }
  }
});

// Media / URL Summarization Endpoint
app.post('/api/summarize', async (req, res) => {
  // 1. Request Body Validation
  const validation = validateSummarizeRequest(req.body);
  if (!validation.valid || !validation.sanitized) {
    res.status(400).json({ error: validation.error || 'Invalid URL provided.' });
    return;
  }

  // 2. Cryptographic Identity & Rate Limiting Check
  const clientInfo = await resolveClientIdentifier(req);
  const clientId = clientInfo.identifier;
  const rateLimit = await utilityRateLimiter.check(clientId);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded for summarization requests. Please try again later.',
      retryAfter: rateLimit.resetSeconds,
    });
    return;
  }

  const { url } = validation.sanitized;
  const prompt = `Summarize the content from this URL: ${url}. If it is a YouTube video, provide a detailed summary of the video. If it is an article, provide a summary of the main points.`;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    res.json({ summary: response.text || 'Could not summarize the content.' });
  } catch (error: any) {
    console.error('Summarization server error:', error);
    const sanitizedMsg = sanitizeErrorMessage(error);
    const statusCode = sanitizedMsg.includes('quota') ? 429 : 500;
    res.status(statusCode).json({ error: sanitizedMsg });
  }
});

// Plagiarism & AI Generation Check Endpoint
app.post('/api/plagiarism', async (req, res) => {
  // 1. Request Body Validation
  const validation = validatePlagiarismRequest(req.body);
  if (!validation.valid || !validation.sanitized) {
    res.status(400).json({ error: validation.error || 'Invalid plagiarism payload.' });
    return;
  }

  // 2. Cryptographic Identity & Rate Limiting Check
  const clientInfo = await resolveClientIdentifier(req);
  const clientId = clientInfo.identifier;
  const rateLimit = await utilityRateLimiter.check(clientId);
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded for plagiarism verification. Please try again later.',
      retryAfter: rateLimit.resetSeconds,
    });
    return;
  }

  const { text } = validation.sanitized;
  const prompt = `
Analyze the following text for plagiarism and for signs of being AI-generated. Provide sources if any plagiarism matches are found.
Evaluate the text for AI generation markers (e.g., lack of perplexity, repetitive sentence structures, specific vocabulary typical of LLMs).

"${text}"

Return a JSON response matching:
{
  "plagiarized": boolean,
  "aiGenerated": boolean,
  "aiProbability": number,
  "matches": [
    { "source": string, "url": string, "similarity": number, "explanation": string, "matchedText": string, "severity": "low" | "medium" | "high" }
  ]
}
`;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let raw = response.text || '{}';
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (match) raw = match[1].trim();

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = JSON.parse(jsonrepair(raw));
    }

    res.json(result);
  } catch (error: any) {
    console.error('Plagiarism check server error:', error);
    const sanitizedMsg = sanitizeErrorMessage(error);
    const statusCode = sanitizedMsg.includes('quota') ? 429 : 500;
    res.status(statusCode).json({ error: sanitizedMsg });
  }
});

// Mount Vite in dev or serve static files in prod
export async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise<void>((resolve) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`InsightStream server active on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
      resolve();
    });
  });
}

// Auto-start only when executed as primary entry point (not when imported for integration tests)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('serverApp.ts')
);

if (isMainModule && !process.env.VITEST && !process.env.INSIGHTSTREAM_TEST_MODE) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
