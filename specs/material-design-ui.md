# Feature Specification: Material Design 3 UI with Responsive Layout

## 1. Goal & Requirements
- Focus: Give the existing RAG chat UI a Material Design 3 visual system and make it usable on every screen size.
- Constraint: MD3 is expressed as **design tokens in Tailwind**, not by adopting a component library. No CSS-in-JS runtime is introduced, so the stack recorded in `CLAUDE.md` (Next.js + React + Tailwind) stays accurate.
- Out of scope: backend behaviour, retrieval quality, and ingestion. This feature is frontend-only.

## 2. Problem
- The app has no responsive design. `sm:`/`md:`/`lg:` appear nowhere in `app/` or `components/`, and `app/page.tsx` renders a fixed `max-w-6xl` row with a hard `w-72` sidebar that never collapses, so the chat column is unusable on a phone.
- `tailwind.config.ts` carries an empty `theme.extend`, so every colour is an ad-hoc `slate-*`/`blue-*` literal with no shared palette, no elevation system, and no dark scheme.

## 3. Component Blueprint
- **Token layer**: MD3 colour roles as channel-only CSS custom properties on `:root` and `.dark`, surfaced to Tailwind via `rgb(var(--token) / <alpha-value>)`. Seed colour `#6750A4`. Adds the MD3 type scale, elevation 0–5, and the shape scale.
- **Typography & icons**: Roboto and Material Symbols loaded through `next/font/google`; a single `Icon` wrapper replaces `lucide-react`.
- **Responsive shell**: an `AppShell` client component owning drawer state, so `app/page.tsx` remains a server component. MD3 window classes — compact (<600px), medium (600–839px), expanded (>=840px) — map to custom `medium`/`expanded` Tailwind breakpoints rather than redefining the defaults.
- **Navigation drawer**: modal drawer with scrim below `expanded`, permanent sidebar at and above it.
- **Theming**: user-facing light/dark toggle, seeded from `prefers-color-scheme` and persisted to `localStorage`, applied pre-hydration to avoid a flash.

## 4. Acceptance Criteria
- [ ] No hard-coded `slate-*`/`blue-*` colour literals remain in `app/` or `components/`; all colour comes from MD3 role tokens.
- [ ] The layout is usable at 390px, 768px, and 1280px with no horizontal overflow.
- [ ] Below 840px the sidebar is a modal drawer that opens from a menu button, closes on scrim click and on Escape, and restores focus to the trigger.
- [ ] Dark mode can be toggled, persists across reloads, and applies before first paint.
- [ ] Every interactive control has a visible `:focus-visible` indicator.
- [ ] `npm run lint` and `npm run build` pass, and the backend's existing 17 tests still pass.

## 5. Verification
Launch the full stack and drive the UI with the committed browser driver documented in `.claude/skills/run-rag-agent-app/SKILL.md`, capturing screenshots at 390/768/1280px in both colour schemes.
