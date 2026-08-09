# Localization

How Wandit speaks three languages. This doc is the contract for anyone (human or agent) adding features: **all user-facing copy goes through `@wandit/internationalization`** — never hardcode strings in components.

Locales: `en` (source of truth), `fr` (product tone: informal "tu", Algeria market), `ar` (Modern Standard Arabic, RTL). Config lives in `packages/internationalization/src/config.ts` (`locales`, `defaultLocale`, `rtlLocales`, `localeMeta`, `matchLocale`).

---

## 1. Static content (UI strings)

Dictionaries are per-locale JSON files in `packages/internationalization/dictionaries/{en,fr,ar}/<namespace>.json`. **The three locale trees must stay structurally identical** — `en` is canonical; `Dictionary`/`TranslationKey` types derive from it, so a missing `fr`/`ar` key fails `check-types`.

| Namespace | Surface |
|---|---|
| `common` | app title/meta, chrome shared everywhere (theme toggle, language switcher, close, `time.justNow`) |
| `landing` | `/` marketing page + its route meta |
| `auth` | auth modal, user menu |
| `projects` | dashboard, sidebar nav, prompt box (`projects.promptBox.*`) |
| `credits` | balance chip, price tags, ledger |
| `workspace` | workspace shell, tabs, publish, chat, page, assets, marketing |
| `leads` | leads tab, status labels (`leads.status.<enum_value>` — Postgres enum values verbatim), `leads.csvHeaders` |
| `settings` | workspace settings tab |
| `errors` | API error codes → messages (`errors.codes.<CODE>`), `generic`, `network` |
| `native` | Expo app strings (`native.auth/home/drawer/workspace/notFound`) |

### Adding a string — the checklist

1. Add the key to `dictionaries/en/<namespace>.json` **and** the `fr`/`ar` files (same key path, translated value).
2. In a component: `const { t } = useTranslation()` → `t("workspace.publish.cta")`. Web imports from `@/lib/i18n`; native from `@wandit/internationalization/react`.
3. Outside React (route `head()`, pure helpers): `pageTitle("projects.meta.title")` from `@/lib/i18n` — reads the current dictionary snapshot. For dynamic key paths (e.g. `` `leads.status.${status}` ``) use `pageTitleDynamic` — it is untyped, so prefer literal keys everywhere else.
4. Run `check-types` — a typo'd key or missing locale fails the build.

### Message syntax

- **Interpolation**: `"deleteDescription": "This deletes {name} and its leads."` → `t("projects.deleteDescription", { name })`. Missing params render the placeholder literally (visible in dev).
- **Plurals**: a value that is an object keyed by CLDR categories, selected by `Intl.PluralRules(locale)` with `params.count`:
  ```json
  "leadCount": { "one": "{count} lead", "other": "{count} leads" }
  ```
  `en`/`fr` need `one`/`other`; **`ar` needs `zero/one/two/few/many/other`** — always include `other` (it is the fallback). `t("projects.leadCount", { count })`.
- **Structured content** (arrays, card lists — FAQ, pricing tiers, examples): keep them as arrays/objects in the dictionary and read via `useDictionary()`, not `t()`.
- **Numbers/dates/currency**: never `toLocaleString("en-US")` — use `formatNumber`, `formatDate`, `formatCurrencyDZD`, `formatRelativeTime` from the package (web relative timestamps: `src/lib/relative-time.ts`, already locale-aware).

### Never localize

Mock/simulated backend output (`features/workspace/lib/mock-*`, `FIRST_GENERATION_REPLIES`/`ITERATION_REPLIES` — those are PageLang-keyed generated-content simulations), brand terms (Wandit, COD, Meta, TikTok, Google, CIB), DZD/DA amounts, URLs, dev-only errors. Also: **never call `translate()` at module scope and never persist resolved strings** — persist the key + params and translate at render (the credits ledger does this; copy that pattern).

## 2. Language switching

**Web**: locale state lives in `apps/web/src/lib/i18n/` — `locale-store.ts` (module store readable outside React; persistence in `localStorage["wandit-locale"]`; detection: stored → `matchLocale(navigator.languages)` → `en`) and `provider.tsx` (`AppI18nProvider` in `__root.tsx`: async-loads the locale dictionary, stamps `document.documentElement.lang/dir`, calls `router.invalidate()` so route `head()` titles recompute). `index.html` has a pre-paint inline script that sets `lang`/`dir` from storage, and `main.tsx` pre-loads the persisted locale's dictionary before first render — keep both when touching the entry.

The switcher component is `apps/web/src/components/language-switcher.tsx`: `<LanguageSwitcher />` (landing nav) and `<LanguageSwitcherMenuItems />` (embedded in the user menu). New chrome surfaces reuse these.

**Native**: `apps/native/contexts/locale-context.tsx` (`LocaleProvider` in `app/_layout.tsx`, `useLocale`/`useTranslation`), persisted via `expo-secure-store` under the same `"wandit-locale"` key. Locale row lives in the projects drawer.

## 3. RTL rules

- **Tailwind: logical utilities only** — `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/text-end`, `border-s/border-e`, `rounded-s/rounded-e`. Never `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` (exception: symmetric centering like `left-1/2 -translate-x-1/2`).
- Physical transforms that logical classes can't express get `rtl:` variants (see `packages/ui` switch thumb, progress fill, `SidebarRail`).
- Directional icons (chevrons, arrows) get `rtl:rotate-180` (web) — precedent in `dropdown-menu.tsx`, `breadcrumb.tsx`, `features-bento.tsx`.
- Radix physical `side=`/`align=` props flip only under the `DirectionProvider` (re-exported from `packages/ui/src/components/direction.tsx`, wired in `__root.tsx`); tooltips that must hug a screen edge flip `side` by `dir` explicitly (pattern in `sidebar.tsx`).
- Keep `dir="auto"` on user-generated content (names, prompts, chat bubbles).
- Arabic font: `index.html` loads Noto Sans Arabic; `:lang(ar)` overrides in `index.css`.
- **Native**: layout mirroring is controlled by `I18nManager` (device-level), *not* the in-app locale — key directional icons off `I18nManager.isRTL`. Known limitation: switching to `ar` in-app localizes strings but does **not** mirror the layout; a `forceRTL` + app-restart flow is deliberately not wired yet (product decision pending).

## 4. Server & API errors

The server never sends localized text. Errors follow the envelope in `packages/contracts/src/http/envelope.ts` with a `code` from `packages/contracts/src/http/error-codes.ts`; the web client maps `code → errors.codes.<CODE>` inside `getApiErrorMessage` (`apps/web/src/lib/BaseService.ts`), falling back to the server message, then `errors.generic`. **When adding a server error: add the code to contracts, add `errors.codes.<CODE>` to all three locales.** New Nest exception filters must emit `{ code, message }` per the envelope.

## 5. Dynamic content (reference data)

No reference tables exist yet. When one lands (e.g. `wilayas`, `communes`), the convention is **suffixed columns, not translation tables**:

- Columns: `name` (canonical/en), `name_fr`, `name_ar` (nullable).
- Display fallback: requested locale → `fr` → `name`.
- Zod contracts expose all three; a `localizedName(row, locale)` helper belongs in `@wandit/internationalization` when first needed.
- Machine codes (status enums) never get DB label columns — their labels live in the dictionaries keyed by enum value (`leads.status.<enum_value>` is the exemplar).

## 6. Adding a locale

1. Add it to `locales` + `localeMeta` (+ `rtlLocales` if RTL) in `config.ts`.
2. Copy `dictionaries/en/` to the new locale dir and translate (parity is type-enforced).
3. Add the loader entry in `src/dictionaries.ts`.
4. Fonts (`index.html`/`index.css`) if the script needs one.
5. `check-types` + the parity script catch the rest.

## 7. Gotchas

- **shadcn regeneration**: `pnpm dlx shadcn add <x>` re-imports stock components with English strings and physical LTR classes — re-apply label props + logical/`rtl:` classes after any regen in `packages/ui`.
- `packages/ui` stays i18n-agnostic: English defaults + override props (`closeLabel`, `label`, `mobileTitle`…); apps pass `t(...)` values.
- Native has **no device-locale detection** yet (needs `expo-localization` — ask before adding the dep); first launch defaults to `en` until the user picks a language.
- Translation tooling (languine etc.) is not wired; dictionaries are hand-maintained. The folder layout is compatible if we adopt it later.

Source docs: docs/PRD.md, docs/frontend-structure.md, docs/native-structure.md
