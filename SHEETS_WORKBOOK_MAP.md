# Google Sheets Workbook Map

This document describes how the app uses its Google Sheets-backed data sources, what each sheet does on its own, and how the sheets work together.

## 1) Workbook Overview

The app currently uses multiple Google Sheets spreadsheets, not just one workbook:

- `TICKET_SPREADSHEET_ID` for grievances, ticket updates, and notification queueing.
- `GOOGLE_SHEETS_DIRECTORY_ID` with fallback to `GOOGLE_SHEETS_INFO_ID` for directory, councils, offices, news, quick links, and student hub content.
- `GOOGLE_SHEETS_AUTH_ID` for student leader access mapping.
- `GOOGLE_SHEETS_INFO_ID` also acts as a fallback content store for news, quick links, and hub guides.

The important design rule is that each spreadsheet owns one domain. The app merges data across tabs only when the tabs represent the same domain.

## 2) How The Sheets Work Together

### Grievance flow

- Students submit a grievance into the `Tickets` sheet.
- Notification processing reads the same ticket row to decide whether status or resolution notes changed.
- The queue processor uses `Ticket_Notification_Queue` to dispatch event-driven updates.
- Optional anonymous update contacts live inside the same `Tickets` row so the notification pipeline can resolve them without a separate lookup.

### Directory and governance flow

- The directory spreadsheet provides officers, councils, institutes, and offices.
- The About page and Hero component reuse that directory data to show council logos and governance bodies.
- The directory API also normalizes and proxies organization logos so the UI can render them safely.

### Leader access flow

- The auth spreadsheet maps allowed leader emails and councils.
- Login and route guards use that mapping to decide who can enter leader-only areas.

### Content flow

- News, quick links, and hub guide content are sheet-driven and read by public APIs.
- Those sheets are designed for content editing, not transactional data.

## 3) Current Live Sheets And Their Structure

### 3.1 Tickets spreadsheet

Environment variable:

- `TICKET_SPREADSHEET_ID`

Primary tab:

- `Tickets`

Purpose:

- Stores all grievance submissions.
- Stores ticket status, resolution notes, and the tracking token hash.
- Stores officer workflow columns and optional anonymous update metadata.
- Serves as the source of truth for ticket tracking and notification sync.

Current column structure used by code:

- A: Ticket_ID
- B: Timestamp
- C: Status
- D: Student_ID
- E: Name
- F: Email
- G: Campus
- H: College_Institute
- I: Category
- J: Subject
- K: Complaint_Narrative
- L: Attachment_URL
- M: Resolution_Notes
- N: Tracking_Token_Hash
- O: Last_Notified_Signature
- P: Last_Notified_At
- Q: Officer_Status_Draft
- R: Officer_Resolution_Draft
- S: Officer_Send_Control
- T: Officer_Updated_By
- U: Officer_Updated_At
- V: Officer_Publish_Note
- W: Officer_Last_Published_At
- X: Officer_Last_Published_By
- Y: Anonymous_Update_OptIn
- Z: Anonymous_Update_Channel
- AA: Anonymous_Update_Destination
- AB: Anonymous_Update_Destination_Status
- AC: Anonymous_Update_Verified_At
- AD: Anonymous_Update_Verified_By
- AE: Anonymous_Update_Last_Notified_At
- AF: Anonymous_Update_Notes

How it is used:

- `app/api/tickets/route.ts` writes new submissions.
- `app/api/tickets/[id]/route.ts` reads ticket status for tracking.
- `lib/tickets.ts` handles lookup, email dispatch, sync, and queue processing.
- Notification sync reads `A2:AF` so it can see both ticket state and workflow metadata.

### 3.2 Ticket notification queue tab

Environment variable:

- `TICKET_NOTIFICATION_QUEUE_SHEET_TAB` with default `Ticket_Notification_Queue`

Purpose:

- Stores queued notification events that were enqueued by Apps Script or other trusted automation.
- Lets the queue processor send updates without scanning the entire sheet for every run.

Current column structure used by code:

- A: Event_ID
- B: Ticket_ID
- C: Publish_Marker
- D: Enqueued_At
- E: Source
- F: Status
- G: Last_Attempt_At
- H: Attempts
- I: Last_Error

How it is used:

- `app/api/tickets/queue/enqueue/route.ts` appends rows.
- `app/api/tickets/queue/process/route.ts` reads pending rows and marks them sent, skipped, or retry.

### 3.3 Directory spreadsheet

Environment variables:

- `GOOGLE_SHEETS_DIRECTORY_ID`
- fallback: `GOOGLE_SHEETS_INFO_ID`

Purpose:

- Provides officers, councils, institutes, and university office directory data.
- Supplies logos, email links, Facebook links, and branch/category metadata.
- Feeds the About page, Hero carousel, and Directory page.

Current tab layout used by code:

Legacy or fallback tabs:

- `Officers` or `OFFICERS`
- `Offices` or `OFFICES`

Workbook tabs used by the current parser:

- `ORGANIZATIONS` or `Organizations`
- `INSTITUTES` or `Institutes`
- `Central Student Councils` or `CENTRAL STUDENT COUNCILS`
- `Supreme Student Council` or `SUPREME STUDENT COUNCIL`
- `Non-Academic Organization` or `NON-ACADEMIC ORGANIZATION` or `Non-Academic Organizations`
- `UNIVERSITY OFFICES` or `University Offices` or `OFFICES` or `Offices`

Current workbook parsing contract:

- Organization tabs are parsed from `A1:H` ranges.
- Office tabs are parsed from `A1:H` ranges.
- The parser reads name, acronym, email, Facebook URL, and logo URL fields, and it tolerates header shifts.
- The API also accepts hyperlinks so logo and contact links can be preserved.

How it is used:

- `app/api/directory/route.ts` merges the tabs into a single directory response.
- `components/Hero.tsx` and `app/about/page.tsx` reuse directory leaders to override council logos.
- `app/directory/page.tsx` renders the searchable directory UI.

### 3.4 Auth spreadsheet

Environment variable:

- `GOOGLE_SHEETS_AUTH_ID`
- optional tab override: `GOOGLE_SHEETS_AUTH_TAB`

Default tab:

- `SL Access!A1:K`

Purpose:

- Maps authorized student leader accounts.
- Controls who can reach leader-only areas and which council they belong to.

Typical columns used by code:

- Email
- Name
- Council
- Last access date or last login field
- Access enabled or status field
- Role / access role field

How it is used:

- `lib/auth.ts` loads and caches the leader map.
- Route guards and leader-only APIs rely on that map when determining access.

### 3.5 Info/content spreadsheet

Environment variable:

- `GOOGLE_SHEETS_INFO_ID`

Purpose:

- Hosts public content sheets used by the homepage and informational sections.
- Acts as a fallback source for several read-only APIs.

Tabs currently read by code:

- `News!A2:Z`
- `QuickLinks!A2:E`
- Student hub / transparency hub guide tabs discovered dynamically

How it is used:

- `app/api/news/route.ts` reads news posts.
- `app/api/config/links/route.ts` reads quick links.
- `app/api/hub/guides/route.ts` discovers and reads guide catalogs for the Student Life Hub.

## 4) Planned Sheets Not Yet In Production Logic

These tabs are part of the current plan, but they should be treated as future additions unless you intentionally implement them:

### 4.1 Ticket_Comments_Appeals

Purpose:

- Stores threaded replies and formal appeals tied to a grievance ticket.

Planned structure:

- A: Comment_ID
- B: Ticket_ID
- C: Timestamp
- D: Author_Email
- E: Author_Role
- F: Message
- G: Attachment_URL
- H: Is_Appeal

Planned behavior:

- Comments are appended per ticket.
- Appeals can move a terminal ticket into an appealed state.
- The tracking page can show a thread below ticket details.

### 4.2 Project_Proposals

Purpose:

- Stores officer / leader project proposal submissions.

Planned structure:

- A: Proposal_ID
- B: Timestamp
- C: Submitter_Email
- D: Council_Name
- E: Project_Title
- F: Description
- G: Document_URL
- H: Status
- I: Officer_Feedback
- J: Last_Updated_At

Planned behavior:

- Proposals are submitted by leader-only users.
- Documents are uploaded to Drive and linked back into the sheet.
- Status changes are tracked independently from grievances.

## 5) Structure Rules To Keep Stable

- Do not reorder columns in the Tickets sheet.
- Do not change the meaning of the notification signature columns `O:P` without updating the sync logic.
- Keep directory tabs stable because the About page and Hero reuse the same council records.
- Treat auth and content sheets as read-mostly; do not mix them with transactional ticket data.
- When adding a new tab, update both the parser and the README / mapping doc together.

## 6) Practical Summary

- Tickets is the transactional sheet for grievances.
- Ticket_Notification_Queue is the delivery queue for ticket update events.
- Directory sheets power council, institute, and office presentation across the app.
- SL Access controls leader-only authentication.
- News, QuickLinks, and Hub guides are public content sheets.
- Ticket_Comments_Appeals and Project_Proposals are planned future tabs, not yet part of the stable runtime contract.
