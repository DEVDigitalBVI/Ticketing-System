# Peter Island Resort and Spa IT Service Desk — Open Questions

Last updated: 2026-08-31

Only questions that block implementation or materially change architecture, security, cost, or data design belong here.

Step 3 has no blocking product decision: the approved frontend baseline is stable and no backend behavior was introduced. The following questions remain intentionally open for later backend and deployment steps.

1. Where is the approved project blueprint? It is not present in the repository or the conversation payload available during Step 1, so its requirements and baseline architecture could not be verified.
2. What are the server-only SMTP host, port, TLS mode, username, password, and approved sender address? The initial administrator was provisioned directly, but automated temporary-password delivery for future users remains unavailable until these values are supplied outside Git.
3. What is the production application URL? It is required in credential emails and before pushing Auth configuration without replacing hosted redirects with localhost.
4. Is Vercel the approved hosting target, and are there region, data-residency, network, or Peter Island Resort and Spa IT constraints that affect hosting?
5. Is Microsoft Entra still planned for Microsoft 365 integrations only, now that Supabase password authentication is approved for sign-in?
6. Should ticket attachments use Supabase Storage, or is an existing Microsoft 365/Azure or other storage provider mandated?
7. Should durable asynchronous work use Supabase Queues (`pgmq`), or is another queue/service already approved and operated by Peter Island Resort and Spa?
8. Will the first release expose only Peter Island Resort and Spa or multiple properties? The Step 4 schema is property-aware from day one, so this now controls launch behavior and authorization policy rather than the physical data model.
9. Is Level.io integration limited to read-only device context, or should future technicians launch remote actions from the service desk? The answer changes credential scope, audit requirements, and whether direct device control belongs inside the system boundary.
10. Which departments and approval events should the reserved Department Approver role cover? The role and deny-by-default department boundary exist, but the role cannot be assigned until department membership and approval workflow are approved.
11. Will the Supabase plan support leaked-password protection, and should it be enabled before production launch? The hosted security advisor currently reports this Auth protection as disabled; application password policy and forced temporary-password replacement remain active.
