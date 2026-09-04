# Warp Codex implementation handoff

## What to give Codex

Copy this entire `design-prototype` folder into the root of the real application repository and rename it `design-reference`.

The folder contains:

- `index.html`: approved screen structure and content hierarchy
- `styles.css`: approved visual system, spacing, typography, responsive behavior, and accessibility treatments
- `app.js`: intended prototype navigation and interactions
- `DESIGN_NOTES.md`: human interface principles and design rationale
- `README.md`: local preview instructions

Open Warp in the real application repository, start Codex there, and paste the prompt below.

## Prompt for Codex in Warp

```text
Implement the approved Resort IT Service Desk interface in this repository.

Before changing anything:

1. Read all repository instructions, including any AGENTS.md files.
2. Inspect the existing framework, package manager, routes, components, styles, tests, and uncommitted changes.
3. Read every file under design-reference/.
4. Run the design reference locally and inspect all four views at desktop and mobile sizes if browser tooling is available.

The files under design-reference/ are the approved visual source of truth. Implement this design. Do not replace it with a different dashboard template, generic component library appearance, purple gradient, blue SaaS theme, or a new visual concept.

Design requirements to preserve:

- Calm operational clarity with hospitality warmth
- Dark graphite navigation rail
- Warm neutral canvas and elevated white surfaces
- One provisional green interaction accent and restrained semantic status colors
- Avenir-style clean typography with suitable locally available or self-hosted fallbacks
- Strong plain-language hierarchy for nontechnical resort staff
- Denser, operations-focused hierarchy for technicians
- Generous spacing, subtle borders, restrained shadows, and rounded geometry
- Staff overview with three primary action cards and active requests
- Guided ticket form with plain-language choices
- Staff ticket list with readable status treatments
- Technician overview with metrics, priority queue, master-detail context, SLA risk, guest impact, and Level.io device context
- Responsive navigation and layouts matching the reference behavior
- Minimum 44 by 44 pixel interactive targets
- Visible keyboard focus
- Reduced-motion and increased-contrast support
- Status communicated through text and shape, not color alone
- No essential interaction that depends on hover

Implementation approach:

- Adapt to the repository's existing approved stack. If this is the planned empty project, use Next.js App Router, React, strict TypeScript, Tailwind CSS, and reusable components.
- Convert the reference into maintainable React components and route-level pages. Do not paste the prototype into one large component.
- Create design tokens for colors, typography, spacing, radii, shadows, and motion so branding can be changed later without restructuring the interface.
- Prefer semantic HTML and native controls. Use a proven accessible primitive only when a native element is insufficient.
- Preserve the visual proportions and content hierarchy from the reference rather than accepting component-library defaults.
- Use mock typed data for this design implementation. Do not add authentication, a database, Level.io API calls, or backend ticket persistence in this task.
- The Level.io panel is display-only mock context in this step.
- Preserve unrelated user changes.

Implement these usable routes or their equivalent within the existing route structure:

- Staff overview
- New ticket form
- My tickets
- Technician workspace

The navigation must work without full-page reloads. Form controls should behave locally, including selection, character count, tabs, mobile navigation, and success feedback. Ticket rows may open the technician detail context using mock data.

Quality requirements:

- Add or update component tests for navigation and critical interactions.
- Add accessibility checks for landmarks, labels, keyboard focus, and control names.
- Verify desktop at 1440 by 900 and mobile at 390 by 844.
- Confirm there is no horizontal overflow.
- Confirm all visible actionable controls meet the 44-pixel target.
- Run formatting, linting, type checking, tests, and the production build.
- Fix issues introduced by this work.

Before stopping, report:

- What you implemented
- Files changed
- Screens and breakpoints verified
- Test and build results
- Any deliberate difference from the design reference and why it was unavoidable
- The exact command to start the app locally

Stop after implementing and verifying the frontend design. Do not begin backend, authentication, database, or live integration work.
```

## Acceptance checklist

Do not accept the implementation merely because it contains the same text. Compare it visually with the prototype.

- The opening staff page retains the dark rail and asymmetrical action-card composition.
- The ticket form remains plain-language, calm, and easy to use on a phone.
- The technician page retains the metrics, priority queue, and right-side ticket context panel on desktop.
- The Level.io card is present inside technician context.
- Typography, spacing, border weight, and surface contrast remain close to the reference.
- Mobile navigation works and the form remains single-column.
- The implementation does not look like an unstyled shadcn or generic admin dashboard.
- Colors are tokenized and can be replaced later.
- Critical interactions and the production build pass.

## Recommended follow-up prompt

After the first implementation is complete, compare it side by side with the design reference and give Codex this smaller prompt:

```text
Perform a visual fidelity pass only. Compare the running implementation against design-reference/ at 1440 by 900 and 390 by 844. Correct differences in typography, spacing, widths, alignment, borders, radii, shadows, responsive behavior, and control sizing. Do not add features, change content architecture, or redesign the approved interface. Run the relevant checks and report the visual corrections made.
```
