# ClearClause

> **Understand the fine print before you sign.**

ClearClause is an AI-assisted contract intelligence application that helps people turn long, difficult PDF agreements into structured, understandable insights. It highlights potentially important clauses, supports grounded questions about an analyzed document, and compares two contracts side by side.

[Live demo](https://clearclause-six.vercel.app) · [Repository](https://github.com/Houria-hs/CWThackathon-teamOdin)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Playwright](https://img.shields.io/badge/Tested%20with-Playwright-2EAD33?logo=playwright&logoColor=white)

## What is ClearClause?

Contracts are often dense, technical, and time-consuming to review. ClearClause uses AI to turn extracted contract text into clearer, structured insights so users can identify important terms and ask better questions before signing.

ClearClause provides **informational contract analysis**. It is not a law firm and does not replace advice from a qualified legal professional.

## Core features

### AI-powered contract analysis

- Upload a PDF contract for text extraction and clause-by-clause analysis.
- Review detected clauses with risk levels and plain-language explanations.
- Export a review of identified risky clauses as a PDF.

### Document intelligence and Ask ClearClause

- Authenticated users can open a dedicated Ask ClearClause workspace for an analyzed document.
- Ask natural-language questions using the document's extracted text and saved clause analysis as context.
- Start from suggested questions, view conversation history during the browser session, and use keyboard-friendly question input.
- Answers include relevant clause references when available and explicitly avoid inventing terms not supported by the document.
- When the AI provider is rate-limited, the API returns a document-grounded fallback rather than a fabricated answer.

### Compare Contracts

- Upload **Contract A** and **Contract B** as PDFs (up to 10 MB each).
- Compare only categories identified in the supplied contracts, such as termination, liability, payment, renewal, intellectual property, confidentiality, dispute resolution, or governing law when present.
- Receive a structured overall assessment, category-by-category differences, source excerpts, advantages, and tradeoffs.
- Review a responsive side-by-side desktop layout or stacked mobile comparison cards.
- Comparison results are informational and do not constitute legal advice.

### Secure account flow

- Registration with email verification.
- Unverified accounts cannot receive a JWT or log in.
- One-time verification tokens are cleared after successful use.
- JWT-protected API routes and authenticated onboarding.
- Owner-scoped document metadata, analysis, and Ask ClearClause access.

### Privacy-focused processing

ClearClause follows a **zero-retention policy for uploaded source files**: temporary PDF uploads are deleted after extraction or comparison processing.

This does **not** mean the application retains no data at all. For signed-in document intelligence features, ClearClause currently stores the extracted text, filename/metadata, and clause analysis in the `documents` table so the owning user can revisit analysis and use Ask ClearClause. These records are associated with the authenticated owner and are protected by ownership checks. The current comparison endpoint processes the two uploaded contracts and returns a result without creating a comparison database record.

## How it works

1. Create an account.
2. Verify the email address from the verification link.
3. Log in and complete onboarding.
4. Upload a PDF contract.
5. ClearClause extracts its text, deletes the temporary source file, and analyzes the available clauses.
6. Review detected risks and explanations, or ask document-grounded questions in Ask ClearClause.
7. When comparing alternatives, open **Compare Contracts** and upload Contract A and Contract B.

## Tech stack

| Area | Technologies used |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS, Axios |
| Backend | Node.js, Express, Multer, Nodemailer |
| Data | PostgreSQL via `pg`; Supabase-compatible database; Prisma schema and migrations |
| AI | Google Gemini (`@google/generative-ai`) |
| Document processing | `pdf.js-extract`, `@react-pdf/renderer` |
| Authentication | bcrypt, JSON Web Tokens |
| Testing | Playwright |

## Architecture overview

```text
React + Vite frontend
        |
        |  JWT-authenticated HTTP requests
        v
Express API
  |-- Authentication and email verification
  |-- PDF upload and text extraction
  |-- Gemini clause analysis / grounded document Q&A / contract comparison
  |-- Ownership checks and input validation
        |
        v
PostgreSQL (users and authenticated document intelligence data)
```

- The frontend uses `VITE_API_URL` for every API request.
- The backend keeps Gemini credentials, database credentials, email credentials, and JWT signing secrets server-side.
- Temporary source files are stored only while being extracted and are removed by the processing routes.

## Security and privacy

- JWT verification protects upload, analysis, document metadata, Ask ClearClause, and comparison endpoints.
- Email verification is required before a login token can be issued.
- Document queries include the authenticated user ID, preventing one user from reading or asking questions about another user's document.
- Comparison requires authentication and validates both uploaded PDFs, including file size and PDF signature checks.
- Empty questions and questions over 1,000 characters are rejected.
- CORS is configured from `CLIENT_URL`; email verification and post-verification redirects use environment-specific backend and client URLs.
- API keys are never sent to the browser.
- Uploaded PDF source files are deleted after extraction/processing. Extracted text and analysis are retained only for authenticated document intelligence as described above.

## Testing

Browser and API flows are tested with Playwright from `frontend/tests`.

| Suite | Coverage |
| --- | --- |
| `auth.spec.js` | Registration, email verification, one-time tokens, blocked unverified login, JWT handling, onboarding, duplicate users, and missing tokens |
| `ask-clearclause.spec.js` | Owner-scoped document access, protected Q&A, invalid input, AI quota fallback, and provider failure behavior |
| `ask-clearclause-ui.spec.js` | Upload to analysis to dedicated Ask ClearClause navigation, suggested questions, mobile behavior, and React lifecycle regression coverage |
| `compare-contracts.spec.js` | Authenticated comparison, missing/invalid/oversized files, AI failure handling, responsive results, centered layout, and no horizontal overflow |

The Playwright configuration starts the frontend and backend in `NODE_ENV=test`; the backend uses its test-only in-memory database adapter for these flows.

## Project structure

```text
ClearClause/
├── backend/
│   ├── config/                 # database and environment configuration
│   ├── controllers/            # authentication controller
│   ├── middleware/             # JWT middleware
│   ├── prisma/                 # schema and migrations
│   ├── routes/                 # auth, PDF, document, and comparison APIs
│   └── services/               # Gemini analysis, Q&A, and comparison services
├── frontend/
│   ├── src/components/         # analysis and reusable UI components
│   ├── src/pages/              # routed product experiences
│   └── tests/                  # Playwright end-to-end and API-flow tests
└── README.md
```

## Local development

### Prerequisites

- Node.js 18 or later
- npm
- A PostgreSQL/Supabase database
- A Google Gemini API key
- An email account/app password for verification emails

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure the backend

Copy `backend/.env.example` to `backend/.env`, then provide local values:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
DATABASE_URL=your_postgres_connection_string
JWT_SECRET=replace_with_a_secure_random_secret
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Apply the included document migration before using authenticated document intelligence:

```bash
cd backend
npx prisma migrate deploy
```

Start the API:

```bash
npm start
```

For automatic restart during development, use `npm run dev`.

### 3. Configure the frontend

Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Start Vite in a second terminal:

```bash
cd frontend
npm run dev
```

### 4. Run checks and tests

```bash
cd frontend
npm run build
npx playwright test --project=chromium
```

## Environment variables

### Backend

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment, such as `development` or `production` |
| `PORT` | API port; defaults to `5000` when omitted |
| `CLIENT_URL` | Absolute frontend URL used for CORS and verification redirects |
| `BACKEND_URL` | Absolute backend URL used in verification email links |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `EMAIL_USER` | Email sender account for verification messages |
| `EMAIL_PASS` | Email app password for the sender account |
| `GEMINI_API_KEY` | Server-side Google Gemini API credential |
| `GEMINI_MODEL` | Optional primary Gemini model override; defaults to `gemini-2.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Optional Ask ClearClause fallback model when the primary is rate-limited |

### Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Absolute backend API origin used by the Vite client |

For production, configure the same variable names in the deployment environment with production URLs. The included `.env.example` files show the current local and deployment URL conventions; do not commit real credentials.

## Roadmap

Planned ideas, not currently implemented:

- User-controlled deletion of stored document intelligence data.
- A document library and historical comparison results.
- More export formats and review-sharing workflows.
- Expanded support for additional document formats and OCR quality controls.

## Disclaimer

**ClearClause provides informational contract analysis and is not a law firm or a substitute for advice from a qualified legal professional.**
