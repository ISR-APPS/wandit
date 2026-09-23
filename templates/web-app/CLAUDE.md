# Rules for the coding agent

You build a web app inside this project. These rules are binding.
The host machine runs the session. You write code; the host runs it.

## Interface contract

- The user describes the app in the chat. That brief is the product spec.
- You reply in the user's language. Always.
- User-provided assets (images, logos, texts) are facts. Never replace them.
- Never invent business facts: prices, addresses, phone numbers, opening hours.
- When a fact is missing, ask the user. See the ask_user contract below.
- You work inside this project only. Do not touch files outside it.

## Stack

- TanStack Start on Vite. SSR is on. Output target is Cloudflare Workers.
- TanStack Router with file-based routes in `src/routes/`.
- React 19, TypeScript strict, Tailwind v4, shadcn-style components in `src/components/ui/`.
- Supabase for auth and data through `src/lib/supabase.ts`.
- Biome for lint and format: `pnpm run lint`. Typecheck: `pnpm run typecheck`.

## What you must refuse

- Do not switch framework, router, styling system, or backend.
- Do not add a state library, an ORM, or a second i18n system.
- Do not remove the Supabase env check or return a null client.
- Do not edit `CLAUDE.md`, anything under `.claude/`, `.mcp.json`, `opencode.json`,
  `.git/`, `.env`, `.env.*`, or shell start-up files. The deny rules block it.
- Do not run `git push`, `git reset`, `git checkout`, `git switch`, `git rebase`,
  `git tag`, or any other git write command. The host commits, not you.
- Do not write arbitrary scripts for behaviors that have a contract, like the lead form.

## Route rules

- Public routes are prerendered at build time. The build crawls links from `/`.
- Routes behind login render in the browser (CSR). Set `ssr: false` on them.
- App logic runs in server functions: `createServerFn` from `@tanstack/react-start`.
- This is not a Vite SPA. There is no `dist/index.html` to patch.
- The document head lives in the root route `src/routes/__root.tsx`.

## Planning a turn

- Read the brief fully before you write code. Restate the goal in one line.
- Build small: one page, one section, or one fix per step.
- Run `pnpm run typecheck` and `pnpm run lint` before you finish a turn.

## When to build

- The brief names a page, a section, a style, or a fix: build it.
- A design world is already picked: load its skill and apply it.
- No world is picked: ask the user, or pick the closest world and say so.

## When to ask the user

- A fact is missing: price, phone, address, text content, image.
- A business decision is open: which language, which product, which offer.
- Do not ask for things the brief already answers.
- Batch related questions in one ask_user call.

## ask_user contract

- The tool name is `mcp__harness-tools__ask_user`.
- Input shape: `{ question, options?, kind?, helper? }`.
- `kind` is one of `single-choice`, `multi-select`, `free-text`, `attachments`.
- `question` is one clear sentence in the user's language.
- `options` is a list of `{ id, label, description? }`, at most 6.
- Zero options means a free-text question. The user can always type an answer.
- `helper` is one short line shown under the question.
- Ask at most when blocked. Batch related questions in one call.

## File layout

- `src/routes/`: one file per route. `__root.tsx` is the html shell.
- `src/components/`: page components. `src/components/ui/` holds the base kit.
- `src/lib/`: shared logic (supabase, leads, utils).
- `src/i18n/`: dictionaries and the `useT` hook.
- `src/styles/tokens.css`: the semantic design tokens.
- `src/wandit/preview-bridge.ts`: dev-only error bridge. Never call it yourself.
- `supabase/migrations/`: SQL migrations, forward-only.
- `.claude/skills/`: loadable instruction packs. Read them when a task fits.

## Design rules

- `src/styles/tokens.css` is the single source of colors, radius, and fonts.
- Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`).
- Never hardcode a color, a gray, or a shadow outside the token set.
- One design world applies per app. Load its skill from `.claude/skills/`.
- The world skill is the visual authority. It beats your default taste.
- Keep the font pairing in the root head. Arabic uses the twin fonts.
- Spacing scale: 4px steps. Use Tailwind spacing, not pixel values in `style`.
- Core content and actions must work with no animation library.
- Respect `prefers-reduced-motion` on every animation you add.

## Language rules

- The app supports `en`, `fr`, `ar`. Arabic is right to left.
- Build only the languages in `projects.languages`. Never delete a dictionary file.
- Every user-facing string goes through `t("key")` from `useT()`.
- Keys stay identical across `en.ts`, `fr.ts`, `ar.ts`. English is the source.
- `lang` and `dir` on `<html>` come from the provider. Do not override them.
- Use logical Tailwind utilities only: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`.
- Never use `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.
- Directional icons get `rtl:rotate-180`.
- Arabic text uses no italics.
- User-generated content renders with `dir="auto"`.

## Supabase rule

- A Supabase project exists from project creation. It is already provisioned.
- Browser code uses `getSupabase()`. Server functions use `getSupabaseServer()`.
- Both read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The sandbox env already holds both values. Never write them into a file.
- A missing value throws a clear error at start. Never catch it away.
- Never write a fallback for a missing backend. No "no backend yet" path.
- Data access stays behind the RLS policies in `supabase/migrations/`.

## Backend tools

- The host runs the backend tools. They reach you as `mcp__harness-tools__<name>`.
- `apply_migration`: applies one schema change. See Migrations.
- `get_advisors`: answers the security and performance findings of the database.
- `run_sql`: runs one read-only query, for checks. It answers at most 200 rows.
- `run_sql_write`: writes data. The user approves each call first.
- `deploy_function`: deploys the Edge Function in `supabase/functions/<slug>/`.
- `set_secret`: gives one secret to the Edge Functions as an env variable.
- Change the database and the functions only with these tools.
- Keep each Edge Function in one flat folder. `index.ts` is the entrypoint.
- A function imports no file from another folder, for example `_shared/`.
- `backend_paused` or `backend_not_ready`: tell the user. Stop the backend work.
- `rate_limited`: wait `retryAfterSeconds`, then call the tool again once.

## Secrets

- Never write a secret value in the chat, the code, or a tool input.
- Code that reads a secret runs in an Edge Function, with `Deno.env.get("NAME")`.
- Server functions do not get the secret. Call the Edge Function from them.
- A key of the user, for example a Stripe key: `set_secret` with `source: "project_secret"`.
- On `missing`, tell the user the secret name. The user adds it in the Cloud tab.
- A key the app makes, for example a signing key: `set_secret` with `source: "generate"`.
- `generate` keeps an existing value. It never replaces a key the app uses.
- Names that start with `SUPABASE_` are reserved. Edge Functions get them already.

## COD lead form contract

- The lead form fields are fixed: name, phone (`type="tel"`), wilaya, commune,
  product, quantity.
- The honeypot is exactly `<input type="text" name="website" data-wandit-hp
  tabindex="-1" autocomplete="off" aria-hidden="true" />`.
- Submit validates the fields, then dispatches
  `new CustomEvent("wandit:lead", { detail: fields })` on `document`.
- The form makes no network request. The host runtime owns the listener.
- A filled honeypot means a bot: report success and drop the lead.
- Keep the field names, the honeypot, the success state, and the dispatch.

## Migrations

- Migrations are forward-only. A migration never runs backwards.
- Migrations are additive: add tables, columns, indexes, and policies.
- Apply each migration with one `apply_migration` call. Never write the file yourself.
- The tool writes `supabase/migrations/<timestamp>_<name>.sql` after `0000_base.sql`.
- `name` uses `a-z`, `0-9`, and `_`, for example `create_notes`.
- One migration runs in one transaction. Do not use `begin`, `commit`, or `concurrently`.
- The same SQL twice is skipped. A new change needs a new migration.
- Every new table gets `enable row level security` and its policies in the same migration.
- Never give `anon` a `using (true)` policy, except on a table of public content.
- A migration that can destroy data answers `needs_approval`: drop, truncate,
  delete, update, merge, a column type change, `do`, `call`, or `select`.
- Then call `apply_destructive_migration` with the same input, only when the brief needs it.
- After each migration, call `get_advisors`.
- Fix every `error` finding with a new migration before the turn ends.
- Then call `get_advisors` again. Report the `warn` findings to the user in one line.
- Use `run_sql` to check the result. Never use it to change the schema.
- A restore is code only: new migrations that recreate state. No rollback files.

## Third-party scripts (pixels)

- A pixel id or a third-party script from the user goes into the root route head.
- Add it once, in the `head()` of `src/routes/__root.tsx`, at the marked spot.
- Never put it in a page component. Never duplicate it.

## Commits

- The host commits your work. You run no git write command.
- `git status` and `git diff` for reading are fine.
