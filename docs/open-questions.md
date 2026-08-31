# Peter Island Resort and Spa IT Service Desk — Open Questions

Last updated: 2026-08-30

Only questions that block implementation or materially change architecture, security, cost, or data design belong here.

1. Where is the approved project blueprint? It is not present in the repository or the conversation payload available during Step 1, so its requirements and baseline architecture could not be verified.
2. Do you approve ADR-001's baseline: Next.js App Router with TypeScript and Supabase, or does the blueprint specify a different application architecture?
3. Is Vercel the approved hosting target, and are there region, data-residency, network, or Peter Island Resort and Spa IT constraints that affect hosting?
4. Is `pnpm` the approved package manager?
5. Which Microsoft Entra tenant will own the application registration, and should access be single-tenant for Peter Island Resort and Spa staff, multi-tenant, or also support guest/external identities?
6. Should ticket attachments use Supabase Storage, or is an existing Microsoft 365/Azure or other storage provider mandated?
7. Should durable asynchronous work use Supabase Queues (`pgmq`), or is another queue/service already approved and operated by Peter Island Resort and Spa?
8. Will the first release serve only Peter Island Resort and Spa, or should it launch for multiple properties? If it starts with Peter Island Resort and Spa only, should the schema and authorization model still be property-aware from day one?
