# Production Verification Runbook

Use this after deployment, when you have access to production Google Sheets, Neon Postgres, Vercel environment settings, and controlled test inboxes. These checks intentionally stay out of local automation because they depend on live credentials and production data paths.

## 1. Before You Start

- Confirm you are using the production deployment URL, not a preview URL.
- Use controlled test identities only; do not create test notifications for real student records.
- Have access to:
  - Vercel environment variables
  - Neon production database dashboard or a controlled read-only SQL client
  - `Ticket_Notification_Queue`
  - `Project_Proposal_Notification_Queue`
  - A grievance test inbox and a proposal test inbox
- Keep a short evidence log with timestamps, endpoint responses, queue-row screenshots, and delivered-email screenshots.

## 2. Lost-and-Found Verification

Before launch, confirm `GOOGLE_DRIVE_LOST_FOUND_FOLDER_ID` is present in the production environment and points to a restricted service-account upload folder. Do not publish the folder or use raw Drive links in the UI.

Run one controlled test for each lane:

1. An officer creates a CSO bulletin with one image and verifies it appears under the CSO lane.
2. An RTU test account submits a student report with one image; verify it is absent from public results until an officer changes it to `PUBLISHED`.
3. Verify public item and comment responses contain no submitter email, review notes, or raw Drive URL.
4. Verify the media proxy returns the file only while the linked item is `PUBLISHED` or `RESOLVED`; verify a pending item returns `404`.
5. Verify a video, a renamed non-image file, and an oversized image are rejected before publication; verify a valid JPG, PNG, or WebP is accepted.
6. Verify an officer can mark a listing `RESOLVED` or `ARCHIVED` and the public lane reflects the change.

The CSO lane is manually maintained on the weekly/biweekly cadence until a source feed is formally specified. Do not add a private Sheets read/write path as a shortcut.

## 3. Queue Schema Verification

During the Sheets-to-Neon migration, run the matching queue verification for the active source of truth.

### Sheets-backed queues

Verify both queue tabs exist and match the 14-column contract exactly:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| notificationId | routeId | templateId | dedupeKey | recipientEmail | eventName | payloadJson | priority | status | attempts | maxAttempts | createdAt | processedAt | error |

For each queue tab:

1. Confirm the header row matches the table above with no extra spaces or renamed fields.
2. Append one controlled test row through the normal application flow when possible.
3. Run the matching processor once.
4. Confirm columns `J:N` update as expected after processing.
5. Capture a screenshot or export of the row before and after processing.

### Neon-backed queues

If the queue processor has been cut over to Neon, verify:

1. `DATABASE_URL` is present in Vercel and points to the pooled Neon connection.
2. `DIRECT_URL` is not used by runtime route handlers.
3. `npm run preflight:db` passes in the production environment.
4. `NotificationJob` contains the controlled test job with one unique `dedupeKey`.
5. Processing updates `status`, `attempts`, `processedAt`, and `error` without duplicate sends.

## 4. Database and Export Verification

Confirm production environment variables contain:

- `DATABASE_URL` for runtime pooled Neon access.
- `DIRECT_URL` only where migrations/admin tooling need it.
- `SHEETS_EXPORT_ENABLED` and `SHEETS_EXPORT_SECRET` only if sanitized public exports are enabled.
- `DIRECTORY_SOURCE` set to `db-with-sheets-fallback` for the first directory rollout, then `db` after parity verification.
- `DIRECTORY_EXPORT_SHEET_TAB` set to `Directory Export` unless a reviewed tab name is required.
- `GOOGLE_DRIVE_ORGANIZATION_LOGOS_FOLDER_ID` points to the restricted raster-logo folder.
- `NEXT_PUBLIC_DIRECTORY_CORRECTIONS_EMAIL` set to the approved public correction contact if guidance should render.

Do not log secret values. Record only whether each required variable is present.

Verify sanitized export views before enabling Sheet export:

```sql
select * from public_sheet_news_posts limit 1;
select * from public_sheet_commute_routes limit 1;
select * from public_sheet_directory_entries limit 1;
select * from public_sheet_quick_links limit 1;
select * from public_sheet_hub_guides limit 1;
```

These views must not expose student IDs, private student emails, grievance narratives, tracking token hashes, notification payload JSON, recipient emails, or proposal submitter emails.

### Directory migration and logo verification

1. Run `npm run db:import:directory:dry-run` and compare aggregate organization/office/logo counts. Resolve duplicate, missing-name, or unsupported-logo blockers before writing.
2. Apply `20260806000000_directory_logo_management` with `npm run db:migrate:deploy`; run `npm run preflight:db` and confirm the directory tables, sanitized view, grants, and runtime no-DDL role boundary.
3. Run `npm run db:import:directory:write` for the approved rows, then set `DIRECTORY_SOURCE=db-with-sheets-fallback`.
4. Verify public organization and office response shapes and confirm an active officer can open `/services/admin/directory`.
5. Upload one controlled PNG/JPEG/WebP logo, verify the public proxy serves it, replace it, remove it, and verify the fallback returns. Confirm the old Drive file is trashed only when it belongs to the configured logo folder.
6. Run `npm run db:export:directory:write` with `SHEETS_EXPORT_ENABLED=true`, or wait for `/api/cron/directory-export`. Confirm `Directory Export` columns, deterministic rows, stale-row removal, protected proxy URLs, and absence of private fields.
7. Set `DIRECTORY_SOURCE=db` only after the parity and export checks pass. Keep the source Sheets tabs read-only and do not use them for private dual writes.

## 5. Secret and Cron Verification

Confirm production environment variables contain one valid path for each workflow:

- Tickets: `TICKET_STATUS_SYNC_SECRET` or shared fallback `CRON_SECRET`
- Proposals: `PROPOSAL_STATUS_SYNC_SECRET` or shared fallback `CRON_SECRET`

Do not log secret values. Record only whether each required variable is present.

Use controlled probes against production:

```powershell
$baseUrl = 'https://your-production-domain.example'
$ticketSecret = '<ticket-secret>'
$proposalSecret = '<proposal-secret>'

Invoke-WebRequest "$baseUrl/api/tickets/queue/process?dryRun=1&limit=1" `
  -Headers @{ Authorization = "Bearer $ticketSecret" } `
  -Method Get

Invoke-WebRequest "$baseUrl/api/proposals/queue/process?dryRun=1&limit=1" `
  -Headers @{ Authorization = "Bearer $proposalSecret" } `
  -Method Get

Invoke-WebRequest "$baseUrl/api/tickets/sync-updates" `
  -Headers @{ Authorization = "Bearer $ticketSecret" } `
  -Method Get
```

Expected result:

- Authorized probes return `200`.
- Missing or invalid secrets return `401`.
- A missing production secret returns `500` with a service-misconfigured response and must be fixed before launch.

After the probes pass, allow one scheduled cron cycle to run and capture the successful summary from logs.

## 6. End-to-End Notification Matrix

Run one controlled case through each path below and capture the queue row plus final email delivery:

| Workflow | Event |
| --- | --- |
| Grievance | submission |
| Grievance | admin status or resolution update |
| Grievance | comment |
| Grievance | appeal |
| Proposal | submission |
| Proposal | admin review or status update |
| Proposal | comment |

For each event, verify:

1. A queue row is created with the expected `eventName`, `routeId`, and recipient.
2. The first processing pass sends or retries exactly once as expected.
3. Reprocessing the same dedupe key does not create a duplicate delivery.
4. Final email content reaches the intended controlled inbox.
5. Any failed delivery leaves a useful retry/error trail instead of silently disappearing.

## 7. Cross-Browser Sweep

Check the tuned glow/backlight surfaces called out in `launch_final_check.md` on:

- Chrome
- Edge
- Safari
- One mobile viewport

Record whether you see:

- hover banding
- glow clipping
- compositing artifacts
- layout jumps

## 8. Go / No-Go Exit Criteria

You can mark the manual launch bucket complete only when all of the following are true:

- Both queue tabs match the 14-field schema.
- Neon env vars and Prisma migration state are correct for any DB-backed workflow.
- Sanitized Sheet exports are disabled or verified against `public_sheet_*` views.
- Directory import parity, one controlled logo lifecycle, protected cron export, and the `DIRECTORY_SOURCE=db` cutover have passed.
- Ticket and proposal cron authentication work in production.
- Authorized probes succeed and unauthorized probes fail.
- The end-to-end notification matrix passes without duplicate sends.
- Cross-browser artifact checks are documented.
- Any dead-letter or retry behavior observed during testing is understood and acceptable.
