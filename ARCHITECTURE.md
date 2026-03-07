# OSR Website: "Hardened" Implementation Roadmap & Architecture

This document serves as the living architectural blueprint and feature inventory for the Office of the Student Regent (OSR) Website. It ensures all development aligns with the core requirements of dynamic content management, strict security, and modular design.

## I. Feature Inventory & Technical Requirements

### 1. Content & Layout Management
- **Dynamic Layouts:** The website must "morph" based on the number of entries in a sheet (e.g., switching from a grid to a list view as the team grows).
- **Rich Media Support:** A backend "Parser" (`SlideParser.tsx`) interprets Google Slide objects to render:
  - Photos
  - YouTube/Drive videos with full audio controls
  - Music players via keyword triggers
- **Template System:** Use of dynamic routes (e.g., `/projects/[slug]`) to allow officers to create new pages simply by adding titled slides (e.g., "NEWS:", "GALLERY:", "LINK:").
- **Control Panel:** A "Hidden" settings slide to toggle features like the Elections Tab on/off via keywords (e.g., `ELECTIONS_ACTIVE: TRUE`).

### 2. Directory & Forms
- **Information-Dense Directory:** Pulls Name, Position, Email, and Department from Google Sheets to create searchable, sortable "Contact Cards".
- **Custom Form Renderer:** Instead of standard iframe embeds, the Google Forms API (or custom backend) is used to build custom UI (RTU Blue and Gold) that matches the site's design.
- **Smart Link Parsing:** A backend Regex that extracts the Form ID from any full URL pasted into a sheet or slide, preventing human error.

### 3. Automation & Security
- **IFTTT News Pipeline:** Automates Facebook posts into the website news feed with built-in "Intelligence":
  - Blocks reshares.
  - Prevents "Countdown Bombardment" via keyword filters.
- **Strict Validation:** Uses `zod` as a "Bouncer" to validate all data from Google Sheets/IFTTT at runtime, ensuring the site doesn't crash if an officer makes a typo.
- **Hardening:** Implementation of strict CORS policies, server-side environment variables for API keys, and XSS sanitization (e.g., `isomorphic-dompurify`).

---

## II. Development Phases

### Week 1: Infrastructure & Core Logic
- [x] Set up a Next.js project with TypeScript for self-documenting interfaces.
- [ ] Build the `SlideParser.tsx` and `SheetTable.tsx` components to isolate logic from UI. *(SlideParser needs Media/Regex upgrades)*
- [ ] Implement the backend "Switch" statement to detect and render different media types (images, videos, links).

### Week 2: Data Architecture & Integration
- [x] Map out the database schemas using Zod for "Officer" and "NewsPost" interfaces.
- [ ] Connect the IFTTT pipeline and implement the "Manual Override" column in Google Sheets to hide/publish posts.
- [ ] Develop the Custom Form Renderer with a "Smart Fallback" that reverts to a standard link if a question type is unrecognized. *(Custom Forms built via API, fallback needed?)*

### Week 3: Professional Tier & Optimization
- [x] Enable Incremental Static Regeneration (ISR) to buffer Google API requests and prevent rate-limiting.
- [ ] Implement Image Optimization (Next/Image) for fast loading on campus Wi-Fi and Edge Caching via Vercel.
- [x] Add Aria-Labels for accessibility and dynamic meta tags for professional social media sharing.

### Week 4: Handover & Documentation
- [ ] Create an Officer Handbook within a Google Slide to explain how to manage the site.
- [ ] Establish a Living README documenting the architecture and environment variables for future engineering students.
- [ ] Final Beta test: Ensure the "Self-Updating" logic works for turnovers without touching the code.

---
*Note: This file should be referenced for all future feature implementations to ensure adherence to the original vision.*
