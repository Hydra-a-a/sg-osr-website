# Iconography

The portal uses a curated icon lineup rather than one library for every visual context.

## Library Roles

- `lucide-react`: default for navigation, actions, forms, admin tools, and utility states.
- `@heroicons/react`: existing civic, governance, and public-facing treatments. Keep the family consistent within a component.
- `@fortawesome/react-fontawesome` with `@fortawesome/free-solid-svg-icons`: formal or heritage-oriented institutional motifs.
- `@phosphor-icons/react`: selected editorial or expressive accents. Prefer direct per-icon SSR imports to preserve tree-shaking and Next.js compatibility.

## Rules

- Do not mix icon families within one control or component family.
- Do not replace working icons solely to increase library variety.
- Prefer the smallest icon family that expresses the meaning clearly.
- Keep icon sizing, stroke or weight treatment, and color roles consistent within a page.
- Use the curated exports in `components/icons/registry.ts` when a new institutional or editorial motif is needed.
- Official RTU-specific symbols should be added here only after approved artwork exists.
