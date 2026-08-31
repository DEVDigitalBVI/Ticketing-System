# Peter Island Resort and Spa IT Service Desk — System Context

Last updated: 2026-08-31
Status: Application foundation confirmed; product and integration scope pending blueprint and architecture approval

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

| Integration                         | Current status                               | Intended boundary                                                                                                                                    |
| ----------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js application                 | Step 2 foundation implemented and verified   | Hosts the application routes, shared UI, and future server-side application boundary.                                                                |
| PostgreSQL / Prisma                 | Step 4 local and test foundation implemented | Private `service_desk` schema contains organisation, property, department, identity, role membership, and audit foundations.                         |
| Supabase project `Ticketing System` | Hosted identity foundation implemented       | Project `zwcmljkjoxrfzfyphdtc` hosts the private `service_desk` schema. Runtime credentials, Data API exposure, and RLS policies are not configured. |
| Microsoft Entra ID / Microsoft 365  | Approval required                            | Proposed workforce identity and possible notification/collaboration integration; tenant model is undecided.                                          |
| File storage                        | Provider undecided                           | Stores ticket attachments subject to authorization, retention, malware-handling, and size/type controls.                                             |
| Queue                               | Technology undecided                         | Carries durable asynchronous work such as notifications and integration retries.                                                                     |
| Hosting platform                    | Target undecided                             | Runs the web/server application and its deployment pipeline.                                                                                         |

The Step 4 schema is migrated to the named Supabase project, but the application runtime is not yet connected to it. No authentication, Data API, storage, queue, Microsoft, or Level.io integration is implemented.

## System boundary

### Inside the proposed boundary

- the staff-facing service-desk web experience;
- ticket intake, workflow, assignment, comments, status, and audit behavior once confirmed;
- application authorization and property scoping;
- application-owned data and attachment metadata;
- outbound job creation and integration adapters;
- operational configuration, observability, testing, and deployment definitions stored with the application.

### Outside the proposed boundary

- Microsoft tenant and identity lifecycle administration;
- Peter Island Resort and Spa endpoint/device management and network operations;
- operation of third-party hosting, email/collaboration, and storage platforms;
- general property-management-system functionality;
- direct remote support or device control unless the blueprint explicitly includes it.

## Trust and ownership boundaries

- Peter Island Resort and Spa management and IT own product policy, role definitions, service processes, tenant approvals, and data-retention requirements.
- The application must not trust client-supplied role or property claims; authorization must be enforced at server and database boundaries.
- Any Supabase tables exposed through the Data API will require row-level security and least-privilege policies designed around the approved user/property model.
- Secrets and privileged Supabase credentials must remain server-side and outside version control.
- External identity, storage, queue, and messaging providers remain separate trust boundaries and require explicit failure/retry and audit behavior.

## Baseline architecture status

ADR-002 confirms the Next.js App Router, React, strict TypeScript, pnpm, Tailwind CSS pipeline, and quality-gate foundation. ADR-004 records removal of unused shadcn scaffolding after the approved custom interface replaced the earlier component experiment. ADR-007 accepts the local PostgreSQL/Prisma identity foundation and property-aware schema, and ADR-008 accepts the named Supabase project as its hosted database. Hosting, Microsoft tenant, storage, queue, runtime connection mode, least-privilege role, RLS policy, and launch-property decisions remain open because the blueprint was unavailable and the full approval checkpoint has not been completed. Once confirmed, this document should replace candidate language with the exact users, integrations, boundaries, hosting model, and launch property scope from the blueprint.
