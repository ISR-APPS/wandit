<!-- This file directs the coding agent inside each generated project.
It connects the user brief to the local skills and template source. -->
# Rules for the coding agent

You build a web app for a non-technical user inside this project. These rules are binding.
The host machine runs the session and commits your work.

## Every turn

1. Read the user's message fully. Restate the goal in one line.
2. Plan before you write code. Write the plan in 3 to 8 short lines:
   the pages, the data (tables, who reads, who writes), and the features and files you add.
3. Ask only when you are blocked. See "Ask the user".
4. Build in small steps. Each step leaves the app working.
5. Run the checks in "Done". Fix every failure.
6. Answer the user as "Final answer" says.

## Interface contract

- The user's message is the product spec. Reply in the user's language. Always.
- User assets (images, logos, texts) are facts. Never replace them.
- Never invent business facts: prices, addresses, phone numbers, opening hours, reviews.
- You work inside this project only. Do not touch files outside it.

## Stack

- TanStack Start on Vite. SSR is on. The output target is Cloudflare Workers.
- TanStack Router with file-based routes in `src/routes/`.
- React 19, TypeScript strict, Tailwind v4, shadcn-style components in `src/shared/ui/`.
- TanStack Query (`@tanstack/react-query`) for all server data.
- Supabase for auth and data through `src/shared/lib/supabase.ts`.
- Biome for lint and format: `pnpm run lint`. Typecheck and effect check: `pnpm run typecheck`.

## What you must refuse

- Do not switch framework, router, styling system, data library, or backend.
- Do not add a state library, an ORM, or a second i18n system.
- Do not remove the Supabase env check or return a null client.
- The deny rules in `.claude/settings.json` block edits to `CLAUDE.md`, `CLAUDE.local.md`,
  `AGENTS.md`, `.claude/`, `.mcp.json`, `opencode.json`, `.git/hooks/`, `.git/config`,
  `.env`, `.env.*`, `.npmrc`, `.pnpmfile.cjs`, `.pnpmfile.mjs`, `pnpm-workspace.yaml`,
  `template_version`, `native-modules.json`, and shell start-up files.
  Do not change these files in another way.
- When pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm remove <name>` for the package
  you added. Then tell the user and pick another package. Leave the `allowBuilds` line
  that pnpm writes into `pnpm-workspace.yaml`.
- Do not run `git push`, `git reset`, `git checkout`, `git switch`, `git rebase`,
  `git tag`, or any other git write command. The host commits, not you.
- A shell command that writes a file must name a literal path, such as `/tmp/page.html`.
  The hook blocks a write path with a variable, a glob, or braces, such as `/tmp/p-$i.html`.
  Write one command for each file, not a loop.
- Do not write arbitrary scripts for behaviors that have a contract, like the public form.

## Structure

The app is split by feature. `src/features/profile/` is the example: copy its shape.

```
src/
  routes/              thin route files: path, guard, loader, one feature component
  features/<feature>/  one folder per page or per concern (auth, booking, menu)
    api/               server data: <entity>.queries.ts, <entity>.mutations.ts, <entity>.functions.ts
    components/        the UI of the feature, its page component too
    hooks/             hooks that are not queries or mutations
    lib/               zod form schemas, constants, pure helpers
    index.ts           the public barrel of the feature
  shared/              code that two or more features use
    ui/                the base kit. Add a new primitive here.
    lib/               supabase.ts, utils.ts
    i18n/              messages.ts, useT, the language config
  styles/tokens.css    the design tokens
  wandit/              host files. Never edit them and never call them.
supabase/migrations/   written only by `apply_migration`
vite-plugins/          host files: dev-only source tags for click-to-edit
```

- Keep `vite-plugins/wandit-source.ts`, its entry in `vite.config.ts`, and the bridge install
  at the top of `src/routes/__root.tsx`. Click-to-edit in the preview needs all three.
- Code outside a feature imports only from the feature's `index.ts`. Inside a feature, import files directly.
- A route file holds the path, the guard, the loader, and one feature component. No markup, no fetch, no state.
- Move code to `shared/` only when a second feature needs it.
- Create a folder only when it gets a file. Delete an example feature that the app does not need.
- One component per file. File names are kebab-case.
- Public routes are prerendered at build time. The build crawls links from `/`.
- Routes behind login render in the browser: `ssr: false`, and
  `beforeLoad: async () => ({ session: await requireSession() })` with `requireSession` from `~/features/auth`.
- App logic that needs the server runs in `createServerFn` from `@tanstack/react-start`.
- This is not a Vite SPA. There is no `dist/index.html` to patch. The document head lives in `src/routes/__root.tsx`.

## Server data

- Every Supabase call lives in `features/<feature>/api/`. A component never calls `getSupabase()`.
- A read is a `<entity>QueryOptions(...)` function made with `queryOptions()` in `<entity>.queries.ts`.
  The query key starts with the entity name, for example `["bookings", day]`.
- A route that needs data: its loader calls `context.queryClient.query(options)`,
  and the page calls `useSuspenseQuery(options)`. See `src/routes/app.tsx`.
- Data that loads later, for example after a click: `useQuery(options)`, with a loading and an error state.
- A write is a `use<Action>Mutation()` hook made with `useMutation()` in `<entity>.mutations.ts`.
  Its `onSuccess` invalidates the queries that the write changes.
- A write that needs the server (a secret, a public form, a trust check) goes through a
  `createServerFn` in `<entity>.functions.ts`, and the mutation calls that function.
  Never name a file `*.server.ts`: the build refuses it in browser code.
- In a `queryFn` or a `mutationFn`, throw on a Supabase error. The component reads `isError` and shows a message.
- Never copy server data into `useState`. Never fetch in `useEffect`.

## Effects

- Do not use `useEffect` for app logic. Use these instead:
  - Derive a value during render: `const total = items.reduce(...)`.
  - Run the code in the event handler of the user action (submit, click, change).
  - Read server data with TanStack Query. Load route data in the loader.
  - Read a browser store (localStorage, a media query) with `useSyncExternalStore`.
  - Reset the state of a component with a new `key` prop.
- An effect is allowed only to sync with an external system, for example a third-party widget.
  Then the line directly above the effect is `// effect: <reason>`
  (a `// biome-ignore` line may sit between the two).
- `pnpm run typecheck` runs `scripts/check-effects.mjs`. It fails on an effect without that comment.

## Workspace structure

- First select the product structure from the requested user task.
- SaaS, admin, CRM, analytics, and internal tools use `.claude/skills/dashboard/SKILL.md`.
- The words "SaaS" and "product" do not mean a marketing page.
- Build the functional workspace first. A KPI grid is not required for every app.
- An explicit marketing or landing-page request uses the matching design-world skill.
- An explicit request for both gets separate marketing and workspace routes.
- For a new workspace-only app, `/` leads to the workspace through the existing authentication flow.
- Do not add a marketing page before the workspace unless the user requests one.
- For existing apps, preserve routes and layout unless the requested change requires their modification.
- Use `src/shared/ui/dashboard-shell.tsx` for workspace navigation and static shell variants.
- Use `src/shared/ui/dashboard-content.tsx` for page headers, metrics, and workspace compositions.
- The feature component owns the domain data and workflow. Routes remain thin.

## Design

- Load the `frontend-design` skill before every new screen and every redesign.
  It gives the process and the quality bar: plan the tokens, check the plan against the brief,
  build, then check screenshots and fix.
- A design world gives the direction: palette, fonts, voice, motifs. One world applies per app.
  Workspace structure comes from the dashboard skill and the actual task.
  Landing-page sections from a world do not replace workspace structure.
  The world wins on every visual choice that it names. `frontend-design` wins on quality:
  hierarchy, spacing, contrast, accessibility, restraint.
- This file comes before both skills. A skill section that needs a fact the user did not give
  (a quote, a price, an address, a team member): ask for it, or leave the section out.
- For a marketing page with no selected world: offer 2 to 4 worlds in the first `ask_user` call,
  or pick the closest world and say so. The index skills list the worlds:
  `design-worlds-website`, `design-worlds-product`, `design-worlds-cod`.
- `src/styles/tokens.css` is the single source of colors, radius, and font names. Put the world tokens there.
  World skills name the fonts `--font-heading` and `--font-body`. In this template they are
  `--font-display` and `--font-sans`.
- Use existing project design choices before the harness defaults. An explicit user choice takes priority.
- Save new shell, palette, radius, width, and density choices as static literals and CSS tokens.
  Keep these choices on later turns. Never select them again during rendering.
- Add no theme picker unless the user requests one.
- Load the world fonts in `head().links` of `src/routes/__root.tsx`, and remove the links
  that you replace. A world that names an Arabic font: change `html:lang(ar)` in `tokens.css`.
- Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`).
  Never hardcode a color, a gray, or a shadow outside the token set.
- Every screen works at 375 px wide. Spacing uses the Tailwind scale, not pixel values in `style`.
- Every data view has a loading state (`Skeleton`), an empty state (one sentence and one action),
  and an error state (what failed and what to do).
- Core content and actions work with no animation library. Respect `prefers-reduced-motion`.

## Languages

- The app has one language. Add a second language only when the user asks for it.
- The user did not name the app language: ask once, in the first `ask_user` call of the first build.
  Use one `single-choice` question with the options French, English, and Arabic.
  The user can type another language.
- No answer (`delegated` or `dismissed`): French when the user writes in French, else English.
- Your session instructions name the language of the user's wandit interface. It is a hint, not a decision:
  put that language first in the question.
- Set the language in `src/shared/i18n/config.ts`: `locales = ["fr"]`, for example.
  Write `messages.ts` in that language. Key the dictionary with the same code in `translate.ts`.
- Later turns keep the language of `config.ts`. Do not ask again.
- A second language: add its code to `locales`, add `messages.<code>.ts` with the same keys
  (type `Dictionary`), and add it to `translate.ts`. The language switcher then shows by itself.
- A language that is not `en`, `fr`, or `ar`: first add its row to `localeMeta` in `config.ts`.
- Every user-facing string goes through `t("key")` from `useT()`.
- `lang` and `dir` on `<html>` come from the provider. Do not override them.
- Use logical Tailwind utilities only: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`.
  Never use `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.
  Then Arabic works without a rewrite.
- Arabic: `config.ts` gives `dir="rtl"`, and `tokens.css` swaps in the Arabic twin fonts.
  Directional icons get `rtl:rotate-180`. Arabic text uses no italics.
- User-generated content renders with `dir="auto"`.

## Ask the user

- Ask only when you are blocked: a missing fact (price, phone, address, text, image),
  or a business choice (which product, which offer).
- The app language is the exception: ask it in the first build, also when you can guess it.
  Skip it only when the user's message names the app language.
- Do not ask for things that the message already answers.
- Put every question of one step in one `mcp__harness-tools__ask_user` call, at most 4.
  The tool description gives the input shape and the answer shape.
- The first build asks its open choices together: the app language, the design world, and missing facts.

## Supabase

- A Supabase project exists from project creation. It is already provisioned.
- Browser code uses `getSupabase()`. Server functions use `getSupabaseServer()`.
  Both live in `src/shared/lib/supabase.ts` and read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The host writes both values to `.env`. Never edit `.env` or copy the values into another file.
- A missing value throws a clear error at the first client call. Never catch it away.
- Never write a fallback for a missing backend. No "no backend yet" path.
- Data access stays behind the RLS policies in `supabase/migrations/`.

## Sign-in

- The only sign-in method is Supabase email and password. `src/features/auth/` shows it:
  sign-up, sign-in, sign-out, and the `/app` guard.
- The sign-up form has three fields: email, password, and confirm password.
  A zod schema with `refine` checks that the two passwords match.
- Email confirmation is off for this project. `signUp` returns a session at once.
  Do not build a "check your email" step.
- Do not build OAuth sign-in (Google, Apple, or another provider), magic link sign-in,
  or phone code sign-in, even when the user asks. Tell the user that only email and
  password sign-in is available for now.
- The first turn that builds an app with sign-in creates one test account:
  `node --env-file=.env scripts/create-test-user.mjs`
  It prints an email and a password. Give both to the user in the final answer.
  Create it once per app, not in every turn.
- The script fails: tell the user that the sign-up page works, and try again in the next turn.

## Done

Run these before you say that the work is done:

- `pnpm run typecheck` (TypeScript and the effect check) and `pnpm run lint`. Both pass with no error.
- No fake data: lists show real rows or facts from the user. No lorem ipsum, no invented reviews or prices.
- No dead buttons: every button and link does a real thing, or it does not exist.
- Every new screen has its loading, empty, and error states, and works at 375 px wide.

## Final answer

- Short, in the user's language, in plain words for a person who does not code.
  No file names, no code, no technical words.
- Say what the user can do now, in 2 to 5 points.
- The turn created the test account: give its email and password.
- Name what is still missing, and suggest one next step.

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

## Public form contract

A public form is a form that a visitor sends without an account: an order, a
booking, a contact request, a sign-up for news. A design skill gives its look.
This section gives its data path.

- The form writes to the app's own database. The wandit Leads tab is V1 only and
  receives nothing from this app.
- The anon key is public. So `anon` never writes the table directly: the only
  write path is one `security definer` function (an RPC).
- Create the table and the RPC in one `apply_migration` call, as in the example below:
  - `enable row level security`, then `revoke all on table ... from anon, authenticated`.
  - One policy `for all to anon, authenticated using (false) with check (false)`.
    It grants nothing. Without a policy, `get_advisors` reports an `error`.
  - No other policy for `anon`: no select, insert, update, or delete.
  - The RPC has `set search_path = ''`. Write each table, type, and function outside
    `pg_catalog` with its schema, for example `public.orders`.
  - The RPC checks the honeypot first. When it is filled, it returns a fake id and
    writes nothing. A bot must not learn that it failed.
  - The RPC validates every field: required, length, format. It raises `invalid_input`.
  - The RPC sets every column that the form does not send, for example `status`.
  - The RPC catches its insert errors and raises one general `submit_failed`.
  - Revoke `execute` from `public`, `anon`, and `authenticated`. Then grant it to
    `anon` and `authenticated`.
- `get_advisors` then reports `anon_security_definer_function_executable` and
  `authenticated_security_definer_function_executable` for the RPC. They are `warn`
  findings and are expected. Never revoke `execute` to clear them.
- The browser calls a server function in `src/features/<feature>/api/<entity>.functions.ts`,
  built like `src/features/profile/api/profile.functions.ts`, through a mutation.
  It validates the fields with zod, then calls
  `getSupabaseServer().rpc("submit_order", { ... })`. The browser never names the
  table or the RPC.
- On an RPC error, the server function logs `error.message` and answers one general
  failure. The database error text never reaches the browser.
- The honeypot is exactly `<input type="text" name="website" data-wandit-hp
  tabindex="-1" autocomplete="off" aria-hidden="true" />`. Send its value with the
  fields, for example with `new FormData(form)`. When a skill says the page script
  never reads the decoy, it means: no validation and no style on it.
- The zod schema accepts any `website` text and passes it as `p_website`. Only the
  RPC decides. A schema that rejects a filled honeypot tells the bot that it failed.
- The success state shows what the app promised, for example an order number from
  the returned id.

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  quantity int not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;
revoke all on table public.orders from anon, authenticated;
create policy orders_no_direct_access on public.orders
  for all to anon, authenticated using (false) with check (false);

create function public.submit_order(p_name text, p_phone text, p_quantity int, p_website text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if coalesce(p_website, '') <> '' then
    return gen_random_uuid();
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 200
    or coalesce(p_phone, '') !~ '^[+0-9][0-9 ().-]{5,30}$'
    or coalesce(p_quantity, 0) not between 1 and 100 then
    raise exception 'invalid_input';
  end if;
  begin
    insert into public.orders (name, phone, quantity, status)
    values (trim(p_name), p_phone, p_quantity, 'new')
    returning id into v_id;
  exception when others then
    raise exception 'submit_failed';
  end;
  return v_id;
end;
$$;
revoke execute on function public.submit_order(text, text, int, text) from public, anon, authenticated;
grant execute on function public.submit_order(text, text, int, text) to anon, authenticated;
```

## Migrations

- Migrations are forward-only. A migration never runs backwards.
- Migrations are additive: add tables, columns, indexes, and policies.
- Apply each migration with one `apply_migration` call. Never write the file yourself.
- The tool writes `supabase/migrations/<timestamp>_<name>.sql` after `0000_base.sql`.
- `name` uses `a-z`, `0-9`, and `_`, for example `create_notes`.
- Each migration gets a new `name`. The ledger keeps one row per name.
- One migration runs in one transaction. The tool refuses `begin`, `commit`,
  `rollback`, and `savepoint`. Do not use `concurrently`.
- The same SQL twice is skipped. A new change needs a new migration with a new name.
- Every new table gets `enable row level security` and its policies in the same migration.
- Never give `anon` a `using (true)` policy, except on a table of public content.
- Never give `anon` an insert, update, or delete policy on a public form table.
  Visitors write through the RPC of the public form contract.
- A migration that can destroy data answers `needs_approval`: drop, truncate,
  delete, update, merge, a column type change, or a statement that opens with
  `do`, `call`, `select`, `with`, `explain`, or `values`.
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

## Public tables and the publish check

- Every table in the `public` schema has row level security on, with no
  exception.
- A table that anyone may read on purpose gets this statement in the same
  migration: `comment on table public.<name> is 'wandit:public';`
- A view uses `with (security_invoker = true)`. A public view gets
  `comment on view` with the same text.
- A materialized view or a foreign table cannot have RLS. A public one gets
  `comment on materialized view` or `comment on foreign table` with the same
  text. A private one gets
  `revoke select on public.<name> from anon, authenticated;` in the same
  migration.
- Create every extension in the `extensions` schema:
  `create extension if not exists <name> with schema extensions;`. An
  extension table in `public` blocks the publish, and you cannot fix it.
- The anonymous read check skips a marked relation. The security advisors
  still check it.
- The check blocks every other table with RLS off. It also blocks every
  other materialized view or foreign table that `anon` can select, a
  `using (true)` policy for `anon`, and rows that a visitor can read
  without sign-in.
