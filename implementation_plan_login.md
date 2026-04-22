# Revamp Login Page to Portal Theme and New Requirements

The goal of this restructuring is to align the Login Page (`app/login/page.tsx`) with the dark glassmorphic "Digital Hub" theme, replacing the light-themed baseline. The new layout will not only look stunning but will properly present the new requirements—specifically the differentiated login tiers (Student vs. Student Leaders/Officers)—as premium "portal gateways".

## User Review Required

> [!IMPORTANT]
> The current version already has the basic "Student Access" and "Student Leader Access" buttons mapped to their internal NextAuth roles. I will be visually upgrading these into high-end "Gateway Panels". Please confirm if there are any *additional* new requirements for login that were not already supported under the hood (e.g. single sign-on changes, explicit terms of service prompt).

## Proposed Changes

### 1. Thematic Overhaul (Background & Layout)
We will switch from the crisp, light `bg-surface-base` setting to the deep, immersive `.portal-section-dark` ecosystem.
- Wrap the entire component in `.portal-section-dark` with the `.portal-noise-overlay` wrapper.
- Replace the floating blurred color circles with the portal's `sg-glow-blue` and `sg-glow-gold` radial ambient backgrounds to maintain the university's color presence but via sleek dark-mode glowing effects.

### 2. Login Container & Typography
- **Container:** Transform `.card.bg-white.shadow-xl.border-t-rtu-blue` into the portal standard: `.portal-panel` overlaid with `.sg-hover-card` and a fine frosted glass border (`border-white/10 bg-slate-900/60`).
- **Typography:** Shift `.page-header-title.text-rtu-blue` for the "RTU Account Sign In" to `.portal-title` with the stunning `.sg-council-text-gradient`. Update subtext from `text-text-muted` to `.text-slate-400`.

### 3. Differentiated Gateway Buttons (Student vs Leader)
We will redesign the standard list buttons into side-by-side or stacked "Keycards".
- **Student Access Gateway:** Upgrade from a white button with a grey border to a dark glass button (`bg-white/5 border-white/10 hover:bg-white/10 transition-colors text-white`). 
- **Leader Access Gateway:** Evolve the `border-amber-200` look to a premium gold dark-mode aesthetic (e.g. `bg-yellow-500/5 hover:bg-yellow-500/10 border-yellow-500/30 text-yellow-50`).

### 4. Banners, Error Handling & Dev Login
- **Security Notice & Error Banners:** Recolor the `bg-blue-50` and `bg-red-50` panels to `.portal-panel-soft` variants (e.g., `bg-red-500/10 border-red-500/20 text-red-200` for errors, `bg-blue-500/10 border-blue-500/20 text-blue-200` for the shield notice).
- **Local Simulation Block:** Refine the development login form to use standard dark-mode inputs (`bg-black/20 border-white/10 text-white placeholder-slate-500`) and the portal-flavored submit button, retaining functionality but eliminating the glare of white inputs.

## Verification Plan

### Manual Verification
- Render the page to ensure the `next-auth` flow layout triggers flawlessly and maintains mobile responsiveness.
- Check the layout consistency with the "Facebook Lite Sign in Fallback" and error bounding box when forced via query parameters (`?error=OAuthSignin`).
- Use the Localhost simulation feature to log in as a Student, Officer, and Leader to verify that the active loading spinners and routing behavior remain unbroken while displaying on the dark layout.
