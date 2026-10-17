import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
let mockAiClientInstance: any | null = null;

/**
 * Initializes and returns the shared GoogleGenAI client singleton on the server.
 * Uses process.env.GEMINI_API_KEY securely from server-side environment variables.
 * Never exposes the API key to the client bundle or browser globals.
 */
export function getAiClient(): GoogleGenAI {
  if (mockAiClientInstance) {
    return mockAiClientInstance;
  }

  if (typeof window !== 'undefined') {
    throw new Error(
      "Gemini AI client cannot be initialized in the browser bundle for security reasons. " +
      "Use server-side proxy endpoints (/api/research, /api/summarize, /api/plagiarism)."
    );
  }

  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not defined in server environment variables. " +
        "Please configure GEMINI_API_KEY in your environment or Secrets panel."
      );
    }
    aiClient = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

/**
 * Allows setting a mock AI client instance for integration testing at the service boundary.
 * Prevents unnecessary API calls, quota usage, and external network costs.
 */
export function setAiClientForTesting(client: any): void {
  mockAiClientInstance = client;
}

/**
 * Resets the AI client to default initialization.
 */
export function resetAiClient(): void {
  mockAiClientInstance = null;
  aiClient = null;
}
