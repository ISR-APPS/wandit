# Native structure (`apps/native`)

## Purpose

Feature-based structure for the Expo app, mirroring `docs/frontend-structure.md`: all product code lives in `features/<feature>/`, and `app/` (Expo Router file routes) is thin wiring only. A feature is deletable — removing its folder plus its route file(s) removes the feature.

The native IA is Lovable-style, prompt-first: sign in → home ("What do you want to build?") with a projects drawer → project workspace with top tabs and a persistent chat bar at the bottom.

## The structure

```
apps/native/
├── app/                              # Expo Router file routes — THIN: wire params/guards to a feature screen
│   ├── _layout.tsx                   # providers + auth gate (Stack.Protected on Better Auth session)
│   ├── +not-found.tsx
│   ├── (auth)/                       # signed-OUT group
│   │   ├── _layout.tsx
│   │   └── sign-in.tsx               # → features/auth
│   └── (app)/                        # signed-IN group (Stack)
│       ├── _layout.tsx
│       ├── (drawer)/                 # drawer wraps home; drawer content = projects list
│       │   ├── _layout.tsx           # Drawer, drawerContent → features/projects
│       │   └── index.tsx             # → features/home (prompt-first home)
│       └── project/[projectId]/      # workspace, pushed OVER the drawer
│           ├── _layout.tsx           # → features/workspace WorkspaceShell (headless tabs, expo-router/ui)
│           ├── index.tsx             # → workspace ChatScreen (default tab)
│           ├── preview.tsx           # → workspace PreviewScreen
│           ├── leads.tsx             # → workspace LeadsScreen
│           └── settings.tsx          # → workspace SettingsScreen
├── features/
│   ├── auth/                         # sign-in screen + auth forms
│   ├── home/                         # prompt box, "What do you want to build?"
│   ├── projects/                     # projects drawer (list, sign-out footer); api/ to come
│   └── workspace/                    # the project shell and ALL its views:
│       ├── api/                      #   chats/messages/versions/leads queries (to come)
│       ├── components/
│       │   ├── workspace-shell.tsx   #   header + top tab bar + TabSlot + composer
│       │   ├── workspace-header.tsx  #   back + project name (publish/credits later)
│       │   ├── workspace-tab-button.tsx
│       │   └── chat/chat-composer.tsx#   persistent bottom chat bar
│       ├── lib/                      #   SSE client, workspace store (to come)
│       └── screens/                  #   chat / preview / leads / settings tab screens
├── components/                       # shared app chrome only (container, theme toggle)
├── contexts/                         # app-wide contexts (theme)
└── lib/                              # shared infra (auth client) — nothing feature-specific
```

Each feature mirrors the web exemplar (`apps/web/src/features/projects/`), with one rename: **`screens/` here ≈ `pages/` on web**. Same meanings for `api/` (server state), `lib/` (client logic: constants, schemas, hooks, store), `components/`, and `index.ts` (public barrel).

## Working model

- **Routes stay thin.** A route file reads params/guards and renders a feature screen — `project/[projectId]/_layout.tsx` passing `projectId` to `WorkspaceShell` is the maximum.
- **Auth gate lives in `app/_layout.tsx`.** `Stack.Protected` guarded by `authClient.useSession()`: signed out → `(auth)`, signed in → `(app)`. Auth is a screen on native (no modal-over-route like web).
- **Workspace tabs are headless** (`expo-router/ui` Tabs/TabList/TabTrigger/TabSlot) so the tab bar renders at the top and the chat composer stays docked at the bottom across tabs.
- **Cross-feature imports go through the feature's `index.ts` barrel** (e.g. the workspace header reads `MOCK_PROJECTS` from `@/features/projects`). Inside a feature, import directly — never through your own barrel. Screens are not exported from barrels; routes import them by direct path.
- **Mock data is temporary seam.** `features/projects/lib/constants.ts` holds `MOCK_PROJECTS`; replace with `api/` queries typed by `packages/contracts` when the mobile API layer lands.
- **pnpm `node-linker=isolated`:** never import from transitive deps (`@react-navigation/*`); type structurally or use what `expo-router` re-exports.
- **`components/` and `lib/` stay deliberately small.** If a file could be named after a feature, it lives in that feature.

## Does not own

- Feature scope/behavior — see `docs/features/*.md`; product IA — see PRD §4.
- Web structure — see `docs/frontend-structure.md`.

Source docs: docs/PRD.md, docs/frontend-structure.md
