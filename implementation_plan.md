# Migrate Directory UI to Student Services Portal Theme

The goal of this restructuring is to align the Directory page (`app/directory/page.tsx`) with the modern, high-contrast, "Digital Hub" theme seen in the `Services` and `Student Government` tabs. The new design shifts away from a typical white background with standard shadows towards a deep slate/dark portal aesthetic utilizing glassmorphism, glowing accents, and dynamic overlays.

## User Review Required

> [!IMPORTANT]
> Since this is a massive visual overhaul, please confirm if there are any specific brand colors or logic currently in `app/directory/page.tsx` that must NOT be converted to the dark aesthetic.

## Proposed Changes

### 1. Root Layouts & Backgrounds
We will wrap the application views in `.portal-section-slate` and `.portal-section-dark` tags, including the `.portal-noise-overlay` to maintain visual consistency with the rest of the portal ecosystem.

#### [MODIFY] page.tsx
- Replace `<section className="bg-gradient-rtu page-header">` with `<section className="portal-section-slate section">` and a `div` containing `.portal-noise-overlay`.
- Inject the standard `BackLink` navigation seen in other portal pages (e.g., `<BackLink href="/" label="Back to Home" className="mb-8 text-slate-200 hover:text-white transition-colors" />`).

### 2. Typography & Headers
- **Headings:** Update the main titles to use `.portal-eyebrow`, `.portal-title`, and `.portal-lead` utility classes instead of the current `.page-header-title` and `.page-header-subtitle`.
- **Accents:** Swap out `.text-gradient-gold` which was tailored for light backgrounds with the portal equivalent (e.g., `.portal-title-accent` or `.sg-council-text-gradient`).

### 3. Navigation Tabs & Filters (Search / View mode)
- **Directory Mode Tabs:** Update `.directory-mode-pill-active`/`inactive` from dark text on white to light text on active glowing backgrounds (similar to `.portal-nav-link-active`).
- **Search Bar & Sort Dropdowns:** Convert the solid white input container `bg-surface-base` to a sleek glassmorphic container: `border border-white/10 bg-white/[0.03] text-white placeholder-slate-400`.
- **View Toggles (Grid/List):** Transition from gray bg with amber text to a subtle white/10 active state.

### 4. Card UI (Organizations & Offices)
- Convert the base `.card` from `bg-white` and `bg-surface-base` to `.portal-panel` and `.sg-hover-card`.
- Change primary typography in cards to white (`text-white`), and secondary/subtle text to slate blue (`text-slate-300` or `text-slate-400`).
- Update badges from `bg-blue-50 text-blue-700` and `bg-amber-50` to dark mode equivalents using `.rgba` opacity colors (e.g., `bg-white/10 text-sky-300`).
- Convert external contact buttons (Email, Facebook, LinkedIn) to use `.portal-back-link` or `.sg-inline-link` glassmorphism properties instead of stark white backgrounds.

## Verification Plan

### Manual Verification
- Testing all Directory Tabs (SSC, CSC, Academic, Offices, etc.) to ensure grid/list layouts remain intact and content-visibility functions as designed.
- Ensuring search/fallback tags look unified using portal components.
- Validating the mobile responsiveness to match the refactored Student Governance layouts.
