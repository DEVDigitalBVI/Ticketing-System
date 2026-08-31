# Peter Island Resort and Spa IT Service Desk — Open Questions

Last updated: 2026-08-31

Only questions that block implementation or materially change architecture, security, cost, or data design belong here.

Step 3 has no blocking product decision: the approved frontend baseline is stable and no backend behavior was introduced. The following questions remain intentionally open for later backend and deployment steps.

1. Where is the approved project blueprint? It is not present in the repository or the conversation payload available during Step 1, so its requirements and baseline architecture could not be verified.
2. Which server-only Supabase connection strings and least-privilege database role should the deployed application use? The hosted foundation is approved and migrated, but runtime pooling, direct migration access, deployment automation, and authentication-aware RLS policies remain undecided.
3. Is Vercel the approved hosting target, and are there region, data-residency, network, or Peter Island Resort and Spa IT constraints that affect hosting?
4. Which Microsoft Entra tenant will own the application registration, and should access be single-tenant for Peter Island Resort and Spa staff, multi-tenant, or also support guest/external identities?
5. Should ticket attachments use Supabase Storage, or is an existing Microsoft 365/Azure or other storage provider mandated?
6. Should durable asynchronous work use Supabase Queues (`pgmq`), or is another queue/service already approved and operated by Peter Island Resort and Spa?
7. Will the first release expose only Peter Island Resort and Spa or multiple properties? The Step 4 schema is property-aware from day one, so this now controls launch behavior and authorization policy rather than the physical data model.
8. Is Level.io integration limited to read-only device context, or should future technicians launch remote actions from the service desk? The answer changes credential scope, audit requirements, and whether direct device control belongs inside the system boundary.
