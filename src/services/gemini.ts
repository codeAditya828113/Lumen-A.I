import { auth, signInAnon } from "../lib/firebase";
import { ResearchPaper, OperationType, AgentProgressUpdate, AgentSettings } from "../types";

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Ensures the user has an active Firebase Auth session (signing in anonymously if needed)
 * and retrieves the verified ID token for the Authorization header.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    let currentUser = auth.currentUser;
    if (!currentUser) {
      currentUser = await signInAnon();
    }
    if (currentUser) {
      const token = await currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn('Could not retrieve auth ID token for request:', err);
  }

  // If still missing token, attempt one more explicit anonymous sign-in
  if (!headers['Authorization']) {
    try {
      const anonUser = await signInAnon();
      if (anonUser) {
        const token = await anonUser.getIdToken(true);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (e) {
      console.warn('Failed fallback anonymous sign-in:', e);
    }
  }

  return headers;
}

/**
 * Conducts research via the secure server-side SSE proxy endpoint (/api/research/stream).
 * Keeps Gemini API keys off the client bundle completely.
 */
export async function conductResearch(
  topic: string, 
  feedback?: string, 
  detailLevel: 'brief' | 'standard' | 'detailed' = 'standard',
  analyticalLens?: string,
  onProgress?: (update: AgentProgressUpdate) => void,
  settings?: Partial<AgentSettings>,
  userClarification?: string
): Promise<Partial<ResearchPaper>> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Authentication required: Unable to establish a verified Firebase session. Please check your connection or Firebase configuration.');
  }

  const response = await fetch('/api/research/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic,
      feedback,
      detailLevel,
      analyticalLens,
      settings,
      userClarification,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      parsedMsg = parsed.error || parsed.message || errorText;
    } catch {}
    throw new Error(parsedMsg || `Research request failed with status ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('ReadableStream is not supported in this browser.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalPaper: Partial<ResearchPaper> | null = null;

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
      try {
        const event = JSON.parse(jsonStr);
        if (event.type === 'progress' && onProgress) {
          onProgress(event.update);
        } else if (event.type === 'complete') {
          finalPaper = event.paper;
        } else if (event.type === 'error') {
          throw new Error(event.message || 'An error occurred during research execution.');
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('JSON')) {
          throw err;
        }
      }
    }
  }

  if (buffer.trim().startsWith('data:')) {
    try {
      const event = JSON.parse(buffer.trim().replace(/^data:\s*/, ''));
      if (event.type === 'complete') {
        finalPaper = event.paper;
      } else if (event.type === 'error') {
        throw new Error(event.message || 'An error occurred during research execution.');
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('JSON')) throw err;
    }
  }

  if (!finalPaper) {
    throw new Error('Research completed but no final paper was produced.');
  }

  return finalPaper;
}

export async function summarizeMedia(url: string): Promise<string> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Authentication required: Unable to establish a verified Firebase session.');
  }

  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let msg = errText;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error || msg;
    } catch {}
    throw new Error(msg || 'Summarization failed');
  }

  const data = await response.json();
  return data.summary || 'Could not summarize the content.';
}

export async function checkPlagiarism(text: string): Promise<{
  plagiarized: boolean;
  aiGenerated: boolean;
  aiProbability: number;
  matches: any[];
}> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    throw new Error('Authentication required: Unable to establish a verified Firebase session.');
  }

  const response = await fetch('/api/plagiarism', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let msg = errText;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error || msg;
    } catch {}
    throw new Error(msg || 'Plagiarism analysis failed');
  }

  return response.json();
}
