# Design System v1

## 1) Vision and Principles

- Sleek, editorial, and slightly unexpected; avoid generic AI SaaS layouts and overused card grids.
- Every page should have one strong focal hierarchy: hero, command surface, or data view.
- Use clear visual contrast, controlled density, and purposeful whitespace.
- Prefer composable sections over one-off page artwork so the system scales across `/`, `/hub`, `/directory`, and `/services`.
- Favor precision over decoration: a few sharp accents, not constant visual noise.

## 2) Layout Grammar

- Hero split: headline and value prop on one side, supporting content or action surface on the other.
- Command deck: a compact action area with primary CTA, secondary action, and a small utility cluster.
- Feature rail: a vertical or horizontal strip for key capabilities, filters, or supporting proof.
- Data card: structured summary with title, metadata, status, and one clear action.
- Content well: the main reading/browse area with comfortable line length and consistent section spacing.
- Utility rail: lightweight sidebar for filters, anchors, status, or contextual actions.

## 3) Tokens

- Color roles:
  - `bg-surface`, `bg-surface-alt`, `bg-inset`
  - `text-primary`, `text-secondary`, `text-muted`
  - `border-subtle`, `border-strong`
  - `accent`, `accent-strong`, `accent-soft`
  - `success`, `warning`, `danger`, `info`
- Spacing rhythm:
  - Base scale: `4, 8, 12, 16, 24, 32, 48, 64`
  - Use `24-32` for section spacing and `8-12` for internal clusters.
- Radius scale:
  - `sm` for chips and dense controls
  - `md` for cards and inputs
  - `lg` for hero surfaces and prominent containers
  - Keep radius consistent within a page, not mixed arbitrarily.
- Elevation:
  - Prefer borders and surface contrast first.
  - Use one low shadow level for hover/raised states only.
  - Reserve stronger elevation for overlays or floating command surfaces.
- Motion:
  - Fast, restrained transitions only.
  - Default duration: `150-220ms`.
  - Use motion to clarify state changes, not to decorate every interaction.

## 3.1) Iconography

- Use `lucide-react` for navigation, actions, forms, admin tools, and utility states.
- Use `@heroicons/react` for existing civic and governance treatments where the component already uses that family.
- Use Font Awesome Solid for formal institutional motifs and Phosphor for selected editorial accents.
- Keep one icon family per control or component family; do not add variety for its own sake.
- New institutional or editorial imports should use `components/icons/registry.ts`.

## 4) Component Rules

- Cards:
  - One primary purpose per card.
  - Keep title, summary, metadata, and action ordering consistent.
  - Avoid stacking too many interactive elements inside one card.
- Chips / badges:
  - Use for status, category, or filter state only.
  - Keep labels short and scannable.
  - Do not use badges as decorative noise.
- CTAs:
  - One primary CTA per section.
  - Secondary CTA should be visually quieter and clearly subordinate.
  - If two actions are equally important, redesign the section hierarchy.
- Section headers:
  - Use a title, short supporting line, and optional action.
  - Headers should orient the user, not repeat body copy.
  - Keep spacing above and below headers consistent across pages.

## 5) Accessibility and Motion Constraints

- Maintain readable contrast for text, icons, borders, and focus states.
- Keep all interactive controls keyboard reachable and visibly focused.
- Do not rely on color alone to communicate state.
- Motion must never block access to content or actions.
- Respect reduced-motion preferences by removing nonessential animation and parallax.
- Avoid tiny tap targets in dense layouts; design for mobile first where interactions matter.

## 6) Page Migration Checklist

- `/`
  - Establish the hero split and command deck as the page's opening grammar.
  - Keep the first screen focused on orientation and a single primary action.
  - Use one featured proof block, not multiple competing promos.
- `/hub`
  - Structure around a content well with a feature rail or utility rail.
  - Group hub items by task or theme, not by visual variety.
  - Make filters and sorting obvious and persistent.
- `/directory`
  - Prioritize scanability: data cards, predictable metadata, and clear status chips.
  - Keep list density high enough for browsing without feeling crowded.
  - Make search, filter, and sort controls easy to discover.
- `/services`
  - Use a service-led narrative: value, process, then proof.
  - Convert long descriptions into modular sections with strong headers.
  - Keep the CTA path simple and consistent across service cards or sections.

## 7) PR Review Checklist: Anti-Generic Guardrails

- Does the page have a clear point of view, or does it look like a standard template?
- Is there one dominant hierarchy, or are multiple sections competing for attention?
- Are cards, badges, and CTAs doing real work, not just filling space?
- Is the layout varied in a deliberate way, not by adding random decoration?
- Are token choices consistent with the system, or did the page invent new one-offs?
- Does the page still work at a glance without relying on animation?
- Would this page still feel intentional if the gradients, shadows, and imagery were removed?
