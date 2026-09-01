# Server infrastructure

Server-only infrastructure and application data access belong here.

- `database/` owns Prisma client construction and connection pooling.
- `repositories/` owns typed persistence operations used by future services and route handlers.
- `tickets/` owns the core ticket workflow rules and service-layer mutations.

React components and route handlers must not contain raw Prisma or SQL queries. Authentication, ticket persistence, and external-service adapters remain deferred.
