# Peter Island Resort and Spa IT Service Desk — System Context

Last updated: 2026-09-04
Status: Hosted schema through Step 21 and Level read-only access confirmed; runtime database connection pending

## Product scope

The product is the **Peter Island Resort and Spa IT Service Desk**, maintained in the Git repository **Ticketing System** and intended to use the Supabase project **Ticketing system**. Based on the material available in Step 1, its confirmed product purpose is limited to providing Peter Island Resort and Spa's IT service-desk and ticketing system. Detailed workflows, service levels, ticket fields, asset management, knowledge management, reporting, notification behavior, and non-functional requirements are not yet confirmed because the referenced blueprint was unavailable.

## Users

The blueprint must confirm the user roles and their permissions. The likely role families below are context candidates, not approved requirements:

- Peter Island Resort and Spa staff who request IT assistance;
- IT service-desk agents who triage and resolve work;
- Peter Island Resort and Spa IT or property administrators who manage access and configuration;
- managers who may view service performance and reports;
- external or guest users, only if explicitly approved.

## Integrations

| Integration                         | Current status                               | Intended boundary                                                                                                                         |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js application                 | Step 2 foundation implemented and verified   | Hosts the application routes, shared UI, and future server-side application boundary.                                                     |
| PostgreSQL / Prisma                 | Domain schema through Step 21 implemented    | Private `service_desk` schema contains identity, tickets, SLA, attachments, assets, jobs, and Level inventory.                            |
| Supabase project `Ticketing System` | Hosted migrations through Step 21 applied    | Project `zwcmljkjoxrfzfyphdtc` hosts the private schema; the app runtime connection strings are not yet configured.                       |
| Supabase Storage                    | Private ticket bucket implemented in Step 14 | Stores ticket attachments behind server-side ticket authorization, quarantine, type/size validation, and retention cleanup.               |
| PostgreSQL job queue                | Transactional outbox implemented in Step 17  | Private tables carry leased, retryable notification, SLA, synchronization, and webhook work; the Level inventory consumer is implemented. |
| Level.io Public API                 | Read-only inventory access verified          | Health and full pagination succeed with the server credential; durable snapshots await the application database connection.               |
| Hosting platform                    | Target undecided                             | Runs the web/server application and its deployment pipeline.                                                                              |

The hosted database contains the approved forward migration sequence through Step 21, including the private attachment bucket and Level inventory constraints. The first durable inventory synchronization awaits runtime database connection strings for the hosted project.

## System boundary

### Inside the proposed boundary

- the staff-facing service-desk web experience;
- ticket intake, workflow, assignment, comments, status, and audit behavior once confirmed;
- application authorization and property scoping;
- application-owned data and attachment metadata;
- business-owned resort asset identity, location, lifecycle, responsibility, move history, and procurement/warranty context;
- outbound job creation and integration adapters;
- operational configuration, observability, testing, and deployment definitions stored with the application.

### Outside the proposed boundary

- Peter Island Resort and Spa endpoint/device management and network operations;
- Level.io live telemetry synchronization, webhook delivery, deep links, and remote actions; Step 20 adds only an isolated read-only health check and stores no device data;
- operation of third-party hosting, email/collaboration, and storage platforms;
- general property-management-system functionality;
- direct remote support or device control unless the blueprint explicitly includes it.

## Trust and ownership boundaries

- Peter Island Resort and Spa management and IT own product policy, role definitions, service processes, tenant approvals, and data-retention requirements.
- The application must not trust client-supplied role or property claims; authorization must be enforced at server and database boundaries.
- Any Supabase tables exposed through the Data API will require row-level security and least-privilege policies designed around the approved user/property model.
- Secrets and privileged Supabase credentials must remain server-side and outside version control.
- External identity, storage, and messaging providers remain separate trust boundaries and require explicit failure/retry and audit behavior. The job queue itself stays inside the private database boundary.

## Baseline architecture status

ADR-002 confirms the Next.js App Router, React, strict TypeScript, pnpm, Tailwind CSS pipeline, and quality-gate foundation. ADR-004 records removal of unused shadcn scaffolding after the approved custom interface replaced the earlier component experiment. ADR-007 accepts the local PostgreSQL/Prisma identity foundation and property-aware schema, ADR-008 accepts the named Supabase project as its hosted database, ADR-014 accepts the PostgreSQL-native transactional outbox and leased worker, and ADR-015 isolates Level.io behind a read-only typed client. Hosting, runtime connection mode, least-privilege role, launch-property behavior, production alert thresholds, and live Level tenant scope remain open because the blueprint and a tenant key are unavailable.
