# Rules for the coding agent

You build a mobile app inside this project. It runs on iPhone, Android, and the web.
These rules are binding. The host machine runs the session. You write code; the host runs it.
The app must feel like a real app from the store: clean code, modern design, real data.

## Interface contract

- The user describes the app in the chat. That brief is the product spec.
- You reply in the user's language. Always.
- User-provided assets (images, logos, texts) are facts. Never replace them.
- Never invent business facts: prices, addresses, phone numbers, opening hours.
- Never ship fake data, fake numbers, or a button that does nothing.
  A feature that you do not build has no button.
- When a fact is missing, ask the user. See the ask_user contract below.
- You work inside this project only. Do not touch files outside it.

## Stack

- Expo SDK 57. The pin is fixed: the store Expo Go app runs SDK 57.
- React Native 0.86, React 19.2, TypeScript strict.
- expo-router with file-based routes in `src/app/`: bottom tabs, a stack per tab, modals.
- HeroUI Native components, styled with Uniwind (Tailwind v4 classes in `className`).
- React Query (`@tanstack/react-query`) for every read and write of server data.
- Supabase for auth and data through `src/shared/lib/supabase.ts`.
- react-native-web renders the same code in the browser preview.
- Biome for lint and format: `pnpm run lint`.
- `pnpm run typecheck` runs `tsc` and then the effect check (`scripts/check-effects.mjs`).

## How the preview runs

- The host runs `pnpm run dev`: one Metro server on port 8081.
- That server feeds the web preview in a phone frame and the Expo Go app on a phone.
- Metro reloads the app when you save a file. Never start, stop, or restart Metro.
- Never run `expo start`, `expo run:ios`, `expo run:android`, `expo prebuild`, or `eas`.

## What you must refuse

- Do not switch framework, router, styling system, UI kit, data library, or backend.
- Do not change the Expo SDK. Do not change the version of an Expo package by hand.
- Do not add a state library, an ORM, a form library, or a second i18n system.
- Do not remove the Supabase env check or return a null client.
- Do not create `ios/` or `android/`. The app runs in Expo Go with no native code.
- Do not change the `dev` or the `typecheck` script in `package.json`. The host starts `dev`;
  you run `typecheck`, and it must keep the effect check.
- Leave `eas.json` and `scripts/` as they are. Never weaken or delete a check in `scripts/`.
- Do not run `pnpm run pack`, `pnpm run smoke`, or `pnpm run allow-list`. They are host tools.
- When pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm remove <name>` for the package
  you added. Then tell the user and pick another package. Leave the `allowBuilds` line
  that pnpm writes into `pnpm-workspace.yaml`.
- The deny rules in `.claude/settings.json` block edits to `CLAUDE.md`, `CLAUDE.local.md`,
  `AGENTS.md`, `.claude/`, `.mcp.json`, `opencode.json`, `.git/hooks/`, `.git/config`,
  `.env`, `.env.*`, `.npmrc`, `.pnpmfile.cjs`, `.pnpmfile.mjs`, `pnpm-workspace.yaml`,
  `template_version`, `native-modules.json`, and shell start-up files.
  Do not change these files in another way.
- Do not run `git push`, `git reset`, `git checkout`, `git switch`, `git rebase`,
  `git tag`, or any other git write command. The host commits, not you.
- A shell command that writes a file must name a literal path, such as `/tmp/bundle-ios.js`.
  The hook blocks a write path with a variable, a glob, or braces, such as `/tmp/b-$p.js`.
  Write one command for each file, not a loop.
- Do not write arbitrary scripts for behaviors that have a contract, like the public form.

## Plan before code

Before the first file of a new app or a new feature, write a short plan in your reply:

1. The goal in one line.
2. The navigation map: the tabs, the screens of each tab, the pushed screens, and the
   modals. Load the `mobile-design` skill: its section 1 says which pattern fits.
3. The data: the tables, their columns, and who may read or write each row.
4. The features: one folder per product area, for example `habits`, `stats`, `auth`.
5. The look: the design world (the `design-worlds-mobile` skill), its client choices, and the
   hero of the welcome, sign-in, and home screens.

Then build in small steps: one feature, one screen, or one fix per step.
Load the `mobile-design` skill (`.claude/skills/mobile-design/SKILL.md`) before you build or
redesign a screen.

## Code structure

```
src/
  app/                      Routes only. Each file renders one screen of a feature.
    _layout.tsx             Root: the providers, the root stack, and the modals.
    sign-in.tsx             A modal route.
    (tabs)/_layout.tsx      The bottom tabs.
    (tabs)/(home)/          The home tab: its stack (_layout.tsx) and its screens.
    (tabs)/account/         The account tab: its stack and its screens.
  features/<feature>/
    api/                    React Query hooks and the Supabase calls of the feature.
    components/             Parts that only this feature uses.
    lib/                    Schemas, helpers, and small stores of the feature.
    screens/                Full screens. Route files import them by path.
    index.ts                What other features may import. No screens.
  shared/ui/                App* components over HeroUI, Screen, EmptyState, AppIcon.
  shared/lib/               The Supabase client, the query client, haptics, and the fonts.
  i18n/                     messages.ts (the dictionary), useT(), and LanguagePicker.
  global.css                The design world tokens: fonts, corners, and colors (light and dark).
  assets/                   Images from `generate_image`.
assets/                     The app icon, the splash image, and the favicon.
supabase/migrations/        SQL migrations, forward-only. 0000_base.sql is the base schema.
```

- A route file has 1 to 3 lines: it imports a screen and exports it as default.
- A layout file holds navigation only: the stack or the tabs and their options.
- Another feature is used only through its `index.ts`. Inside a feature, import with `../`.
- Code that two features use moves to `src/shared/`. Never import a file deep inside
  another feature.
- File names are kebab-case: `habit-card.tsx`, `habits.queries.ts`.
- Import app files through `@/`, which is `src/`, for example `@/shared/ui`.
- The template features show each rule: `auth` (the session and sign-in), `profile` (a
  read, a write, and a pushed form), and `home` (a tab root that reads another feature).
  Replace `home` with the first real screen of the app.
- When the app needs no accounts, remove the account parts:
  1. Delete `src/features/auth/`, `src/features/profile/`, `src/app/sign-in.tsx`, and
     `src/app/(tabs)/account/`. Replace `home`: it reads the profile.
  2. In `src/app/(tabs)/_layout.tsx`, delete the `account` tab.
  3. In `src/app/_layout.tsx`, delete the `sign-in` screen and its guard, `useSession`,
     and the imports that have no use left. Keep the `@/shared/lib/supabase` import:
     it checks the env at start.
  4. The account screen renders `<LanguagePicker />`. With two languages, render it on
     another screen, for example a settings screen.

## Navigation

- Bottom tabs for 2 to 5 main sections. Each tab is a folder in `src/app/(tabs)/` with its
  own `_layout.tsx` (a `Stack`) and `index.tsx`. Add its `Tabs.Screen` in
  `(tabs)/_layout.tsx` with a title and an Ionicons icon: `<name>-outline` when inactive,
  `<name>` when active.
- A group folder like `(home)` adds nothing to the URL. Only the first tab uses a group;
  the other tabs use plain folders (`account/` is `/account`), so two `index` routes never
  share the URL `/`.
- A tab root hides its header (`headerShown: false`) and starts with
  `<AppText variant="title">`. A pushed screen shows the native header with a back
  button; set its `title` in the stack layout.
- Push a screen: a new file in the tab folder, opened with `<Link href>` or `router.push`.
- A modal for a short task: a file in `src/app/`. In the root layout, copy the options of
  `sign-in`: `presentation: "modal"`, `headerBackVisible: false`, `headerLeft: () => null`,
  and `headerRight` with `ModalCloseButton`. The web preview has no swipe-down, so the
  close button is the way out. A short choice can use `presentation: "formSheet"`.
- Every stack layout exports `unstable_settings = { anchor: "index" }` (the root layout:
  `"(tabs)"`). A web visitor can open any route first; the anchor puts a screen below it.
- A back or close action checks `router.canGoBack()` before `router.back()`.
- A route that needs a signed-in user sits in `<Stack.Protected guard={...}>`, as
  `edit-profile` in `(tabs)/account/_layout.tsx`. The guard is `status !== "signed-out"`, so
  the route stays while the session loads; the screen renders nothing until it is signed in.
- When the whole app needs a signed-in user, change the root layout:
  1. In `DirectedApp`, return `null` while `useSession().status` is `"loading"`.
  2. Put the `(tabs)` screen in a `Stack.Protected` with `status === "signed-in"`.
  3. Put `sign-in` in a guard with `status === "signed-out"`.
  4. Remove `presentation`, `headerLeft`, and `headerRight` from the `sign-in` options.
  5. A welcome screen: add `src/app/welcome.tsx`, and put its `Stack.Screen` first in the
     signed-out guard, with `headerShown: false`. Its sign-in button pushes `/sign-in`.
     Its sign-up button pushes `{ pathname: "/sign-in", params: { mode: "sign-up" } }`.
- Import navigation from `expo-router`, `expo-router/js-tabs`, `expo-router/drawer`, and
  `expo-router/react-navigation`. Never import `@react-navigation/*`: Metro refuses it.

## Server data

- Every read and write of Supabase goes through React Query. Model: `src/features/profile/api/`.
- `<feature>.queries.ts` holds the cache keys, the fetch functions, and the `use…` read hooks.
- `<feature>.mutations.ts` holds the write functions and the `use…` write hooks.
- A component never calls `supabase`. It calls a hook of its feature.
- Every `from()` and `rpc()` query ends with `.throwOnError()`, so React Query sees a
  failure. An `auth`, `storage`, or `functions` call checks `error` and throws it, as
  `auth.mutations.ts` does.
- The client has no generated types. Parse each row with a zod schema from
  `lib/<feature>.schemas.ts`.
- A query that needs the user id passes `skipToken` until the id exists.
- After a write, `onSuccess` returns `queryClient.invalidateQueries(...)` for the keys it changed.
- The query client logs every failure. The screen shows a translated message, never `error.message`.

## Effects

- Do not write `useEffect`, `useLayoutEffect`, or `useFocusEffect` to load data, to compute
  a value, or to react to a press. Use these instead:
  - Server data: React Query (`useQuery`, `useMutation`).
  - A value from props or state: compute it during render.
  - Work that a press or a submit starts: the event handler.
  - Reset a form when its data changes: a `key` on the form, as `EditProfileForm`.
  - An outside source that changes: `useSyncExternalStore` with a module store, as
    `src/features/auth/lib/session.ts` and `src/i18n/provider.tsx`.
  - Fresh data when a screen gets focus: pass `subscribed: useIsFocused()` (from `expo-router`)
    to `useQuery`. The query then refetches stale data when the screen comes back.
- Only when none of these works, write `// effect: <reason>` on the line above the call.
- `pnpm run typecheck` runs `scripts/check-effects.mjs`. It fails on an effect hook without
  that comment. Fix the code; never delete the check.

## Design rules

- Load the `mobile-design` skill before you build a screen. Check its list at the end.
- Load the `design-worlds-mobile` skill on the first build and before a redesign. One design
  world applies per app: its fonts, tokens, signatures, and screen recipes.
- `src/global.css` is the single source of colors, fonts, and corners. Change the look there.
- Use semantic classes: `bg-background`, `text-foreground`, `bg-surface`, `text-muted`,
  `bg-accent`, `border-border`, `from-hero-start`. They follow light and dark mode.
- Never hardcode a color, a gray, a shadow, or a font name in a screen.
- Fonts come from `@expo-google-fonts/*` packages. `src/shared/lib/fonts.ts` lists them, and the
  root layout loads them before the first screen. Import each weight from its own path, for
  example `@expo-google-fonts/barlow/600SemiBold`. A custom font sets no `fontWeight`: the
  family names the weight.
- Screens use the components of `@/shared/ui`, not `heroui-native` directly.
  When a screen needs another HeroUI component, add an `App*` file there first.
- Every screen renders inside `Screen` (safe areas, scrolling, keyboard). A list screen
  renders a `FlatList` inside `AppSafeAreaView` instead. A welcome or onboarding screen with
  a full-bleed photo or gradient renders a `View` with `flex-1`, and `AppSafeAreaView`
  inside it pads the text and the buttons.
- Text goes through `AppText`. The React Native `Text` has no theme.
- A nested `AppText` repeats the role of its parent, for example a colored word in a
  `display` line. A nested text with no role gets the `body` size and face.
- A word in another color is a message parameter, never a second message key. Call
  `t(key)` without params, split the result at `{name}`, and render the parameter in a
  nested `AppText` with the role of its line. The word order stays right in every language.
- A HeroUI part (`AppButton`, `AppCard`, `AppAvatar`, `AppListGroup`, `AppTextField`) keeps
  its own corners, size, and colors on the web: its classes beat a `className` there.
  To change them, change the tokens, use the `style` prop, or build the part from `View`,
  `AppPressable`, and `AppText`. A pressable that cannot act gets `isDisabled`.
- Text on a hero block (`from-hero-start`) uses `text-hero-foreground`.
- Write each class name in full. Tailwind finds no class that a template string builds:
  map each value to a full class string in an object.
- Icons: `AppIcon` (Ionicons) with `colorClassName`, for example `accent-muted`.
- A data screen has four states: `AppSkeleton` while loading, an error line with a retry,
  `EmptyState` when there is nothing, and the content.
- Rows of links or settings: `AppListGroup`. It has the pressed state built in.
- Haptics: `tapFeedback()` and `successFeedback()` from `@/shared/lib/haptics`.
- Spacing uses Uniwind classes (`p-4`, `gap-3`), not numbers in `style`.
- Show a bundled image (`src/assets/`, `public/uploads/`) with the React Native `Image`.
  For many remote images in a list, install `expo-image` with `npx expo install expo-image`.
- Hero art, onboarding art, and empty state art: the `generate_image` tool, as the
  `mobile-design` skill says (section "Images").
- Use `Platform.OS` or `Platform.select` only for a real platform difference.
- Core content and actions must work with no animation.
- Check `useReducedMotion()` from `react-native-reanimated` before a long animation.
- An entering animation and a transform class (`rotate-*`, `-skew-*`, `scale-*`) go on two
  nested views. On native, the animation replaces the transform of its own view.
- A loop (a glow that breathes, a ticker) is a Reanimated CSS animation in `style`:
  `animationName` (the keyframes), `animationDuration`, and `animationIterationCount:
  "infinite"`. It needs no effect. When `useReducedMotion()` is true, it gets no animation.
- An `Svg` of react-native-svg gets `width` and `height` props. Put the layout classes on a
  `View` around it: on native, Uniwind ignores `className` on `Svg`.
- Set `name` in `app.json` to the app name.
- The app icon and the splash image are in `assets/`. When the user gives a logo, ask for
  a square PNG of 1024 x 1024. Then point these `app.json` keys to `./public/uploads/<name>`:
  `icon`, `android.adaptiveIcon.foregroundImage`, `web.favicon`, and the `image` and
  `dark.image` of the `expo-splash-screen` plugin. Set the two splash `backgroundColor`
  values and `android.adaptiveIcon.backgroundColor` to the app background colors.
- Android shows only the center 66 % of `android.adaptiveIcon.foregroundImage`. Ask for a
  logo with space around it, or keep `./assets/adaptive-icon.png`.

## Expo Go limits

The phone preview is the store Expo Go app. It holds a fixed set of native modules.

- Use only the native modules in the module allow-list at the end of this file.
  A native module outside the list crashes the app in Expo Go.
- A package with JavaScript code only is allowed. Check it and its dependencies before you
  use it: no `ios/`, `android/`, `apple/`, `*.podspec`, or `expo-module.config.json`.
  When you are not sure, do not add it.
- Install every package with `npx expo install <name>`. It picks the version for SDK 57.
- No OAuth sign-in (Google, Apple, Facebook). Expo Go cannot receive the redirect.
  Sign-in uses Supabase email and password. See the sign-in rule below.
- No push notifications. Expo Go does not receive remote push messages.
- No in-app purchases, no custom native code, and no config plugin that needs a build.
- The web preview runs in an iframe with no camera, microphone, location, or motion-sensor
  access. A screen that uses `expo-camera`, `expo-audio` recording, `expo-location`,
  `expo-sensors`, or a module in the "No web version" list below
  checks `Platform.OS === "web"` and shows a short message there.

## Languages

- The app has one language until the user asks for more.
- When the brief does not name the app language, ask once, in the first ask_user call of
  the first build: `single-choice` with French, English, and Arabic. The user can type another.
- No answer (`dismissed` or `delegated`): French when the user writes in French, else English.
- Your session instructions can name languages from the project settings. Treat them as a
  hint, not as a decision: put that language first in the question.
- Later turns keep the language of `src/i18n/config.ts`. Do not ask again.
- Every user-facing string goes through `t("key")` from `useT()`. A `{name}` in a message is
  a parameter: `t("home.greeting", { name })`.
- `src/i18n/messages.ts` is the source dictionary, written in the default language. The
  first code of `locales` in `src/i18n/config.ts` is that language.
- Set the language of the app, for example French:
  1. A code that is not `en`, `fr`, or `ar`: add its row to `localeMeta` in `config.ts`.
  2. Set `locales = ["fr"]` in `config.ts`.
  3. Write every string of `messages.ts` in French.
  4. In `translate.ts`, key the dictionary with the code: `{ fr: messages }`.
- Add a second language:
  1. Add its code to `locales` (and its row to `localeMeta` when it is new).
  2. Add `messages.<code>.ts` with the type `Dictionary` and the same keys.
  3. Add it to `dictionaries` in `translate.ts`. `LanguagePicker` then shows by itself.
- An app with Arabic as its only language: add `"forcesRTL": true` to the options of the
  `expo-localization` plugin in `app.json`, so a built app starts mirrored.
- Arabic is right to left. The root layout mirrors the app from `useT().dir`, at once.
  On a phone the app also reloads once, so native views follow. Keep this flow in
  `src/app/_layout.tsx` and `src/i18n/provider.tsx`.
- Use logical utilities only: `ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`.
- For a style that differs by direction, use the `rtl:` and `ltr:` variants.
- Use the classes, not `marginStart` or `start` in `style`: inline styles do not mirror on the web.
- Never use `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left`, `text-right`.
- Directional icons (arrows, chevrons) flip when `useT().dir` is `rtl`.
- Leave text alignment at its default; it follows the direction. Do not use `text-start`
  or `text-end`: React Native 0.86 does not read them.
- Arabic text uses no italics.

## Supabase rule

- A Supabase project exists from project creation. It is already provisioned.
- App code uses `supabase` from `@/shared/lib/supabase` only in `api/` files and in
  `src/features/auth/lib/session.ts`. It never calls `createClient`.
- That client reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- An Edge Function makes its own client with `Deno.env.get("SUPABASE_URL")` and
  `Deno.env.get("SUPABASE_ANON_KEY")`.
- The host writes both values to `.env`. Never edit `.env` or copy the values into another file.
- A missing value throws a clear error at start. Never catch it away.
- Never write a fallback for a missing backend. No "no backend yet" path.
- Data access stays behind the RLS policies in `supabase/migrations/`.
- Every `EXPO_PUBLIC_` value ships inside the app bundle. Never put a secret in one.

## Sign-in rule

- The only sign-in method is Supabase email and password. The template has it:
  `src/features/auth/` (the session store, the mutations, and the sign-in screen).
- `useSession()` gives `loading`, `signed-out`, or `signed-in` with the session.
- The sign-up form has three fields: email, password, and confirm password.
  A zod schema with `refine` checks that the two passwords match.
- Email confirmation is off for this project. `signUp` returns a session at once.
  Do not build a "check your email" step.
- Do not build OAuth sign-in (Google, Apple, or another provider), magic link sign-in,
  or phone code sign-in. Do not build them when the user asks for them.
  Tell the user that only email and password sign-in is available for now.
- Create one test account per app, in the first build turn of an app that keeps sign-in:
  `node --env-file=.env scripts/create-test-user.mjs`. The script calls the sign-up
  endpoint of the app backend with the anon key and prints a new email and password.
  Do not create another one in a later turn.
- On an error, read its text: `Cannot reach the app backend` means the backend is paused
  or not ready; tell the user. Never print the anon key or another value of `.env`.
- Give the email and the password to the user in your final answer.

## Before you end a turn

1. Run `pnpm run typecheck` and `pnpm run lint`. Fix every error and warning.
2. Check that every button and link works, and that no screen shows fake data.
3. End with a short answer in plain words for a person who does not code: what the app
   does now, what to try in the preview, the test account when there is sign-in, and the
   next questions, if any.

## ask_user contract

- The tool name is `mcp__harness-tools__ask_user`.
- Input shape: `{ questions: [{ question, kind?, options?, helper?, maxFiles? }] }`.
- One call holds every question of one step, at most 4. Never call it twice in one reply.
- `kind` is one of `single-choice`, `multi-select`, `free-text`, `attachments`.
- `question` is one clear sentence in the user's language, at most 300 characters.
- `options` is a list of `{ id, label, description?, worldId? }`, at most 6.
- Zero options means a free-text question. The user can always type an answer.
- `helper` is one short line shown under the question.
- Images, logos, photos: `kind: "attachments"` with `maxFiles` (1 to 6).
- The result is `{ answers: [{ questionId, question, action, selected, text, files }] }`.
- `action` is `answered`, `delegated` (you decide), or `dismissed` (skipped; follow `text`).
- `files[].path` is the copy in `public/uploads/<name>`. Read that file to see it.
- In app code, load the file with `require()` and a fixed relative path, for example
  `require("../../../../public/uploads/<name>")` from `src/features/<feature>/screens/`.
  Metro needs a fixed string.
- The tool text names the web URL `/uploads/<name>`. That URL does not work on a phone.
- Design worlds: the first build offers 3 worlds in one `single-choice` question, each
  option with `worldId`. The `design-worlds-mobile` skill says which worlds and how.
- Ask only when blocked: a missing fact (a price, a text, an image), an open business
  decision, the app language, or the design world on the first build.
- Do not ask for things the brief already answers.

## Public form contract

A public form is a form that a visitor sends without an account: an order, a
booking, a contact request, a sign-up for news.

- The form writes to the app's own database. The wandit Leads tab is V1 only and
  receives nothing from this app.
- The anon key ships inside the app. So `anon` never writes the table directly: the
  only write path is one `security definer` function (an RPC).
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
- The app validates the fields with zod to show field errors. Then its mutation hook
  calls `supabase.rpc("submit_order", { ... })`. The app code never names the table.
- On an error, the screen shows a translated general error, never `error.message`.
- A form that also needs a secret, for example to send an email, uses an Edge Function
  in `supabase/functions/<slug>/`. The function calls the same RPC with its anon client.
  It never inserts into the table.
- The honeypot is a text field named `website` that a person never sees: give it the
  `hidden` class and `autoComplete="off"`. The app sends its value with the fields.
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
- `pnpm run typecheck` does not check `supabase/functions/`: that code is Deno code.
- A function imports no file from another folder, for example `_shared/`.
- A function that the app calls answers `OPTIONS` and sends CORS headers on every answer.
  The web preview is a browser.
- `backend_paused` or `backend_not_ready`: tell the user. Stop the backend work.
- `rate_limited`: wait `retryAfterSeconds`, then call the tool again once.

## Secrets

- Never write a secret value in the chat, the code, or a tool input.
- Code that reads a secret runs in an Edge Function, with `Deno.env.get("NAME")`.
- The app calls that Edge Function. The app never holds the secret.
- A key of the user, for example a Stripe key: `set_secret` with `source: "project_secret"`.
- On `missing`, tell the user the secret name. The user adds it in the Cloud tab.
- A key the app makes, for example a signing key: `set_secret` with `source: "generate"`.
- `generate` keeps an existing value. It never replaces a key the app uses.
- Names that start with `SUPABASE_` are reserved. Edge Functions get them already.

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

## Commits

- The host commits your work. You run no git write command.
- `git status` and `git diff` for reading are fine.

## Module allow-list

<!-- allow-list:start -->
Generated by `scripts/allow-list.mjs` from expo 57.0.25. Do not edit by hand.

Native modules that run in Expo Go (91):
`@expo/dom-webview`, `@expo/metro-runtime`, `@expo/ui`, `@expo/vector-icons`,
`@react-native-async-storage/async-storage`, `@react-native-community/datetimepicker`,
`@react-native-community/netinfo`, `@react-native-community/slider`,
`@react-native-masked-view/masked-view`, `@react-native-picker/picker`,
`@react-native-segmented-control/segmented-control`, `@sentry/react-native`, `@shopify/flash-list`,
`@shopify/react-native-skia`, `@stripe/stripe-react-native`, `expo`, `expo-application`,
`expo-asset`, `expo-audio`, `expo-auth-session`, `expo-background-task`, `expo-battery`,
`expo-blur`, `expo-brightness`, `expo-calendar`, `expo-camera`, `expo-cellular`, `expo-checkbox`,
`expo-clipboard`, `expo-constants`, `expo-contacts`, `expo-crypto`, `expo-device`,
`expo-document-picker`, `expo-file-system`, `expo-font`, `expo-gl`, `expo-glass-effect`,
`expo-haptics`, `expo-image`, `expo-image-manipulator`, `expo-image-picker`, `expo-intent-launcher`,
`expo-keep-awake`, `expo-linear-gradient`, `expo-linking`, `expo-local-authentication`,
`expo-localization`, `expo-location`, `expo-mail-composer`, `expo-media-library`,
`expo-navigation-bar`, `expo-network`, `expo-notifications`, `expo-print`, `expo-router`,
`expo-screen-capture`, `expo-screen-orientation`, `expo-secure-store`, `expo-sensors`,
`expo-sharing`, `expo-sms`, `expo-speech`, `expo-splash-screen`, `expo-sqlite`, `expo-status-bar`,
`expo-store-review`, `expo-symbols`, `expo-system-ui`, `expo-task-manager`,
`expo-tracking-transparency`, `expo-video`, `expo-video-thumbnails`, `expo-web-browser`,
`lottie-react-native`, `react`, `react-dom`, `react-native`, `react-native-gesture-handler`,
`react-native-get-random-values`, `react-native-keyboard-controller`, `react-native-maps`,
`react-native-pager-view`, `react-native-reanimated`, `react-native-safe-area-context`,
`react-native-screens`, `react-native-svg`, `react-native-view-shot`, `react-native-web`,
`react-native-webview`, `react-native-worklets`

JavaScript-only packages of this template:
`@expo-google-fonts/plus-jakarta-sans`, `@supabase/supabase-js`, `@tanstack/react-query`,
`heroui-native`, `tailwind-merge`, `tailwind-variants`, `tailwindcss`, `uniwind`, `zod`

Allowed with a limit in Expo Go:
- `@expo/ui`: no component newer than 57.0.11 (no NavigationStack, Toolbar, or NavigationSplitView).
- `@sentry/react-native`: JavaScript errors only; the native crash reporter is not in Expo Go.
- `@stripe/stripe-react-native`: no Apple Pay and no Google Pay.
- `expo-auth-session`: no OAuth sign-in in Expo Go; use Supabase email sign-in.
- `expo-calendar`: only the `expo-calendar/legacy` API works.
- `expo-local-authentication`: no Face ID on iOS.
- `expo-location`: foreground location only.
- `expo-notifications`: local notifications only; no remote push.
- `expo-splash-screen`: Expo Go shows the app icon, not the configured splash.
- `react-native-maps`: Apple Maps only on iOS; Google Maps on Android.

No web version. A screen that uses one needs a web fallback:
`@expo/ui`, `@react-native-community/datetimepicker`, `@react-native-masked-view/masked-view`,
`@stripe/stripe-react-native`, `expo-background-task`, `expo-brightness`, `expo-calendar`,
`expo-contacts`, `expo-file-system`, `expo-glass-effect`, `expo-intent-launcher`,
`expo-local-authentication`, `expo-media-library`, `expo-navigation-bar`, `expo-notifications`,
`expo-screen-capture`, `expo-secure-store`, `expo-sms`, `expo-splash-screen`, `expo-store-review`,
`expo-task-manager`, `expo-tracking-transparency`, `expo-video-thumbnails`,
`react-native-keyboard-controller`, `react-native-maps`, `react-native-pager-view`,
`react-native-view-shot`, `react-native-webview`

Not in Expo Go. Never install these:
- `@expo/fingerprint`: a Node build tool, not an app module.
- `@react-native-community/viewpager`: deprecated and not in Expo Go; use react-native-pager-view.
- `eslint-config-expo`: a lint config, not an app module.
- `expo-analytics-amplitude`: a removed legacy module, not in Expo Go.
- `expo-app-auth`: deprecated and removed, not in Expo Go.
- `expo-app-loader-provider`: a legacy internal package, not in Expo Go.
- `expo-app-metrics`: Expo Go leaves it out of its build.
- `expo-apple-authentication`: the iOS store Expo Go 57.0.9 lacks it.
- `expo-background-fetch`: deprecated and off in iOS Expo Go; use expo-background-task.
- `expo-brownfield`: a toolkit for existing native apps, not in Expo Go.
- `expo-build-properties`: a build-time config plugin with no app module.
- `expo-dev-client`: a build tool for development builds, not in Expo Go.
- `expo-eas-client`: an internal package of expo-updates.
- `expo-google-app-auth`: deprecated and removed, not in Expo Go.
- `expo-image-loader`: an internal package of other Expo modules.
- `expo-insights`: Expo Go leaves it out of its build.
- `expo-live-photo`: the iOS store Expo Go 57.0.9 lacks it.
- `expo-manifests`: an internal package of expo-updates.
- `expo-maps`: needs a development build, not in Expo Go.
- `expo-mcp`: a Node tool for the editor, not an app module.
- `expo-mesh-gradient`: the store Expo Go 57.0.9 lacks it on iOS and Android.
- `expo-module-template`: a template to write native modules.
- `expo-modules-core`: an internal package; apps import from expo.
- `expo-observe`: not in Expo Go.
- `expo-server`: the server runtime of API routes, not an app module.
- `expo-updates`: most of its API fails in Expo Go.
- `expo-widgets`: needs a development build, not in Expo Go.
- `jest-expo`: a test preset, not an app module.
- `react-native-bootsplash`: a native library that Expo Go does not hold.
- `react-server-dom-webpack`: React Server Components bindings for frameworks.
- `sentry-expo`: deprecated; use @sentry/react-native.
- `unimodules-app-loader`: an internal package of expo-task-manager.
- `unimodules-image-loader-interface`: a legacy internal package, not in Expo Go.
<!-- allow-list:end -->
