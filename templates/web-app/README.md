# web-app template

TanStack Start + Vite + Cloudflare Workers starter for generated wandit sites.
React 19, TanStack Router, TanStack Query, Tailwind v4, shadcn-style UI, Supabase,
and i18n with one language by default (more on request, RTL ready).

## How the template reaches the sandbox

1. `pnpm run pack` writes `web-app-<version>.tar.gz` next to this folder.
2. The sandbox init uploads the archive through the `writeFiles` interface.
3. The sandbox extracts it into `<sandbox cwd>/workspace` (`/vercel/workspace` on the node:22 image).
4. `pnpm install --frozen-lockfile --offline` runs inside the sandbox. It works when the
   image has a warm pnpm store (`tooling/sandbox-image/`). Otherwise the install falls
   back to the npm registry.

## Source layout

- `src/routes/`: thin route files. Each one renders one feature component.
  `src/routes/app.tsx` is the layout of the area behind login. It checks the
  session, renders the app shell, and has `ssr: false`. Its children are the
  files in `src/routes/app/`: `index.tsx` and `profile.tsx`. The template
  `index.tsx` redirects to the profile. A generated app replaces it with its home.
- `src/features/<feature>/`: `api/` (TanStack Query options, mutations, server
  functions), `components/`, `hooks/`, `lib/`, and the `index.ts` barrel.
  `features/profile/` is the example that the agent copies.
- `src/features/app-shell/`: the frame of every page behind login. The sidebar,
  the header bar, the user menu with Sign out, and `PageHeader`. The nav items
  are in `lib/nav-items.ts`; their `to` has the route type, so a wrong path
  fails typecheck.
- `src/shared/`: the UI kit (`ui/`), the Supabase client (`lib/`), and i18n (`i18n/`).
- `src/styles/tokens.css`: the entry CSS. It maps the role tokens to Tailwind
  names and holds the app utilities. It never declares a theme token (see "Theme engine").
- `src/wandit/`: host files (the dev-only preview bridge).

## Commands

- `pnpm run dev` — dev server on `0.0.0.0:5173`, strict port.
- `pnpm run build` — production build for Cloudflare Workers.
- `pnpm run typecheck` — `tsc6 --noEmit`, then `scripts/check-effects.mjs`, which
  fails on a `useEffect` without a `// effect: <reason>` comment on the line above,
  and `scripts/check-theme.mjs` (see "Theme engine").
- `pnpm run lint` — `biome check --error-on-warnings .`
- `pnpm run smoke` — frozen install, typecheck, lint, build, output checks, the
  effect-check self-test, the HMR host check, and a 640 MB ceiling on the
  installed dev tree (the same tree the sandbox installs; workerd alone is about
  146 MB of it).
- `pnpm run pack` — write the distributable archive.
- `node --env-file=.env scripts/create-test-user.mjs` — the agent creates one test
  account with the anon key and gives its email and password to the user.

## Theme engine

Every page takes its look from one file, `src/styles/theme.json`. Only the host writes it.

- `src/styles/theme.json`: the choices (`selection`: look, mode, radius, sidebar, and the other axes)
  and the values that the host computes from them (`resolved`: the light and dark palettes, the fonts, the voice).
- `src/styles/theme-options.ts`: the value lists of each axis. It equals `APP_THEME_OPTIONS` of the host.
- `src/styles/theme.ts`: the zod schema of the file, `useAppTheme()`, and the helpers that `__root.tsx`
  uses to put the theme on `<html>`: data-* attributes, the dark class, and the palette and font variables.
- `src/styles/engine.css`: maps those variables to the role tokens, with one block for each axis value.
- The deny rules of `.claude/settings.json` block agent edits to these four files.
- In the builder preview, the bridge shows a draft theme live (`wandit:theme` message). It needs no reload.
- `scripts/check-theme.mjs` fails on a palette or raw color, a fixed shadow, or an emoji in a page.
  In the app area it also fails on capital text, wide tracking, a fixed corner, a thick border, an ink band,
  or an arbitrary font. In a CSS file of `src` it fails on a declaration of a theme token, a raw color,
  capital text, or a Tailwind color, radius, shadow, or font name with a value that is not a token.

## Build output

`pnpm run build` writes into `dist/`:

- `dist/client/` — static assets and the prerendered HTML pages
  (`dist/client/assets/` holds hashed JS/CSS; `dist/client/index.html` is the
  prerendered landing page; `dist/client/login/`, `dist/client/app/`, and
  `dist/client/app/profile/` hold their prerendered shells).
- `dist/server/index.js` — the Worker entry bundle.
- `dist/server/wrangler.json` — the generated Wrangler config the deploy uses.

One Worker serves the SSR routes and holds the static assets inside it.
Public routes (`/`, `/login`) prerender to full HTML at build time.
`/app` and its children render in the browser only (`ssr: false`). Their
prerendered files are shells that the client-side code fills on load.

## Environment

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — the host writes them to `.env` when the backend is ready.
  A missing value throws at the first Supabase client call (D18). Pages that make no call still render.
- `WANDIT_PREVIEW_HOST` — set by the sandbox in dev. Used for
  `server.allowedHosts` only. The HMR client connects to the page host on
  port 443, so the sandbox host never reaches the browser.

## Skills

`.claude/skills/` is generated by `apps/server/scripts/export-world-skills.ts`,
except `frontend-design/` and `app-dashboard/`. The sum of all world
descriptions passed 8 KB, so the index is split into three skills instead of
one: `design-worlds-website`,
`design-worlds-product`, `design-worlds-cod`. Each world has its own
`<id>/SKILL.md`, plus the six `ads-*` playbooks. Re-run the export script to
regenerate; it is idempotent. The export rewrites two V1 data paths for V2: the
form rule of each world points at the public form contract in `CLAUDE.md`, and
the ads skills point at the app's own leads table instead of the V1 Leads tab.
It fails when a V1 phrase has a form that it does not know (WANDIT-273).

`frontend-design/` is Anthropic's frontend design skill, copied unchanged from the
`frontend-design` Claude Code plugin with its `LICENSE.txt` (Apache License 2.0).
The export keeps this folder.

`app-dashboard/` is written by hand for the area behind login of an app.
`SKILL.md` explains the app recipe that the host puts in the session
instructions (`apps/server/src/modules/app-builder/domain/app-recipe.ts`) and
the set_theme host tool. The option files sit beside it: `data.md`, `tables.md`,
`tables-paging.md`, and the folders `homes/`, `kpis/`, and `charts/`. The home,
KPI, and chart files hold specs, not code. The theme engine draws the look, so no
skill file holds a palette or a shell. The agent reads only the files of its recipe. The
folder holds Markdown only, because Biome lints the code files under `.claude/`
and the agent cannot fix them. The export keeps this folder with its subfolders.

## Notes for the coding agent

Read `CLAUDE.md` first. The deny rules live in `.claude/settings.json`;
`.claude/hooks/pre-tool-use.mjs` enforces them before every tool call.

UNVERIFIED: the exact Claude Code permission-rule syntax in
`.claude/settings.json` (no `@anthropic-ai/claude-*` package was installed to
check against). The PreToolUse hook enforces the same list regardless, so the
guard works even if a rule string needs a different form.
