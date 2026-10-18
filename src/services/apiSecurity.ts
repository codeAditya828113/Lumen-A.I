/**
 * API Security, Abuse Protection, Cryptographic Identity Verification, and Rate Limiting
 * 
 * Enforces:
 * 1. Cryptographic ID-token verification using official Firebase Admin SDK.
 * 2. Mandatory verified Firebase ID tokens on protected API endpoints.
 * 3. Daily request caps and burst sliding-window rate limits per user.
 * 4. Genuinely shared atomic rate limiting (FirestoreRateLimitStore) in production multi-replica environments,
 *    or isolated local store (MemoryRateLimitStore) for single-instance local development and testing.
 * 5. Strict schema validation and volumetric bounds on research parameters.
 */

import type { Request } from 'express';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import type { AgentSettings } from '../types';

// ----------------------------------------------------
// Firebase Admin SDK Cryptographic Authentication & Firestore
// ----------------------------------------------------

let adminApp: App | null = null;
let testTokenVerifier: ((token: string, checkRevoked?: boolean) => Promise<DecodedIdToken | null>) | null = null;

/**
 * Initializes or retrieves the Firebase Admin App instance for cryptographic token verification.
 * Reads configuration strictly from server environment variables with NO hardcoded fallbacks.
 */
export function getFirebaseAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || projectId.trim() === '') {
    throw new Error(
      '[Firebase Admin Configuration Error] Missing FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID). Please configure this environment variable.'
    );
  }

  adminApp = initializeApp({
    projectId: projectId.trim(),
  });
  return adminApp;
}

export function getFirebaseAdminFirestore(): Firestore {
  const app = getFirebaseAdminApp();
  const dbId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID;
  if (dbId && dbId.trim() !== '' && dbId.trim() !== '(default)') {
    return getFirestore(app, dbId.trim());
  }
  return getFirestore(app);
}

/**
 * Cryptographically verifies a Firebase Auth ID token using the Firebase Admin SDK.
 * 
 * Verification guarantees:
 * - Valid cryptographic RS256 signature against Google's live public keys (JWKS).
 * - Exact issuer match: https://securetoken.google.com/<projectId>
 * - Exact audience match: <projectId>
 * - Token is currently unexpired (exp > now).
 * - Token auth timestamp and subject validity.
 * - Optional check for token revocation.
 * 
 * CRITICAL SECURITY INVARIANT:
 * Never parses claims or grants authenticated identity from decoded but unverified tokens.
 * Returns null if verification fails for any reason (tampered signature, expired, wrong issuer, etc.).
 */
export async function verifyFirebaseIdToken(token: string, checkRevoked = false): Promise<DecodedIdToken | null> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }

  // Use test verifier hook if configured in automated tests
  if (testTokenVerifier) {
    return testTokenVerifier(token.trim(), checkRevoked);
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const decoded = await auth.verifyIdToken(token.trim(), checkRevoked);
    return decoded;
  } catch (error) {
    // Verification rejected: invalid signature, expired, revoked, wrong project, or forged token.
    // Unverified claims are NEVER trusted.
    return null;
  }
}

/**
 * Test utility to configure deterministic token verification for automated tests.
 */
export function setTokenVerifierForTesting(
  verifier: ((token: string, checkRevoked?: boolean) => Promise<DecodedIdToken | null>) | null
): void {
  testTokenVerifier = verifier;
}

export function resetTokenVerifierForTesting(): void {
  testTokenVerifier = null;
}

// ----------------------------------------------------
// Mandatory Firebase Authentication Middleware Result
// ----------------------------------------------------

export interface FirebaseAuthResult {
  authenticated: boolean;
  uid?: string;
  decoded?: DecodedIdToken;
  error?: string;
}

/**
 * Validates the Authorization header and cryptographically verifies the Firebase ID token.
 * Returns 401 error details if missing, malformed, expired, or invalid.
 */
export async function requireFirebaseAuth(req: Request, checkRevoked = false): Promise<FirebaseAuthResult> {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      authenticated: false,
      error: 'Missing Authorization header. A valid Firebase ID token is required.',
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Invalid Authorization header format. Format must be "Bearer <firebase_id_token>".',
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      authenticated: false,
      error: 'Empty Bearer token provided in Authorization header.',
    };
  }

  const decoded = await verifyFirebaseIdToken(token, checkRevoked);
  if (!decoded || !decoded.uid) {
    return {
      authenticated: false,
      error: 'Invalid, expired, or forged Firebase ID token. Cryptographic verification failed.',
    };
  }

  return {
    authenticated: true,
    uid: decoded.uid,
    decoded,
  };
}

// ----------------------------------------------------
// Rate Limiting Store & Algorithms
// ----------------------------------------------------

export interface RateLimiterOptions {
  windowMs: number; // e.g., 5 * 60 * 1000 (5 minutes) or 24 * 60 * 60 * 1000 (24 hours)
  maxRequests: number;
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimitStore {
  check(identifier: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> | RateLimitResult;
  reset(identifier?: string): Promise<void> | void;
}

/**
 * In-Memory Sliding Window Rate Limit Store.
 * 
 * Single-Instance Operational Scope:
 * - Operates strictly within the local memory of a single Node.js process.
 * - Suitable for single-instance container deployments, development, and unit/integration testing.
 * - NOTE: Memory state is isolated per container replica and is NOT shared across multiple horizontally
 *   scaled instances. For distributed multi-replica deployments, use FirestoreRateLimitStore.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private windows: Map<string, number[]> = new Map();

  public check(identifier: string, maxRequests: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = this.windows.get(identifier) || [];
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      this.windows.set(identifier, timestamps);
      return {
        allowed: false,
        remaining: 0,
        resetSeconds: Math.max(resetSeconds, 1),
      };
    }

    timestamps.push(now);
    this.windows.set(identifier, timestamps);

    return {
      allowed: true,
      remaining: maxRequests - timestamps.length,
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }

  public reset(identifier?: string): void {
    if (identifier) {
      this.windows.delete(identifier);
    } else {
      this.windows.clear();
    }
  }
}

/**
 * Genuinely Shared Atomic Firestore Rate Limit Store.
 * 
 * Distributed Multi-Instance Architecture:
 * - Uses atomic Firestore database transactions (`runTransaction`) on a dedicated collection.
 * - Guarantees strict cross-replica serialization and atomic sliding window enforcement across any number
 *   of horizontally scaled Cloud Run / Kubernetes container instances.
 * - When database errors occur, fails safely with operational logging rather than bypassing rate limit protection.
 */
export class FirestoreRateLimitStore implements RateLimitStore {
  private collectionName: string;
  private dbGetter: () => Firestore;

  constructor(collectionName = '_rate_limits', customDbGetter?: () => Firestore) {
    this.collectionName = collectionName;
    this.dbGetter = customDbGetter || (() => getFirebaseAdminFirestore());
  }

  private sanitizeDocId(identifier: string): string {
    return identifier.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  public async check(identifier: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const docId = this.sanitizeDocId(identifier);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const db = this.dbGetter();
      const docRef = db.collection(this.collectionName).doc(docId);

      return await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        let timestamps: number[] = [];

        if (snap.exists) {
          const data = snap.data();
          if (Array.isArray(data?.timestamps)) {
            timestamps = data.timestamps.filter((ts: any) => typeof ts === 'number' && ts > windowStart);
          }
        }

        if (timestamps.length >= maxRequests) {
          const oldest = timestamps[0] || now;
          const resetSeconds = Math.max(Math.ceil((oldest + windowMs - now) / 1000), 1);
          transaction.set(docRef, { timestamps, updatedAt: now }, { merge: true });
          return {
            allowed: false,
            remaining: 0,
            resetSeconds,
          };
        }

        timestamps.push(now);
        transaction.set(docRef, { timestamps, updatedAt: now }, { merge: true });

        return {
          allowed: true,
          remaining: maxRequests - timestamps.length,
          resetSeconds: Math.ceil(windowMs / 1000),
        };
      });
    } catch (error) {
      console.error(`[FirestoreRateLimitStore] Database transaction failed for ${identifier}:`, error);
      // Fail safely: return bounded rate limit response to protect downstream systems from unmetered flood
      return {
        allowed: false,
        remaining: 0,
        resetSeconds: Math.ceil(windowMs / 1000),
      };
    }
  }

  public async reset(identifier?: string): Promise<void> {
    try {
      const db = this.dbGetter();
      if (identifier) {
        const docId = this.sanitizeDocId(identifier);
        await db.collection(this.collectionName).doc(docId).delete();
      } else {
        const snap = await db.collection(this.collectionName).get();
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    } catch (error) {
      console.warn('[FirestoreRateLimitStore] Reset error:', error);
    }
  }
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimiter {
  private store: RateLimitStore;
  private windowMs: number;
  private maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.store = options.store || resolveDefaultRateLimitStore();
  }

  public setStore(store: RateLimitStore): void {
    this.store = store;
  }

  public getStore(): RateLimitStore {
    return this.store;
  }

  public async check(identifier: string): Promise<RateLimitResult> {
    return this.store.check(identifier, this.maxRequests, this.windowMs);
  }

  public checkSync(identifier: string): RateLimitResult {
    if (this.store instanceof MemoryRateLimitStore) {
      return this.store.check(identifier, this.maxRequests, this.windowMs);
    }
    throw new Error('checkSync is only available with synchronous MemoryRateLimitStore');
  }

  public async reset(identifier?: string): Promise<void> {
    await this.store.reset(identifier);
  }
}

/**
 * Resolves the appropriate rate limiting backend store based on deployment environment:
 * - Multi-instance Production: FirestoreRateLimitStore for genuinely shared atomic cross-replica synchronization.
 * - Local Development & Automated Tests: MemoryRateLimitStore for zero-dependency local speed.
 */
export function resolveDefaultRateLimitStore(collectionName = '_rate_limits'): RateLimitStore {
  if (process.env.INSIGHTSTREAM_TEST_MODE || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return new MemoryRateLimitStore();
  }

  const isProd = process.env.NODE_ENV === 'production';
  const configuredStore = process.env.RATE_LIMIT_STORE; // 'firestore' | 'memory'

  if (configuredStore === 'firestore' || (isProd && configuredStore !== 'memory')) {
    return new FirestoreRateLimitStore(collectionName);
  }
  return new MemoryRateLimitStore();
}

// ----------------------------------------------------
// Global Rate Limiters & Daily Caps
// ----------------------------------------------------

// Per-user burst rate limits (5-minute sliding window)
export const researchRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 15,
  store: resolveDefaultRateLimitStore('_rate_limits_research'),
});

export const utilityRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  store: resolveDefaultRateLimitStore('_rate_limits_utility'),
});

// Per-user daily request caps (24-hour sliding window)
export const dailyResearchRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 50, // 50 research requests per day
  store: resolveDefaultRateLimitStore('_rate_limits_daily_research'),
});

export const dailyUtilityRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 100, // 100 utility requests per day
  store: resolveDefaultRateLimitStore('_rate_limits_daily_utility'),
});

// ----------------------------------------------------
// Verified Identity & Trusted Proxy Resolution
// ----------------------------------------------------

export interface ClientIdentityResult {
  identifier: string;
  isVerifiedAuth: boolean;
  uid?: string;
  source: 'verified_token' | 'verified_proxy_ip' | 'direct_ip';
}

/**
 * Resolves client identity securely.
 * 
 * Rules:
 * 1. NEVER trusts client-supplied headers like `x-user-id` or unverified user strings.
 * 2. Cryptographically verifies Firebase ID tokens from `Authorization: Bearer <token>` via Firebase Admin SDK.
 * 3. Rejects forged, expired, or tampered tokens, falling through to trusted IP fallback.
 * 4. Resolves IP from `req.ip` configured with trusted reverse proxy (`app.set('trust proxy', 1)`),
 *    preventing spoofed `X-Forwarded-For` prefixes from altering the rate limit bucket.
 */
export async function resolveClientIdentifier(req: Request, checkRevoked = false): Promise<ClientIdentityResult> {
  // 1. Verify Authorization Bearer token cryptographically if present
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const decoded = await verifyFirebaseIdToken(token, checkRevoked);
      if (decoded && decoded.uid && typeof decoded.uid === 'string' && decoded.uid.trim().length > 0) {
        return {
          identifier: `auth_user:${decoded.uid.trim()}`,
          isVerifiedAuth: true,
          uid: decoded.uid.trim(),
          source: 'verified_token',
        };
      }
      // If cryptographic verification fails, we do NOT trust the token or any decoded claims.
    }
  }

  // 2. Fall back to verified IP (NEVER trust x-user-id or raw spoofed x-forwarded-for prefixes)
  let ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7); // normalize IPv4-mapped IPv6
  }

  // Ensure IP is clean and formatted
  const sanitizedIp = ip.replace(/[^a-fA-F0-9.:]/g, '').trim() || '127.0.0.1';

  return {
    identifier: `ip:${sanitizedIp}`,
    isVerifiedAuth: false,
    source: req.ip ? 'verified_proxy_ip' : 'direct_ip',
  };
}

// ----------------------------------------------------
// Request Validation & Settings Schema Enforcement
// ----------------------------------------------------

export interface ValidationResult<T> {
  valid: boolean;
  error?: string;
  sanitized?: T;
}

export const VALID_DEPTHS = ['quick', 'standard', 'deep'] as const;
export const VALID_SOURCE_PREFERENCES = ['general', 'academic', 'authoritative', 'industry'] as const;
export const VALID_DETAIL_LEVELS = ['brief', 'standard', 'detailed'] as const;
export const VALID_ANALYTICAL_LENSES = ['default', 'academic', 'patent', 'socio-technical', 'clinical'] as const;

export const HARD_LIMITS = {
  TOPIC_MAX_LENGTH: 500,
  FEEDBACK_MAX_LENGTH: 1000,
  USER_CLARIFICATION_MAX_LENGTH: 500,
  URL_MAX_LENGTH: 2048,
  PLAGIARISM_MIN_LENGTH: 10,
  PLAGIARISM_MAX_LENGTH: 30000,
  MIN_ITERATIONS: 1,
  MAX_ITERATIONS: 10,
  RESEARCH_EXECUTION_TIMEOUT_MS: 180000, // 3 minutes execution cap
  UTILITY_EXECUTION_TIMEOUT_MS: 30000,   // 30 seconds
};

export function validateResearchRequest(body: any): ValidationResult<{
  topic: string;
  feedback?: string;
  detailLevel: 'brief' | 'standard' | 'detailed';
  analyticalLens: string;
  settings: AgentSettings;
  userClarification?: string;
}> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  // 1. Topic validation
  const rawTopic = body.topic;
  if (!rawTopic || typeof rawTopic !== 'string' || !rawTopic.trim()) {
    return { valid: false, error: 'A non-empty research topic string is required.' };
  }

  const topic = rawTopic.trim();
  if (topic.length > HARD_LIMITS.TOPIC_MAX_LENGTH) {
    return { valid: false, error: `Research topic exceeds maximum length limit of ${HARD_LIMITS.TOPIC_MAX_LENGTH} characters.` };
  }

  // 2. Feedback validation
  let feedback: string | undefined = undefined;
  if (body.feedback !== undefined && body.feedback !== null) {
    if (typeof body.feedback !== 'string') {
      return { valid: false, error: 'Feedback must be a string if provided.' };
    }
    const cleanFeedback = body.feedback.trim();
    if (cleanFeedback.length > HARD_LIMITS.FEEDBACK_MAX_LENGTH) {
      return { valid: false, error: `Feedback exceeds maximum length limit of ${HARD_LIMITS.FEEDBACK_MAX_LENGTH} characters.` };
    }
    feedback = cleanFeedback || undefined;
  }

  // 3. DetailLevel validation
  let detailLevel: 'brief' | 'standard' | 'detailed' = 'standard';
  if (body.detailLevel !== undefined && body.detailLevel !== null) {
    if (!VALID_DETAIL_LEVELS.includes(body.detailLevel)) {
      return { valid: false, error: `detailLevel must be one of: ${VALID_DETAIL_LEVELS.map(d => `"${d}"`).join(', ')}.` };
    }
    detailLevel = body.detailLevel;
  }

  // 4. UserClarification validation
  let userClarification: string | undefined = undefined;
  if (body.userClarification !== undefined && body.userClarification !== null) {
    if (typeof body.userClarification !== 'string') {
      return { valid: false, error: 'userClarification must be a string if provided.' };
    }
    const cleanClarification = body.userClarification.trim();
    if (cleanClarification.length > HARD_LIMITS.USER_CLARIFICATION_MAX_LENGTH) {
      return { valid: false, error: `userClarification exceeds maximum length limit of ${HARD_LIMITS.USER_CLARIFICATION_MAX_LENGTH} characters.` };
    }
    userClarification = cleanClarification || undefined;
  }

  // 5. AnalyticalLens validation
  let analyticalLens = 'default';
  if (body.analyticalLens !== undefined && body.analyticalLens !== null) {
    if (typeof body.analyticalLens !== 'string' || !VALID_ANALYTICAL_LENSES.includes(body.analyticalLens as any)) {
      return { valid: false, error: `analyticalLens must be one of: ${VALID_ANALYTICAL_LENSES.map(l => `"${l}"`).join(', ')}.` };
    }
    analyticalLens = body.analyticalLens;
  }

  // 6. Full Research Settings Schema Validation
  const rawSettings = body.settings;
  const sanitizedSettings: AgentSettings = {
    depth: 'standard',
    maxIterations: 6,
    sourcePreference: 'general',
    recentSourcesOnly: true,
    requireQuantitativeData: false,
  };

  if (rawSettings !== undefined && rawSettings !== null) {
    if (typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
      return { valid: false, error: 'settings must be an object if provided.' };
    }

    // Depth schema validation
    if (rawSettings.depth !== undefined && rawSettings.depth !== null) {
      if (!VALID_DEPTHS.includes(rawSettings.depth)) {
        return { valid: false, error: `settings.depth must be one of: ${VALID_DEPTHS.map(d => `"${d}"`).join(', ')}.` };
      }
      sanitizedSettings.depth = rawSettings.depth;
    }

    // MaxIterations schema validation & hard bounds
    if (rawSettings.maxIterations !== undefined && rawSettings.maxIterations !== null) {
      const num = Number(rawSettings.maxIterations);
      if (!Number.isInteger(num)) {
        return { valid: false, error: `settings.maxIterations must be an integer between ${HARD_LIMITS.MIN_ITERATIONS} and ${HARD_LIMITS.MAX_ITERATIONS}.` };
      }
      if (num < HARD_LIMITS.MIN_ITERATIONS || num > HARD_LIMITS.MAX_ITERATIONS) {
        return { valid: false, error: `settings.maxIterations must be between ${HARD_LIMITS.MIN_ITERATIONS} and ${HARD_LIMITS.MAX_ITERATIONS}. Hard limit exceeded.` };
      }
      sanitizedSettings.maxIterations = num;
    } else {
      // Default iterations based on depth
      sanitizedSettings.maxIterations = sanitizedSettings.depth === 'quick' ? 4 : sanitizedSettings.depth === 'deep' ? 8 : 6;
    }

    // SourcePreference schema validation
    if (rawSettings.sourcePreference !== undefined && rawSettings.sourcePreference !== null) {
      if (!VALID_SOURCE_PREFERENCES.includes(rawSettings.sourcePreference)) {
        return { valid: false, error: `settings.sourcePreference must be one of: ${VALID_SOURCE_PREFERENCES.map(s => `"${s}"`).join(', ')}.` };
      }
      sanitizedSettings.sourcePreference = rawSettings.sourcePreference;
    }

    // RecentSourcesOnly schema validation
    if (rawSettings.recentSourcesOnly !== undefined && rawSettings.recentSourcesOnly !== null) {
      if (typeof rawSettings.recentSourcesOnly !== 'boolean') {
        return { valid: false, error: 'settings.recentSourcesOnly must be a boolean.' };
      }
      sanitizedSettings.recentSourcesOnly = rawSettings.recentSourcesOnly;
    }

    // RequireQuantitativeData schema validation (defaults to false)
    if (rawSettings.requireQuantitativeData !== undefined && rawSettings.requireQuantitativeData !== null) {
      if (typeof rawSettings.requireQuantitativeData !== 'boolean') {
        return { valid: false, error: 'settings.requireQuantitativeData must be a boolean.' };
      }
      sanitizedSettings.requireQuantitativeData = rawSettings.requireQuantitativeData;
    }
  }

  return {
    valid: true,
    sanitized: {
      topic,
      feedback,
      detailLevel,
      analyticalLens,
      settings: sanitizedSettings,
      userClarification,
    },
  };
}

export function validateSummarizeRequest(body: any): ValidationResult<{ url: string }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const rawUrl = body.url;
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'A valid URL string is required.' };
  }

  const url = rawUrl.trim();
  if (url.length > HARD_LIMITS.URL_MAX_LENGTH) {
    return { valid: false, error: `URL exceeds maximum length of ${HARD_LIMITS.URL_MAX_LENGTH} characters.` };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol.' };
    }
    if (!parsed.hostname || parsed.hostname.length < 3 || !parsed.hostname.includes('.')) {
      return { valid: false, error: 'URL must contain a valid domain hostname.' };
    }
  } catch {
    return { valid: false, error: 'Malformed or invalid URL structure.' };
  }

  return {
    valid: true,
    sanitized: { url },
  };
}

export function validatePlagiarismRequest(body: any): ValidationResult<{ text: string }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const rawText = body.text;
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { valid: false, error: 'Text content is required for plagiarism analysis.' };
  }

  const text = rawText.trim();
  if (text.length < HARD_LIMITS.PLAGIARISM_MIN_LENGTH) {
    return { valid: false, error: `Text content must be at least ${HARD_LIMITS.PLAGIARISM_MIN_LENGTH} characters in length.` };
  }

  if (text.length > HARD_LIMITS.PLAGIARISM_MAX_LENGTH) {
    return { valid: false, error: `Text content exceeds maximum length limit of ${HARD_LIMITS.PLAGIARISM_MAX_LENGTH} characters.` };
  }

  return {
    valid: true,
    sanitized: { text },
  };
}

// ----------------------------------------------------
// Error Sanitizer
// ----------------------------------------------------

export function sanitizeErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred during processing.';

  const rawMessage = typeof error === 'string' ? error : error?.message || String(error);

  // Check for quota / rate limit errors
  if (
    rawMessage.includes('429') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    error?.status === 429 ||
    error?.code === 429
  ) {
    return 'You have exceeded the free tier quota for this AI model. Please try again later.';
  }

  // Check for API key / credential errors
  if (
    rawMessage.includes('API_KEY') ||
    rawMessage.includes('apiKey') ||
    rawMessage.includes('credential') ||
    rawMessage.includes('secret')
  ) {
    return 'Authentication error occurred while connecting to the AI service.';
  }

  // Check for timeout errors
  if (rawMessage.includes('timed out') || rawMessage.includes('timeout') || rawMessage.includes('abort')) {
    return 'Research execution timed out or was cancelled by the client.';
  }

  // If message has JSON structure
  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed.error?.code === 429 || parsed.error?.status === 'RESOURCE_EXHAUSTED') {
      return 'You have exceeded the free tier quota for this AI model. Please try again later.';
    }
    if (parsed.error?.message && typeof parsed.error.message === 'string') {
      const msg = parsed.error.message;
      if (!msg.includes('/') && !msg.includes('node_modules') && !msg.includes('GEMINI')) {
        return msg;
      }
    }
  } catch {}

  // Strip file paths, node internals, or stack traces
  if (
    rawMessage.includes('/app') ||
    rawMessage.includes('node_modules') ||
    rawMessage.includes('at ') ||
    rawMessage.includes('Error:')
  ) {
    return 'An internal error occurred during research execution. Please refine your query or try again.';
  }

  return rawMessage.slice(0, 200);
}
