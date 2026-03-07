# Office of the Student Regent (OSR) - Headless Architecture

This repository holds the Phase 1 Headless Architecture for the OSR Portal. It consumes Google Slides and Google Sheets as its primary database (CMS) while ensuring enterprise-grade security, scalability, and strict component isolation.

## Core Architecture
- **Framework:** Next.js (App Router)
- **Language:** TypeScript (Strict interface boundaries)
- **Styling:** Tailwind CSS / Framer Motion
- **CMS Validation:** `zod` (Strict schema validation on incoming Google Data)
- **Security:** `isomorphic-dompurify` (XSS Prevention)

## Security Guidelines
1. **Never use `NEXT_PUBLIC_` for service keys.** All Google credentials must remain server-side in `.env.local`.
2. **Hydration Leak Prevention:** Filtering of draft or sensitive slides occurs *server-side* within `SlideParser.tsx` or `google.ts`.
3. **CORS:** The Next.js API configuration strictly rejects traffic outside of approved OSR domains (`next.config.mjs`).
4. **Vercel Image Abuse:** Remote image patterns only permit `*.googleusercontent.com`.

## Component Driven Design
- **`app/page.tsx`**: The "dumb" UI layer. It does not parse or validate data; it only passes props to rendering components.
- **`components/SlideParser.tsx`**: Responsible for taking raw API payloads, checking for draft statuses, sanitizing rich text, and translating data into Tailwind HTML.
- **`lib/google.ts`**: The strict data fetching layer. Responsible for enforcing Zod schemas on external API responses and mapping them to internal TypeScript definitions.

## Environment Variables Needed
```env
GOOGLE_SERVICE_ACCOUNT_TYPE=
GOOGLE_SERVICE_ACCOUNT_PROJECT_ID=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_CLIENT_ID=
GOOGLE_SERVICE_ACCOUNT_AUTH_URI=
GOOGLE_SERVICE_ACCOUNT_TOKEN_URI=
GOOGLE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL=
GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL=
GOOGLE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN=
GOOGLE_SLIDES_ID=
```
