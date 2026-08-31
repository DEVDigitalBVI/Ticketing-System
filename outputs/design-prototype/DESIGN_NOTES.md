# Peter Island Resort and Spa IT Service Desk — Design Notes

Status: Implemented production foundation and standalone prototype  
Last updated: 2026-08-30

## Design intent

The interface combines **quiet resort luxury** with **dependable technical operations**. It should feel specific to Peter Island: calm, precise, warm, and capable—never like a generic corporate dashboard or tropical travel advertisement.

The memorable visual device is a dark coastal field divided on a subtle diagonal, with fine tidal-line texture, an off-canvas orbital form, and a restrained coral signal color. Operational information sits within that atmosphere without sacrificing clarity.

## Experience principles

1. **Calm before density.** Use generous space and strong hierarchy before introducing operational detail.
2. **Hospitality, not consumer travel.** Reference island materials and light without using postcard imagery or novelty motifs.
3. **Operational confidence.** Statuses must be direct, legible, and supported by text—not color alone.
4. **One memorable gesture.** Preserve the diagonal coastal field and oversized editorial heading; avoid competing decorative effects.
5. **Progressive complexity.** The foundation is intentionally sparse. Future ticketing screens may become denser while retaining the same tokens and typographic rhythm.

## Visual language

### Color

| Token             | Value     | Intended use                                            |
| ----------------- | --------- | ------------------------------------------------------- |
| Island night      | `#052c33` | Primary atmospheric background and deepest surface.     |
| Island deep       | `#073c43` | Secondary background field and elevated dark surfaces.  |
| Island foam       | `#f7f2e7` | Primary text and light surface reference.               |
| Island sand       | `#d9c9aa` | Eyebrows, quiet metadata, and warm neutral emphasis.    |
| Island coral      | `#e4835d` | Links, signal accents, and limited points of attention. |
| Operational green | `#7dd8a7` | Healthy/ready indicators, always accompanied by text.   |

The full semantic shadcn/ui token set is defined in `src/app/globals.css` using OKLCH values. New components should use semantic tokens such as `background`, `foreground`, `primary`, `muted`, `accent`, `destructive`, `border`, and `ring` rather than adding isolated colors.

### Typography

- Display: `Iowan Old Style`, falling back through Palatino-compatible serif faces.
- Interface/body: `Avenir Next`, falling back to Avenir and `Segoe UI`.
- Display headings use tight tracking and compact line height to create an editorial resort identity.
- Operational labels use small uppercase text with generous letter spacing.
- Body copy remains sentence case with comfortable line height.

Do not introduce Inter, Roboto, Arial, Space Grotesk, or unrelated display faces. If a licensed Peter Island brand typeface becomes available, replace the two font tokens centrally and validate every breakpoint.

### Shape and surface

- Primary radius: `0.75rem`; pills are reserved for compact statuses.
- Dark elevated surfaces use translucent borders and controlled backdrop blur.
- Fine one-pixel rules organize content more often than heavy cards or shadows.
- Shadows should feel like depth over water at night: broad, dark, and low-contrast.
- Lucide icons use light strokes and support meaning; they are not decoration by default.

## Current compositions

### Application shell (`/`)

- Full-viewport composition with an asymmetrical diagonal background.
- Resort and location form a quiet brand line at the top.
- The large “Service Desk” title is the primary landmark.
- “Foundation online” communicates prototype state without implying backend availability.
- Three operating principles translate the visual direction into clear product behavior.
- An embedded health composition provides honest application-boundary status.
- The foundation-scope section distinguishes implemented design from deferred backend workflows.
- The footer identifies the foundation release and product owner.

### Health page (`/health`)

- Centered translucent operational panel over the same coastal field.
- “Operational” is expressed with both text and a green signal.
- Application and runtime checks are presented as a simple two-column grid, collapsing to one column on small screens.
- The note explicitly says that external services are not queried, preventing a misleading health claim.

### Not-found page

- Uses the shared resort frame and coastal atmosphere rather than a framework-default error page.
- A compass motif and “outside the charted route” language explain the error without turning it into a novelty.
- The recovery action returns directly to the Service Desk home page.

### Standalone artifact

`outputs/design-prototype/index.html` reproduces the foundation experience without a Next.js runtime. Its inline styles intentionally make the artifact portable, while `app.js` adds current-year, motion-preference, active-navigation, and accessible-disclosure enhancements when matching hooks are present.

## Shared component direction

The project uses shadcn/ui conventions with the `new-york` style, React Server Components enabled, Lucide icons, CSS variables, and aliases rooted at `@/`.

`StatusBadge` is the first shared primitive. Future shared components should:

- live in `src/components/ui/`;
- expose semantic variants rather than route-specific class names;
- include `data-slot` attributes where appropriate;
- use the shared `cn()` utility for class composition;
- remain accessible without relying on color or icons alone;
- avoid importing domain logic into the UI layer.

## Responsive behavior

The prototype is fluid rather than breakpoint-heavy:

- Type and spacing scale with `clamp()`.
- Content width is capped while full-viewport atmosphere remains intact.
- Below `640px`, secondary location text is hidden, footer content stacks, the decorative health icon is removed, and health checks become a single column.
- Touch targets and link spacing must remain comfortable when future navigation is introduced.
- Dense ticket tables must eventually gain a purpose-built small-screen pattern; horizontal shrinking alone is not acceptable.

## Motion

The only entrance motion is a short upward fade using a restrained easing curve. Link color transitions provide quiet interaction feedback. All entrance animation is disabled automatically when `prefers-reduced-motion` is enabled.

Future motion should communicate state change or spatial continuity. Do not add looping ambient animation, parallax, or competing card-by-card entrances.

## Accessibility baseline

- Pages use one clear level-one heading and semantic landmarks.
- Decorative graphics and icons are hidden from assistive technology.
- Links have descriptive visible text.
- Status meaning is conveyed through words in addition to color.
- Responsive layouts preserve reading order.
- Reduced-motion preferences are respected.

Before product screens are approved, validate color contrast for every semantic state, visible keyboard focus across all interactive components, zoom at 200%, screen-reader announcements for dynamic ticket updates, and error messaging that identifies both the field and corrective action.

## Implementation map

| Concern                                                 | Source                                |
| ------------------------------------------------------- | ------------------------------------- |
| Global tokens, atmosphere, responsive rules, and motion | `src/app/globals.css`                 |
| Application-shell composition                           | `src/app/page.tsx`                    |
| Health composition                                      | `src/app/health/page.tsx`             |
| Shared resort frame                                     | `src/components/site/`                |
| Shared status primitive                                 | `src/components/ui/status-badge.tsx`  |
| shadcn/ui configuration                                 | `components.json`                     |
| Metadata and global document structure                  | `src/app/layout.tsx`                  |
| Branded route fallback                                  | `src/app/not-found.tsx`               |
| Portable design artifact                                | `outputs/design-prototype/index.html` |
| Prototype progressive enhancement                       | `outputs/design-prototype/app.js`     |

## Guardrails for future screens

### Keep

- deep teal as the dominant operational field;
- foam and sand as the reading palette;
- coral as a scarce signal, not a broad fill;
- serif display moments paired with disciplined interface typography;
- strong whitespace and thin structural rules;
- honest system-state language.

### Avoid

- purple or blue SaaS gradients;
- interchangeable rounded-card dashboards;
- oversized icon tiles for routine actions;
- tropical clip art, palm-tree motifs, or generic resort photography;
- excessive blur, glass effects, or decorative animation;
- hiding operational detail merely to preserve minimalism.

## Design work deferred

The prototype does not yet define ticket lists, ticket detail, intake forms, navigation, empty/error/loading states, authentication screens, reporting, notification patterns, or multi-property switching. Those patterns should be designed only after the blueprint, user roles, workflows, accessibility needs, and property model are approved.
