# @wandit/contracts

Shared HTTP contracts between `apps/web` and `apps/server` — Zod schemas plus
their inferred types. This package is the single source of truth for every
request/response shape that crosses the wire; neither side ever redeclares one.

Consumed as raw TypeScript source (exports point at `src/*.ts`, no build step),
like every other package in this repo.

## Layout

```
src/
├── index.ts            # flat `export *` barrel — every file is listed here
├── http/               # transport plumbing, not domain shapes
│   ├── envelope.ts     #   { data, meta } success + { error } failure envelopes
│   └── pagination.ts   #   PaginationQuery / PaginatedResult
└── v1/                 # one file per domain, matching the /api/v1 URL space
    ├── shared/
    │   └── primitives.ts  # uuid / ISO-datetime field primitives
    ├── projects.ts     # the exemplar — copy its idiom for new domains
    ├── chats.ts
    ├── artifacts.ts
    ├── deployments.ts
    ├── leads.ts
    └── credits.ts
```

## Idiom (see `v1/projects.ts` for all of it in one place)

- **Zod first**: `export const projectSchema = z.object({…})` then
  `export type Project = z.infer<typeof projectSchema>`. Types are always
  derived, never hand-written next to a schema.
- **Enums** are `as const` tuples + `z.enum(tuple)`, and mirror the Postgres
  enums in `packages/db/src/schema/*` verbatim (`to_confirm`, not `to-confirm`).
- **Route maps**: each domain file ends with an
  `export const <domain>Routes = {…} as const` of full `/api/v1/…` paths —
  string constants for static routes, functions for parameterized ones. Web
  services and Nest controllers both read from these.
- **Scalars**: ids are `uuidSchema`, timestamps are `isoDateTimeSchema`
  (server serializes with `Date#toISOString`). Exception: chat message ids are
  plain strings (AI SDK generates them client/worker-side).
- **Envelope stays out of domain schemas**: domain files describe the `data`
  payload only. The server's interceptor/filter add the envelope; the web api
  client (`apps/web/src/lib/BaseService.ts`) strips it.

## Adding a domain

1. Create `src/v1/<domain>.ts` (or extend the existing stub) following the
   idiom above.
2. Add its `export *` line to `src/index.ts` (keep the list alphabetical).
3. Web: feature `api/dto.ts` re-exports the inferred types; services call
   routes from the route map. Server: DTOs/pipes validate with the schemas.
