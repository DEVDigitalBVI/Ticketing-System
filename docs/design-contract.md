# Peter Island Resort and Spa IT Service Desk — Design Contract

Last verified: 2026-08-31  
Status: Approved frontend baseline for future implementation

## Authority and change control

The existing interface is the product design, not an exploratory prototype. Future work must preserve it while connecting real behavior behind reusable Next.js and React components; bundled demonstration data must not be restored.

When sources appear to conflict, use this order:

1. the owner-approved instructions in `design-prototype 2/WARP_CODEX_HANDOFF.md`;
2. the layouts, states, and copy demonstrated by `design-prototype 2/index.html`, `styles.css`, and `app.js`;
3. the production implementation under `src/app` and `src/modules/service-desk` as verified in Step 3;
4. this document as the concise regression contract.

Changing a material layout, token, responsive transition, interaction pattern, or route purpose requires explicit Product approval, a decision-log entry, updated tests, and desktop/mobile comparison evidence.

## Route and layout contract

| Route          | Audience                           | Required layout and purpose                                                                                                                                                              |
| -------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`       | All users                          | Resort-branded sign-in entry with a deep-indigo story panel flush to the viewport edge, warm credential surface, explicit work-account language, and a single-column mobile composition. |
| `/`            | Staff                              | Staff overview with greeting, primary report-issue action, three help-category cards, active-request summary, service status, and shared navigation shell.                               |
| `/new-ticket`  | Staff                              | Guided three-section issue form with a desktop process/privacy aside; the form becomes one column with sticky actions on mobile.                                                         |
| `/my-tickets`  | Staff                              | Ticket-list workspace with status tabs, search, readable status/SLA treatment, and links into the matching technician context.                                                           |
| `/technician`  | Technician                         | Service metrics, priority queue, selected-ticket context, and Level.io device panel in a desktop master-detail layout; context and secondary columns simplify at smaller sizes.          |
| `/health`      | Operations                         | Branded application-shell health view. It does not claim that external services are healthy.                                                                                             |
| `/admin/audit` | System administrators and auditors | Privileged audit history using the shared shell, compact table, explicit result state, safe horizontal containment, and an honest empty state.                                           |

All four service-desk routes share the same resort identity, navigation model, desktop rail, mobile header/drawer, service-status treatment, and profile affordance. The 404 and health routes retain the same visual language without pretending to be ticketing workflows.

## Visual system

- Identity: `Peter Island Resort and Spa` and `IT Service Desk` remain the product labels.
- Typography: use the existing Avenir-style stack led by `Avenir Next`, with display/body hierarchy, compact uppercase overlines, and restrained weight changes already defined in `globals.css`.
- Frame: a 264-pixel deep-indigo (`#384166`) navigation rail sits beside a sand-tinted (`#f7f5e8`) canvas on desktop. Content uses warm-white surfaces, subtle borders/shadows, and the established spacing and corner-radius scale.
- Approved palette: signal green `#0cdc2a`, deep indigo `#384166`, primary teal `#0b735f`, supporting sage `#639d75`, and warm sand `#e3dba9`. These five source colors remain explicit tokens in `globals.css`.
- Color roles: teal is the primary interactive color; indigo anchors navigation, typography, and featured operational surfaces; signal green is reserved for selected/healthy emphasis; sage supports secondary status treatments; and sand supplies hospitality warmth. Risk and urgency retain the existing semantic amber/red treatments.
- Accessibility: white text is used on indigo and teal, while bright green, sage, and sand pair with dark text or serve as non-text accents. Do not use signal green as text on a light surface.
- Information cannot rely on color alone: status, priority, SLA, and selection states retain text, shape, icon, border, or weight cues.
- Icons remain subordinate to text and are hidden from assistive technology when decorative.

## Responsive behavior

| Range        | Contract                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Above 1100px | Persistent 264px rail; three-card staff grid; four technician metrics; new-ticket form plus 280px aside; technician queue plus 326px selected-ticket context.                                |
| 781–1100px   | Staff cards reduce to two columns with the featured card spanning; technician metrics reduce to two columns; context panel is hidden and queue columns simplify as defined in the reference. |
| 431–780px    | Rail becomes an off-canvas drawer with scrim and 60px mobile header; page padding becomes 18px; forms/cards stack; ticket and queue rows simplify; mobile form actions remain sticky.        |
| 320–430px    | Single-column technician metrics and the narrowest supported wrapping behavior.                                                                                                              |

Safe-area padding, `min-width: 0`, wrapping rules, and the 320-pixel viewport floor must be retained. New content must not introduce horizontal page overflow at supported sizes.

## Interaction and accessibility contract

- Every interactive element has a visible text label or accessible name. Form controls use programmatic labels or fieldset legends.
- Keyboard focus remains clearly visible with the existing three-pixel focus treatment. The skip link and `#main-content` target remain available.
- Interactive hit areas are at least 44 by 44 pixels. A visually smaller switch is acceptable only while its full labelled row remains the hit area.
- The mobile drawer exposes its expanded state, closes by its control, scrim, route change, and Escape key, and does not become a second navigation system.
- Selected tabs and queue rows expose state semantically as well as visually. Status announcements and form feedback retain appropriate live-region behavior.
- Reduced-motion and increased-contrast preferences remain supported.
- The new-ticket form continues to provide character count, required fields, choice states, and an in-page success or error treatment in the approved visual language after server submission.
- Placeholder technician actions and the Level.io button must not imply successful external work. Live behavior must add pending, success, empty, permission, failure, and conflict states in the same visual language.
- Monitoring status and Level.io context still render explicit unavailable states. SLA-derived at-risk and breached queue views use each ticket's immutable policy snapshot and explicit evaluation time. `/new-ticket`, `/my-tickets`, and `/technician` use real authorized data while preserving the approved layout and avoiding demonstration records.
- The approved login composition submits work email and password to Supabase Auth through a server route. Errors remain generic and do not disclose whether an email exists. Newly provisioned users cannot reach service-desk layouts until replacing the temporary password.
- Password-change, authenticator verification, and user-administration screens extend the login surface's indigo/teal/sand tokens, fields, focus treatment, 44-pixel targets, and responsive single-column behavior. They do not alter the four approved service-desk layouts.

## Component conventions

- Route files compose domain components; ticketing view contracts and empty-state UI remain under `src/modules/service-desk` until server boundaries are introduced.
- Reuse the shared shell, page header, ticket/status treatments, button classes, fields, cards, queues, and context panels. Do not duplicate whole pages or paste the standalone reference into production.
- Keep server components as the default. Add client boundaries only for interaction, navigation state, or browser APIs.
- Backend adapters must supply typed view data to the existing component hierarchy; they must not couple provider SDK objects directly to presentation components.
- Administrative tables reuse the shared shell, tokens, heading scale, focus treatment, and responsive containment. Audit context is not rendered unless a later approved use case defines safe field-level presentation.
- Preserve semantic HTML landmarks, heading order, lists, tables/row semantics, labels, and status regions when decomposing components.

## Implementation status at the Step 3 boundary

| Capability               | Status                                          | Evidence and boundary                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend routes/design   | Implemented                                     | Four approved service-desk routes, shared shell, local interactions, responsive rules, and tests are present and pass.                                                                                                                      |
| Database                 | Implemented                                     | PostgreSQL/Prisma foundation and private `service_desk` schema are migrated locally, in tests, and to the approved Supabase project. Ticket persistence is not implemented.                                                                 |
| Authentication           | Implemented                                     | Supabase Auth sessions, domain user mapping, initial-password replacement, route protection, and server authorization are implemented. MFA enrollment remains available for future login hardening; account recovery remains unimplemented. |
| Authorization            | Implemented foundation                          | Six canonical roles and 15 permissions are enforced through server policies with organisation, property, ownership, and department boundaries. No business-data policies exist because those tables do not yet exist.                       |
| Audit                    | Implemented foundation                          | Append-only security/admin events include result and correlation ID, reject sensitive context, and are available through a privileged `/admin/audit` view.                                                                                  |
| File storage             | Undecided                                       | No storage SDK, bucket, upload flow, retention rule, or malware/type/size policy exists.                                                                                                                                                    |
| Queue                    | Undecided                                       | No queue technology, producer, consumer, retry policy, or dead-letter behavior is implemented.                                                                                                                                              |
| Hosting                  | Undecided                                       | No production hosting target or deployment pipeline is configured.                                                                                                                                                                          |
| Microsoft 365 / Entra ID | Undecided                                       | No tenant approach, application registration, identity flow, Graph integration, or notification integration is implemented.                                                                                                                 |
| Level.io                 | Missing                                         | The selected-ticket device panel renders an explicit unavailable state. No API client, credential, live device lookup, deep link, or remote action exists.                                                                                  |
| Property model           | Implemented foundation / launch scope undecided | The schema supports one organisation with multiple properties and property-scoped role assignments. Whether launch exposes one or multiple properties remains a Product decision.                                                           |

## Step 3 verification baseline

- The contract was reverified against the clean `main` baseline at commit `ba8e67a` before these documentation-only updates. No product source or dependency change was required.
- Prettier, ESLint, strict TypeScript, 4 Vitest files/9 tests, and the Next.js 16.3.3 production webpack build pass.
- `/`, `/new-ticket`, `/my-tickets`, `/technician`, and `/health` return HTTP 200 locally; the production build statically prerenders the routes and branded not-found state.
- Navigation targets, accessible names, focus rules, responsive breakpoints, minimum target sizing, and overflow-prevention rules were inspected with no defect requiring a source change.
- The prescribed browser connection was unavailable both before and after the local server started, so fresh live console capture, computed-layout measurement, and screenshot comparison at 1440×900 and 390×844 were not possible. Direct reference/source comparison, clean server logs, route rendering, and automated responsive assertions found no divergence; repeat the live visual comparison when a browser connection is available.
