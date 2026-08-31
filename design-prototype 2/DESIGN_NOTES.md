# Resort IT Service Desk design direction

## Concept: Calm operational clarity

The interface combines the composure of a well-run resort with the precision of an operations console. Staff should never feel that they need IT knowledge to ask for help. Technicians should be able to identify risk, context, ownership, and the next action at a glance.

The prototype deliberately avoids a typical blue SaaS dashboard. It uses warm neutral surfaces, a dark navigation rail, and one provisional green accent. Every color is represented by a CSS variable, so the palette can be replaced later without changing the hierarchy or components.

## Typography

The prototype uses Avenir Next where available, with clean fallbacks. It was selected for its open shapes, calm tone, and clarity at both display and interface sizes. The production application should host the final approved font files locally to avoid layout shifts and third-party requests.

Recommended alternatives for the final brand decision:

- Frutiger or Neue Frutiger for exceptional wayfinding clarity
- Söhne for a contemporary operational feel
- Suisse Intl for a restrained hospitality tone
- Public Sans as an open-source, highly legible option

## Human interface principles applied

### Clarity

- Plain-language labels such as “Report an issue” and “Work has stopped” replace service-desk jargon.
- Status is communicated with text, shape, and color rather than color alone.
- Staff and technician experiences use different information density.
- The primary action is visually obvious without competing calls to action.

### Deference

- The interface supports the work rather than decorating it excessively.
- Content and state receive more emphasis than controls.
- Motion is brief and functional, and it respects reduced-motion preferences.

### Depth and hierarchy

- Surface elevation is used sparingly for focus and selected context.
- The technician workspace uses a master-detail relationship on larger screens.
- Progressive disclosure keeps device details and advanced actions away from staff views.

### Familiar interaction patterns

- Navigation, forms, segmented controls, switches, tabs, lists, and menus follow platform conventions.
- Controls have a minimum 44-pixel interactive target.
- Destructive or high-risk remote actions are not represented as casual one-click controls.
- Mobile layouts account for safe-area insets and keep the final form action reachable.

### Feedback and recovery

- Loading, empty, success, error, waiting, stale-data, and degraded-integration states should be designed before implementation.
- Forms retain entered values after recoverable errors.
- Ticket changes create a visible activity history.
- Provider failure must not prevent access to the core ticket record.

### Accessibility

- Semantic regions, headings, labels, tables, status announcements, and a skip link are included.
- Keyboard focus is visible and intentionally styled.
- The layout supports keyboard-only use and responsive magnification.
- Reduced-motion and increased-contrast preferences are respected.
- Production acceptance should target WCAG 2.2 AA and include manual keyboard and screen-reader review.

## Information hierarchy

### Staff portal

1. Report an issue
2. Track an existing request
3. Find a quick answer
4. Understand what happens next

### Technician workspace

1. Guest or operational impact
2. Priority and SLA risk
3. Ticket subject and location
4. Ownership and last activity
5. Linked device health and Level.io context
6. Safe next actions

## Responsive behavior

- Desktop uses a persistent navigation rail and a master-detail technician layout.
- Tablet retains efficient queues while moving detailed context below or behind selection.
- Mobile uses a temporary navigation drawer, single-column forms, sticky safe-area-aware actions, and simplified queue rows.
- No core task depends on hover.

## Color tokens

The palette can be changed in `styles.css` by replacing the variables under `:root`. Status colors should retain accessible contrast and stable meaning even when brand colors change.

- `--canvas` and `--surface` define the overall environment.
- `--ink` values define readable hierarchy.
- `--accent` defines the main interactive color.
- `--warm`, `--warning`, and `--danger` are semantic and should not be replaced purely for branding.

## Prototype coverage

The interactive prototype includes:

- Staff overview
- Plain-language ticket submission
- Staff ticket list
- Technician service overview and queue
- SLA and guest-impact hierarchy
- Level.io device-context treatment
- Responsive navigation and mobile layouts
- Keyboard focus, reduced motion, and increased contrast support

This is a design prototype, not a production implementation. Authentication, data persistence, API calls, actual Level.io actions, form validation rules, and complete error states belong in the application build.

## Decisions to make after reviewing the prototype

1. Should the overall tone feel warmer and more resort-like, or more technical and operational?
2. Should staff see a knowledge search field directly on the overview page?
3. Which resort locations and departments should appear in the first navigation and ticket form?
4. Should the technician workspace default to a queue, a personal worklist, or the service overview shown here?
5. How prominent should Level.io device context be on the ticket page?
6. Which font should be licensed or hosted for production?
7. Which brand palette should replace the provisional tokens?
