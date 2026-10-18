# Lumen AI — Autonomous Deep Research Agent & Scholarly Synthesis Engine

Lumen AI is an autonomous, multi-stage deep research platform and scholarly intelligence agent. It conducts iterative web grounding, epistemic evidence verification, multi-source conflict reconciliation, and academic paper generation with live Server-Sent Events (SSE) streaming and interactive 3D concept visualization.

---

## Key Features

- **Autonomous Multi-Stage Research Agent**:
  - Dynamically formulates search queries, extracts multi-source evidence, evaluates source authority tiers, and synthesizes balanced scholarly reports.
  - Multi-perspective analytical lenses: Standard Academic, Patent Prior-Art, Socio-Technical, and Clinical Evaluation.
  - Real-time Server-Sent Events (SSE) progress streaming directly to the browser.
- **Epistemic Truth & Conflict Verification**:
  - Detects directional contradictions and claims unsupported by factual evidence.
  - Mitigates false consensus and single-source bias through multi-source corroboration.
- **Scholarly Export Suite**:
  - Export structured research papers to **PDF**, **DOCX (Microsoft Word)**, and **LaTeX**.
  - Interactive data charts (Recharts) and interactive 3D concept models (Three.js / React Three Fiber).
- **Multimedia Summarization & AI Plagiarism Analysis**:
  - YouTube video and article summarization powered by Google Search grounding.
  - Plagiarism detection and AI-generation probability scoring.
- **Production-Grade Security & Access Control**:
  - Cryptographic ID-token verification via the official **Firebase Admin SDK** (RS256, audience, issuer, expiry).
  - Sliding-window burst rate limiters and daily request caps per user.
  - Distributed multi-replica rate limiting support via atomic **Cloud Firestore** transactions, with memory-backed isolation for local development and unit tests.
  - Zero client-side API secret leakage: all LLM interactions are proxied through authenticated server endpoints.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion (Framer Motion), Lucide Icons, Recharts, Three.js / React Three Fiber.
- **Backend**: Node.js, Express, tsx, Firebase Admin SDK.
- **AI & Intelligence**: `@google/genai` (Gemini 3.8 Flash) with real-time Google Search grounding.
- **Database & Auth**: Google Cloud Firestore & Firebase Authentication (Google OAuth & Anonymous Sessions).
- **Document Generation**: `docx`, `jspdf`, `html-to-image`, `date-fns`.

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x`+
- A Google account to obtain API credentials (Gemini & Firebase).

---

## Getting API Keys & Credentials

### 1. Gemini API Key
1. Navigate to [Google AI Studio](https://aistudio.google.com/apikey).
2. Sign in with your Google account.
3. Click **"Create API key"** and copy your generated key.
4. Set this as `GEMINI_API_KEY` in your environment file.

### 2. Firebase Credentials & Firestore Database
1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Under **Project Settings > General > Your Apps**, click **Web (`</>`)** to register a web app.
3. Copy the configuration fields:
   - `apiKey` &rarr; `VITE_FIREBASE_API_KEY`
   - `authDomain` &rarr; `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` &rarr; `VITE_FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_ID`
   - `storageBucket` &rarr; `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` &rarr; `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` &rarr; `VITE_FIREBASE_APP_ID`
   - `measurementId` &rarr; `VITE_FIREBASE_MEASUREMENT_ID`
4. Enable **Authentication** in the Firebase Console:
   - Go to **Build > Authentication > Sign-in method**.
   - Enable **Anonymous** (required for instant guest research sessions).
   - (Optional) Enable **Google** sign-in for cross-device research history synchronization.
5. Enable **Cloud Firestore**:
   - Go to **Build > Firestore Database** and click **Create database**.
   - Deploy security rules using `firestore.rules` provided in this repository.

---

## Quickstart & Local Setup

### 1. Clone the repository and install dependencies
```bash
git clone https://github.com/your-username/lumen-ai.git
cd lumen-ai
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env` or `.env.local`:
```bash
cp .env.example .env.local
```
Open `.env.local` and fill in your Gemini and Firebase credentials:
```env
# Gemini AI
GEMINI_API_KEY="AIzaSy..."

# Firebase Server Config (Firebase Admin SDK)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_DATABASE_ID="(default)"

# Firebase Client Config (Vite)
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef"
VITE_FIREBASE_DATABASE_ID="(default)"

# Runtime Settings
PORT=3000
NODE_ENV="development"
RATE_LIMIT_STORE="memory"
```

### 3. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Build & Deployment

### Build the frontend
```bash
npm run build
```
This compiles the client application into the `dist/` directory.

### Start the production server
```bash
npm run start
```
The server will serve static assets from `dist/` and handle authenticated `/api/*` endpoints.

### Multi-Instance Production Deployment (Cloud Run / Kubernetes)
When running across multiple container instances or autoscaled replicas:
1. Set `RATE_LIMIT_STORE=firestore` in your runtime environment variables.
2. Grant the Cloud Run service account the **Cloud Datastore User** role (`roles/datastore.user`) so the Admin SDK can read and update rate limits in `_rate_limits_*` collections atomically.
3. Ensure `trust proxy` is set in Express (already configured for single-hop proxy forwarding).

---

## Testing & Verification

Run the comprehensive test suite (unit tests, security assertions, and integration tests with mocked Gemini provider):
```bash
npm test
```

Run TypeScript verification:
```bash
npm run lint
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Credits & Attribution

Lumen AI was created by Aditya Kumar (GitHub: [codeAditya828113](https://github.com/codeAditya828113)). If you use or build on this project, please keep the copyright notice in LICENSE and credit the original author and link back to this repository.

