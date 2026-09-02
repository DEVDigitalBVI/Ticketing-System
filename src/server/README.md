# Server infrastructure

Server-only infrastructure and application data access belong here.

- `database/` owns Prisma client construction and connection pooling.
- `repositories/` owns typed persistence operations used by services and route handlers.
- `auth/`, `configuration/`, `sla/`, and `tickets/` own their server-side domain rules.

React components and route handlers must not contain raw Prisma or SQL queries. Provider clients and persistence stay behind server modules.
