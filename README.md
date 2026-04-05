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
GOOGLE_SHEETS_INFO_ID=
GOOGLE_SHEETS_DIRECTORY_ID=
```

## Localhost Login Simulation (Dev Only)

For safe local auth testing without weakening production auth, enable a local simulation mode:

```env
ENABLE_LOCAL_LOGIN_SIMULATION=true
NEXT_PUBLIC_ENABLE_LOCAL_LOGIN_SIMULATION=true
LOCAL_LOGIN_SIMULATION_TOKEN=choose-a-long-random-dev-token
```

Safety behavior:
- Works only when `NODE_ENV !== production`.
- Requires explicit token match (`LOCAL_LOGIN_SIMULATION_TOKEN`).
- Accepts requests only from localhost hosts (`localhost`, `127.0.0.1`, `::1`).
- Still enforces `@rtu.edu.ph` email domain.

Simulation mode is action-based: you must click `Simulate Local Login` each session, and logout behaves normally.

## Directory Data Sheets

The directory API supports two maintainable sections from a spreadsheet configured by:

- `GOOGLE_SHEETS_DIRECTORY_ID` (preferred, directory-only source)
- fallback: `GOOGLE_SHEETS_INFO_ID`

1. Legacy `Officers` tab (`Officers!A2:G`)
	- A: `id` (optional)
	- B: `name`
	- C: `position`
	- D: `branch`
	- E: `facebookUrl` (optional, must be `https://`)
	- F: `linkedinUrl` (optional, must be `https://`)
	- G: `priority` (optional integer)

2. Legacy `Offices` tab (`Offices!A2:F`)
	- A: `id` (optional)
	- B: `officeName`
	- C: `location`
	- D: `headDirector`
	- E: `email` (optional, valid email)
	- F: `branch`

3. Current workbook-compatible tabs (also supported)
	- `ORGANIZATIONS!A1:G`
	- `INSTITUTES!A1:C`
	- `Central Student Councils!A1:C`
	- `BONI!A1:C`
	- `PASIG!A1:C`
	- `Non-Academic Organization!A1:C`
	- `OFFICES!A1:G`

Behavior notes:
- If `Offices` tab is missing/unavailable, leaders still load normally.
- Invalid rows are skipped and logged; valid rows are returned.
- Header/title rows and category-only rows are auto-skipped for workbook-format tabs.
- Emails wrapped like `<name@domain.com>` are auto-normalized to `name@domain.com`.

## Google Classroom API Integration (Leader Reports)

The app now exposes leader-only Classroom endpoints for report/correspondence workflows.

### Google Cloud setup checklist

1. Create/select a Google Cloud project used by your production OAuth app.
2. Enable APIs:
	- Google Classroom API
	- Google People API (recommended for profile/email reliability)
3. Configure OAuth consent screen:
	- App type: External (or Internal, if your Workspace setup allows it)
	- Add test users during development
	- Add scopes listed below
4. Create OAuth Client ID (Web application) and add redirect URIs:
	- `https://<your-domain>/api/auth/callback/google`
	- `http://localhost:3000/api/auth/callback/google` (dev only)
5. Set environment variables:
	- `AUTH_GOOGLE_ID=<oauth_client_id>`
	- `AUTH_GOOGLE_SECRET=<oauth_client_secret>`
	- `NEXTAUTH_URL=<your_app_origin>` (required in production)
	- `AUTH_SECRET=<strong_random_secret>`
6. In Google Workspace Admin Console, ensure Classroom API access is allowed for your org/users.
7. Re-authenticate existing users (sign out/sign in) so new Classroom scopes are granted.

### Authentication requirements

Google login now requests Classroom scopes:
- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.me`
- `https://www.googleapis.com/auth/classroom.coursework.students`

If users authenticated before this change, ask them to sign out/sign in again to grant new scopes.

### API endpoints

- `GET /api/classroom/courses`
	- Lists active Classroom courses for the signed-in leader (student/teacher membership).

- `GET /api/classroom/courses/:courseId/coursework`
	- Lists coursework items for the selected class.

- `POST /api/classroom/submissions`
	- Submits a report link to a coursework submission.
	- Body:
		```json
		{
			"courseId": "123456789",
			"courseWorkId": "987654321",
			"linkUrl": "https://docs.google.com/document/d/...",
			"linkTitle": "March Transparency Report",
			"turnIn": true
		}
		```

### Security behavior

- Endpoints require authenticated `leader` role.
- IP-based rate limiting is enforced.
- Submission links are validated and must be HTTPS.

### Security regression checks (local)

Run these while local app server is running (`npm run dev`):

- `npm run test:forms-auth-guard`
	- Verifies unauthenticated `/api/forms` requests are blocked and return standardized `{ error: { message, code } }`.
- `npm run test:api-error-envelope`
	- Verifies standardized error envelope shape on key failure paths (`/api/forms`, `/api/webhooks/make`).
- `npm run test:security`
	- Runs both checks.

### Upstash Redis (recommended for production)

For distributed serverless deployments, configure Upstash Redis so rate limits and duplicate-submission guards are shared across instances.

Required environment variables:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Behavior:
- When Upstash vars are present, shared Redis counters are used.
- When Upstash vars are missing, the app falls back to local in-memory limits (acceptable for local dev, weaker for production).

Quick setup:
1. Open your Upstash Redis database.
2. Copy the REST URL and REST token.
3. Add both values to Vercel (or your hosting provider) environment variables.
4. Redeploy.

## Sentry Monitoring (recommended for production)

Sentry is integrated with DSN-gated initialization. If DSN variables are missing, Sentry stays inactive.

Required runtime variables:
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`

Optional build/release variables (for source map upload and release linking):
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Behavior:
- Runtime telemetry initializes only when DSN values exist.
- Source-map upload runs only when auth/org/project values are configured.

Quick setup:
1. Create a Sentry project for this app.
2. Copy DSN into both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
3. (Optional) Add auth token + org + project for release/source-map support.
4. Redeploy and trigger one test error to verify events arrive in Sentry.
