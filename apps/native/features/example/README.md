# `features/example` — the reference feature (COPY ME)

This folder is **not a real feature and is not wired to any route.** It is the
canonical template that shows how every feature in this app is structured and how
it connects to the backend. When you build a real feature (projects, credits,
chat…), copy this folder, rename `example` → your feature, and delete this README.

## The folder shape

```
features/example/
├─ api/                         ← everything that talks to the backend
│  ├─ example.requests.ts       ← the actual HTTP calls (the "service" of the phone)
│  ├─ example.keys.ts           ← react-query cache keys, centralized
│  ├─ example.queries.ts        ← READ hooks  (useExamples, useExample)
│  └─ example.mutations.ts      ← WRITE hooks (useCreateExample, useDeleteExample)
├─ components/                  ← UI used ONLY by this feature
│  └─ example-card.tsx
├─ lib/                         ← everything that isn't UI or network
│  ├─ example.schemas.ts        ← data shapes + Zod (REAL features import these from @wandit/contracts)
│  ├─ example.constants.ts      ← endpoints, page sizes, limits
│  ├─ example.helpers.ts        ← pure, testable data functions
│  └─ use-example-filters.ts    ← a feature-local UI hook (local view state)
├─ screens/                    ← the full screen a route renders
│  └─ example-screen.tsx
└─ index.ts                    ← barrel: exports everything EXCEPT screens
```

## How a request flows (learn this once)

```
ExampleScreen
  → useExamples()                (api/example.queries.ts — caching + loading state)
    → getExamples()              (api/example.requests.ts — the real call + Zod validation)
      → apiClient.get(...)       (shared/lib/api-client.ts — friendly wrapper)
        → BaseService            (shared/lib/base-service.ts — axios: base URL, session cookie, /api/v1, errors)
          → NestJS backend
```

## The rules this template encodes

1. **`app/` is wiring only.** A route imports a screen and renders it — no logic.
2. **Feature-first.** Code for one feature stays in that feature. It only moves to
   `shared/` when a *second* feature needs it.
3. **The barrel exports everything except screens.** Routes import screens directly.
4. **Only `api/` (and `shared/lib`) touch the network.** Components/screens use
   the query/mutation hooks — never raw requests, never axios.
5. **No new top-level folders.** Unsure where something goes? It's a feature or
   `shared/lib` — never a brand-new door.

## The one thing that differs from web

The phone has no browser cookie jar. `shared/lib/base-service.ts` reads the
session cookie that `@better-auth/expo` saved in SecureStore (via
`authClient.getCookie()`) and attaches it to every request by hand. That manual
step is what web gets for free from `withCredentials: true`.
