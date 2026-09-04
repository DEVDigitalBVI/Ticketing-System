# SLA policy

Step 13 makes ticket priority and service targets deterministic. Policies are scoped to an organisation and property, carry a positive version number, and are immutable after insertion except for activation. Exactly one version may be active for a property.

## Applied policy

At ticket creation, the service selects the highest active policy version for the ticket's property. It calculates priority from the policy's impact/urgency matrix and stores the policy ID, version, full JSON snapshot, response deadline, and resolution deadline on the ticket. If no database policy exists, the documented Peter Island default is snapshotted; this keeps creation safe while still preserving the exact rules applied.

Changing or activating a later version affects only tickets created afterward. Existing tickets always evaluate their stored snapshot.

## Approved default

- Time zone: `America/Tortola`
- Support schedule: Monday–Friday, 08:00–17:00; Saturday and Sunday closed
- Holidays: explicit local dates in `YYYY-MM-DD` format
- Warning threshold: 30 minutes before the next open target
- Paused statuses: `waiting_for_requester`, `waiting_for_vendor`
- Reopen behavior: reset response and resolution clocks
- Response targets: P1 15, P2 30, P3 120, P4 240 support minutes
- Resolution targets: P1 120, P2 240, P3 480, P4 960 support minutes

The priority matrix is stored as impact rows and urgency columns:

| Impact / urgency | Low | Medium | High | Critical |
| ---------------- | --- | ------ | ---- | -------- |
| Low              | P4  | P4     | P3   | P2       |
| Medium           | P4  | P3     | P2   | P2       |
| High             | P3  | P2     | P2   | P1       |
| Critical         | P2  | P2     | P1   | P1       |

## Timing rules

All functions receive an explicit `Date` instant and use the policy's IANA time zone. The server's local time zone is never consulted. Support time advances only inside configured local windows and skips weekends, configured holidays, and closed periods. The support-window start is inclusive and the end is exclusive. A target is at risk exactly one configured warning threshold of support time before its deadline and breached exactly at the deadline.

Policy snapshots are rejected before calculation when the time zone is not a valid IANA identifier, every day is closed, a support window ends at or before its start, or same-day windows overlap. Adjacent windows are allowed. These checks prevent an invalid or ambiguous administrator-authored calendar from producing environment-dependent deadlines.

The first requester-visible reply written by an authorized technician records `slaRespondedAt`. Requester replies and internal notes do not complete the response clock. Resolution records `resolvedAt` through the existing lifecycle service.

When a ticket enters a configured waiting status, evaluation reports `paused`. On exit, each open deadline is recalculated from the exact support duration that remained when the pause began. Reopening a resolved, closed, or cancelled ticket applies the snapshotted policy's independent response and resolution behavior: `reset` starts a fresh target at the reopen instant; `preserve` retains the previous deadline and completion time.

`evaluateSla` is side-effect free and accepts its clock explicitly, so request handlers and background workers receive identical results for identical inputs. Persisting warnings or notifications later must use this function and the ticket snapshot rather than reloading the current active policy.
