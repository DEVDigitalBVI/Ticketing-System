# Role-permission matrix

Last verified: 2026-09-04
Status: Step 17 authorization contract

`Allow` means the server policy may authorize the operation after its object boundary also passes. A blank cell is an explicit deny. UI visibility is not an authorization control.

| Capability / permission                                 | Requester | Technician | IT Manager | System Administrator | Auditor / Report Viewer | Department Approver |
| ------------------------------------------------------- | :-------: | :--------: | :--------: | :------------------: | :---------------------: | :-----------------: |
| Submit ticket — `ticket.submit`                         |   Allow   |   Allow    |   Allow    |        Allow         |                         |        Allow        |
| Read own ticket — `ticket.read.own`                     |   Allow   |   Allow    |   Allow    |        Allow         |                         |        Allow        |
| Read property queue — `ticket.queue.read`               |           |   Allow    |   Allow    |        Allow         |                         |                     |
| Assign ticket — `ticket.assign`                         |           |   Allow    |   Allow    |        Allow         |                         |                     |
| Add internal note — `ticket.note.internal`              |           |   Allow    |   Allow    |        Allow         |                         |                     |
| Transition ticket — `ticket.transition`                 |           |   Allow    |   Allow    |        Allow         |                         |                     |
| Approve department ticket — `ticket.department.approve` |           |            |            |        Allow         |                         |        Allow        |
| Read asset context — `asset.read`                       |           |   Allow    |   Allow    |        Allow         |                         |                     |
| Manage assets — `asset.manage`                          |           |            |   Allow    |        Allow         |                         |                     |
| Read Level.io context — `level.context.read`            |           |   Allow    |   Allow    |        Allow         |                         |                     |
| Execute Level.io action — `level.action.execute`        |           |            |   Allow    |        Allow         |                         |                     |
| View reports — `report.read`                            |           |            |   Allow    |        Allow         |          Allow          |                     |
| View audit events — `audit.read`                        |           |            |            |        Allow         |          Allow          |                     |
| Administer users — `user.manage`                        |           |            |            |        Allow         |                         |                     |
| Manage configuration — `configuration.manage`           |           |            |            |        Allow         |                         |                     |
| Inspect background jobs — `job.read`                    |           |            |   Allow    |        Allow         |          Allow          |                     |
| Replay failed jobs — `job.replay`                       |           |            |            |        Allow         |                         |                     |

## Object boundaries

- Every resource operation is restricted to the actor's organisation. No role, including System Administrator, crosses an organisation boundary.
- Requester-style own-ticket reads require `ownerUserId` to equal the authenticated domain user ID.
- Operational access is limited to assigned properties. System Administrator is organisation-wide.
- Department approval additionally requires an assigned department. The Department Approver role is present but cannot be granted through the current administrator form until the department-assignment model and workflow are approved.
- Multiple assigned roles are additive, but all tenant, property, ownership, and department checks still apply.
- The audit RPC independently repeats authenticated-user, active-profile, organisation, and role checks in PostgreSQL. Direct audit-table access remains denied.
- Job operations are always organisation-scoped. Inspect permission never implies replay permission, and replay records an audit event.

The executable source of truth is `src/modules/auth/authorization.ts`; tests enumerate every role against every permission and exercise the organisation, property, ownership, and department boundaries.
