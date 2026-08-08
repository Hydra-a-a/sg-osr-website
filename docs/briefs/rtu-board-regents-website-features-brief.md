# RTU Student Government Portal

## Feature Brief for the RTU Board of Regents

Prepared for presentation through the Student Regent
Repository-grounded status as of May 28, 2026

### Purpose

This document summarizes the website features currently implemented in the RTU Student Government Portal and distinguishes them from features that are intentionally staged, locked, or still in controlled rollout. The goal is to give the Board of Regents a clear view of what the portal already delivers for students, what is being prepared for wider use, and how the platform supports accountable digital student governance.

### Executive Summary

The RTU Student Government Portal is no longer only an informational website. It already functions as a student-facing service platform with secure intake, tracking, role-based governance tools, content publishing, and operational workflows for the Office of the Student Regent and related student-government units.

At present, the portal already provides:

- public information pages for student governance, campus contacts, news, and student resources;
- secure student grievance intake and tracking;
- project proposal submission and follow-through for student leaders and officers;
- a student hub for guides, academic references, and commuter support;
- an officer-only administration area for case review, proposal review, and commuter-route moderation; and
- security controls designed for student data protection, controlled access, and auditable updates.

Some features are visible but intentionally not yet fully opened to the public. This is not due to absence of planning; rather, these modules are being staged carefully so that published information remains accurate, authorized, and operationally maintainable.

### Currently Running Features

#### 1. Public-facing information and navigation

The portal already provides a complete public-facing structure for student access and discovery. Students can navigate the home page, services pages, news, transparency, student-government pages, directory pages, login, and student hub from one unified navigation system.

Current live pages and sections include:

- Home page with portal entry points and active announcements;
- Student Government hub;
- Office of the Student Regent page;
- Constitutional commissions and councils pages;
- News and Updates page;
- Transparency page;
- Directory entry point plus separate directories for student organizations and university offices;
- Services hub plus service-specific workspaces;
- Student Hub plus commuter utilities; and
- Login page for authenticated portal use.

This means the website already serves as a single digital front door for both information access and student transactions.

#### 2. Office of the Student Regent representation pages

The Student Government section already presents the governance structure in a student-readable way. The portal currently includes:

- a dedicated Office of the Student Regent page explaining the office mandate, mission, and representation role;
- a consolidated student-government hub linking the OSR, constitutional commissions, and councils;
- pages for commissions and councils so students can understand how representation is organized; and
- an OSR announcements section for office updates and advocacy visibility.

This helps translate governance structure into a more accessible public service interface.

#### 3. News and communications

The website already includes a live News and Updates section. Based on the implemented content pipeline, the portal can surface article-style updates sourced from official student-government Facebook pages and display them in a website-friendly format.

Operationally, the portal also supports:

- news synchronization workflows;
- homepage and OSR announcement surfacing;
- structured article titles, body text, tags, and images; and
- public browsing of official updates in one location.

This reduces dependence on social-media-only communication and improves institutional continuity of announcements.

#### 4. Directory and contact access

The portal already provides a split directory model so students can look up the correct office or organization without confusion.

Running directory capabilities include:

- a top-level directory gateway;
- a student-organization directory for recognized councils, commissions, and organizations;
- a university-office directory for administrative and academic offices;
- grouped contact presentation rather than one mixed list;
- support for names, locations, official contacts, and social/contact handles; and
- a logo pipeline for directory presentation.

This is useful not only for convenience but also for reducing misrouting of student concerns.

#### 5. Student grievance intake

One of the most significant live systems in the portal is the grievance workflow. The grievance form is not merely a contact form; it is a structured digital intake process.

Current live grievance features include:

- authenticated submission using RTU accounts;
- optional anonymous submission mode;
- optional anonymous update contact using a separate email channel;
- campus, college, category, subject, and narrative fields;
- attachment support for documentary or image evidence;
- evidence guidance and warning when filing without proof;
- privacy-act acknowledgement before submission;
- secure ticket ID generation for follow-up;
- post-submission tracking link support; and
- backend processing for storage, status changes, and update notifications.

This means the portal is already capable of receiving formal student concerns in a more organized and privacy-aware manner than informal messaging channels.

#### 6. Grievance tracking, follow-up, and appeals

The grievance workflow continues after filing. The tracker page is already implemented as a secure case workspace.

Live tracking features include:

- student-side case history for signed-in users;
- manual lookup by ticket ID;
- access-token support for protected lookups;
- privacy-redacted views when ownership is not verified;
- visible case progress stages;
- official resolution-note display;
- threaded follow-up discussion;
- formal appeal submission inside the case workspace; and
- follow-up attachment support for added documentation.

This gives students a clearer due-process path after filing and reduces the risk that concerns disappear into untracked inboxes.

#### 7. Project proposal submission

The portal also already supports a structured program and project proposal workflow for student leaders and officers.

Current live proposal features include:

- proposal submission form for eligible users;
- project title, type, and executive summary fields;
- category tagging using the United Nations Sustainable Development Goals;
- PDF document upload;
- submission confirmation with tracker ID;
- proposal tracking access token support; and
- routing to review workflows after submission.

This allows program proposals to move through a more accountable digital pipeline instead of depending on scattered email exchanges alone.

#### 8. Proposal tracking and review loop

The proposal module does not stop at submission. A separate tracker is already live for follow-through and reviewer communication.

Implemented proposal-tracking features include:

- proposal history tied to the signed-in user;
- manual tracker lookup by proposal ID;
- detailed proposal summary view;
- visible review timeline;
- reviewer notes and status display;
- comment thread between submitter and reviewers;
- optional attachments in the discussion loop; and
- support for statuses such as pending review, under review, needs revision, approved, and rejected.

This creates a digital record of proposal handling and improves process transparency for student organizations.

#### 9. Student Hub and academic-resource tools

The Student Hub is already functioning as more than a static resource page. It includes:

- published student guides and PDF previews;
- featured references;
- academic calendar access with enlarged viewing;
- quick actions for major student resource functions; and
- controlled visibility so leader-only materials do not appear to general users when they should not.

This gives students a central place for official references and academic-support materials.

#### 10. Commuter support and local-guide routing

The commuter module is already one of the more distinctive student-facing utilities in the portal.

Current live commuter features include:

- route search by origin and destination;
- travel preference modes such as fastest, cheapest, and fewest transfers;
- fare and duration estimates;
- map-supported route presentation;
- preset destinations for common RTU travel patterns;
- saved routes and recent searches on the student side;
- route sharing and copying;
- community voting on route usefulness;
- issue reporting and update suggestions for published routes;
- a route-contribution page for community submissions; and
- a leaderboard page for local commuter guides.

This positions the portal as a practical day-to-day service platform, not only a governance site.

#### 11. Officer-only administration tools

The services administration area is already implemented for authorized officers. It serves as an operations deck rather than a public page.

Current live administration capabilities include:

- grievance-ticket management;
- project-proposal review access;
- community-route moderation access; and
- separation of officer tools from public student views.

The codebase and test coverage also show an intentional boundary: some controls remain backend-only rather than being exposed casually in the interface. This is a positive governance and security practice.

#### 12. Transparency intake workflow

The transparency page is already live and already includes a controlled submission channel for authorized student leaders through Google Classroom integration.

Current live transparency-related capabilities include:

- public-facing transparency landing page;
- defined record categories for future public posting;
- leader-authenticated Google Classroom report submission;
- course and coursework selection for authorized leaders;
- secure submission of report links; and
- support for turning in assigned transparency outputs through the integrated workflow.

This means the intake side of the transparency process is already in place.

#### 13. Security, access control, and operational safeguards

The portal is built with multiple safeguards that matter for student-government operations. Based on the repository, the running platform already includes:

- Google-based authentication through RTU accounts;
- role-aware access for students, leaders, and officers;
- validation of untrusted input;
- rate limiting and anti-abuse controls;
- same-origin protections for write actions;
- privacy-aware redaction behavior for protected case records;
- queue-based update processing for notifications;
- email notification workflows for grievance and proposal updates;
- logging and monitoring support through Sentry; and
- regression tests focused on security, access control, and sensitive-route behavior.

This is important because the portal is handling more than static content. It is already processing service interactions and student records that require caution.

### Features in Planned, Staged, or Controlled Rollout Status

The following features are visible in the portal or supported in the codebase, but are intentionally not yet fully opened as public fully-live modules.

#### 1. Public transparency record publication

The transparency page currently presents record categories such as financial statements, board resolutions, and minutes of meetings. However, these are still marked as pending publication.

What is already live:

- the transparency landing page;
- the workflow for authorized leaders to submit materials through Google Classroom; and
- the page structure for published records.

What remains staged:

- the public display of approved transparency records after the publishing workflow is fully enabled and records are cleared for release.

This is best understood as a controlled rollout of publication, not an absent feature.

#### 2. Campus wayfinding

The Student Hub contains a campus wayfinding action that is intentionally locked. The repository explicitly explains that office relocations caused by renovation and construction make a live campus map unreliable at this time.

What this means:

- the feature has already been planned at the product level;
- the portal already contains the user-facing placeholder and explanatory notice; and
- public activation is being delayed to avoid publishing inaccurate directional information.

This is a responsible staging decision.

#### 3. Continued expansion of community commute data

The commuter module is already operational, but part of its long-term value depends on continued route contributions, officer moderation, and ongoing validation.

What is already live:

- route search;
- route contribution;
- route voting;
- issue reporting; and
- moderation entry points.

What remains ongoing:

- expanding route coverage;
- keeping route guidance fresh; and
- increasing quality through community and officer review.

This should be seen as a live service with a growing knowledge base.

### Institutional Value of the Portal

For the Board of Regents, the significance of the portal is not only technical. The current implementation already supports several governance outcomes:

- better visibility of the Office of the Student Regent and student-government structure;
- more formalized handling of grievances and student concerns;
- more traceable submission and review of student proposals;
- improved access to official contacts and student resources;
- stronger continuity of official announcements outside social-media feeds;
- groundwork for transparency publication; and
- a more service-oriented digital presence for student governance.

In practical terms, the portal is already functioning as a student-government operations and communication platform, while still leaving room for staged release of higher-sensitivity publication modules.

### Recommended Presentation Framing

For presentation to the Board of Regents, the portal may be framed in three simple messages:

1. The website is already operational as a student-service and governance platform, not only an information page.
2. High-impact workflows such as grievance intake, proposal review support, commuter guidance, and role-based administration are already running.
3. Sensitive public-facing modules, especially transparency publication and campus wayfinding, are being rolled out carefully to protect accuracy, authorization, and trust.

### Closing Note

Based on the current repository, the RTU Student Government Portal already demonstrates meaningful progress toward a secure, service-oriented, and governance-aware digital platform for students. Its next phase is less about starting from zero and more about widening publication, refining workflows, and scaling features that are already structurally in place.
