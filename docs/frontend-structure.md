# Frontend structure (`apps/web`)

## Purpose

Feature-based structure: all product code lives in `src/features/<feature>/`, and `src/routes/` is thin wiring only. A feature is deletable — removing its folder plus its route file(s) removes the feature.

**What earns a feature folder:** a UI surface the user navigates to (a page, or a cross-route overlay like the auth modal), or a concern that renders on several pages (credits). Something that only renders inside another feature's shell is NOT a feature — it's a component group of that feature (the leads table is a workspace view, not a top-level feature).

## The structure

```
apps/web/src/
├── routes/                     # TanStack Router file routes — THIN: wire params/guards to a feature page
│   ├── __root.tsx              # providers, head, global layout
│   ├── index.tsx               # → features/landing
│   ├── login.tsx               # scaffold leftover — dies when the auth modal lands (ISRECOM-28)
│   └── _auth/                  # pathless layout: session guard for everything inside
│       ├── route.tsx
│       ├── dashboard.tsx       # → features/projects
│       └── p.$projectId.tsx    # → features/workspace
├── features/
│   ├── landing/                # `/` — hero prompt box, examples, pricing
│   ├── auth/                   # cross-route overlay — auth modal, Google popup, magic link, prompt stash
│   ├── projects/               # `/dashboard` + project domain: grid, cards, create-with-prompt, switcher
│   ├── workspace/              # `/p/$projectId` — the shell and ALL its views:
│   │   ├── pages/              #   workspace-page
│   │   ├── api/                #   chats/messages/versions/leads/deployments queries & mutations
│   │   ├── components/
│   │   │   ├── chat/           #   left pane: message list, input, streaming
│   │   │   ├── canvas/         #   right pane: preview iframe, version switcher, viewport toggle
│   │   │   ├── assets/         #   right pane: artifact/version list
│   │   │   ├── leads/          #   right pane: order-CRM table, status pipeline, counters, CSV
│   │   │   └── settings/       #   right pane: rename, pixels, publish slug/rollback, danger zone
│   │   └── lib/                #   SSE client, preview helpers, workspace store (active tab…)
│   └── credits/                # cross-page: balance chip (both headers), price tags, insufficient modal
├── components/                 # shared app chrome only (loader, theme, mode toggle)
├── lib/                        # shared infra: query client, api client — nothing feature-specific
└── main.tsx
```

**`features/projects/` is the reference feature** — it carries every possible folder and file as comment-stub examples. When fleshing out any feature, mirror its shape:

```
features/projects/                       ← THE EXEMPLAR
├── api/                     # server-state layer
│   ├── dto.ts               #   types derived from packages/contracts (z.infer) — never redeclared
│   ├── projects.services.ts #   raw fetch functions, no React — reused by queries/mutations AND route loaders
│   ├── projects.queries.ts  #   TanStack Query queries + query keys (queryFn → services), one file per entity
│   └── projects.mutations.ts#   mutations wrapping services + cache invalidation/optimistic updates
├── components/              # feature UI — group by sub-area when it grows (workspace/components/chat/)
│   ├── project-card.tsx
│   └── project-switcher.tsx
├── lib/                     # client-side logic
│   ├── constants.ts         #   feature constants (page sizes, limits…)
│   ├── schemas.ts           #   zod form schemas (UI-side; server contracts live in packages/contracts)
│   ├── helpers.ts           #   pure functions
│   ├── hooks.ts             #   feature hooks that aren't queries/mutations
│   └── store.ts             #   shared feature UI state
├── pages/                   # page components rendered by route files (only if the feature owns a route)
│   └── dashboard-page.tsx
└── index.ts                 # public barrel — the feature's ONLY surface for other features
```

## Working model

- **Mirror the exemplar, create on demand.** Other features hold only what's real (plus `.gitkeep` placeholders for their planned areas); when building one out, copy the shape of `features/projects/` — same folder meanings, same file naming. Fill files in place; don't invent parallel homes.
- **Routes stay thin.** A route file declares path/guard/loader wiring and renders a feature page — `p.$projectId.tsx` reading params and passing `projectId` down is the maximum. `autoCodeSplitting` keeps `/` light and lazy-loads the workspace per the PRD.
- **`api/` vs `lib/`:** `api/` is the server-state layer — TanStack Query `<entity>.queries.ts` / `<entity>.mutations.ts` typed by `packages/contracts`. `lib/` is client-side logic — form schemas, constants, UI store, helpers.
- **Cross-feature imports go through the feature's `index.ts` barrel** (e.g. header renders `UserMenu` from `@/features/auth`). Inside a feature, import directly — never through your own barrel. Pages are not exported from barrels; routes import them by direct path (keeps route chunks clean).
- **Workspace owns its views.** Chat, canvas, assets, leads, settings render only inside the workspace shell, so they live under `workspace/components/*` with their data files in `workspace/api/`. If a view ever becomes its own page, promote it to a feature then — not before.
- **`src/components` and `src/lib` are deliberately small.** If a file could be named after a feature, it lives in that feature. Generic UI primitives stay in `packages/ui` (shadcn-style) — never in features.

## Does not own

- Copy, translations, and RTL — all user-facing strings go through `@wandit/internationalization`; see `docs/localization.md`.
- Feature scope/behavior — see `docs/features/*.md`; routes/IA — see PRD §4.
- Server or worker structure — light-DDD modules per domain; see `apps/server/src/modules/README.md`.

Source docs: docs/PRD.md, docs/frontend-structure.md
