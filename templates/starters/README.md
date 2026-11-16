# Starter templates

A starter template is a ready project that a user gets with "Use this template".
In git, a starter is an overlay on the base template `templates/web-app`.
The overlay holds only the files that are new or that differ from the base.
The server applies the overlay in the project sandbox, then makes one commit. No LLM turn and no install run.

## Folder layout

```
templates/starters/
  README.md
  scripts/            the tools (plain Node, no package)
  <id>/
    starter.json      { "id", "removed": [paths], "theme": { "name", "selection" } }
    files/            the overlay tree, with paths relative to the project root
```

- `<id>` is kebab-case, at most 40 characters. It is also the catalog id.
- `removed` lists the base files that the starter deletes.
- `theme.selection` is a full `AppThemeSelection` (`packages/contracts/src/v2/app-theme.ts`).
- The catalog entry is in `packages/contracts/src/v2/starter-template-catalog.ts`.
- The catalog images are in `apps/web/public/starter-templates/<id>/`.

Do not edit `files/` by hand. Work in a work folder, then run `extract.mjs`.

## Archive format

`scripts/pack.mjs` writes `templates/starter-<id>.tar.gz` for each starter.
`templates/pack-all.mjs` runs it in the server build and in the Trigger deploy.
The archives are not in git. The archive root holds:

- `manifest.json`: `{ "id": "<id>", "removed": ["<path>", ...] }`
- `files/`: the overlay tree

`pack.mjs` refuses a starter whose `files/src/styles/theme.json` is missing or does not have origin `host`.
The first chat turn replaces a theme file with origin `template`, so the look of the project then changes.

## Protected paths

A starter cannot add, change, or remove these paths. The tools refuse them and name the path.

- `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `README.md`, `.claude/**`, `.gitignore`, `.npmrc`
- `.mcp.json`, `opencode.json`, `.pnpmfile.cjs`, `.pnpmfile.mjs`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `template_version`
- `biome.json`, `tsconfig.json`, `wrangler.jsonc`, `vite.config.ts`
- `vite-plugins/**`, `scripts/**`, `supabase/**`, `src/wandit/**`
- `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/app.tsx`, `src/routes/login.tsx`
- `src/features/auth/**`, `src/shared/lib/**`
- `src/shared/i18n/**`, except `messages.ts`
- `src/styles/theme.ts`, `src/styles/theme-options.ts`, `src/styles/engine.css`
- Each file of `src/shared/ui/**` that the base has. A new file there is allowed.
- `.env`, `.env.*`, and each path with a `.git` or `node_modules` folder.

Reasons:

- `CLAUDE.md` and the sandbox hook protect the user. A starter that replaces them removes that protection.
- The package files must stay as they are. Then the `node_modules` of the template snapshot stay valid.
- A path in `removed` with `..`, a leading `/`, or a backslash is refused. It can point outside the project.

The list is in `scripts/protected-paths.mjs`. Its spec is `starter-protected-paths.spec.ts` in `apps/server`.

## Author workflow

Run each command from the repo root. `<work>` is an absolute path of a folder outside the repo.

1. Make the project. A new id gives a plain copy of the base.
   ```
   node templates/starters/scripts/materialize.mjs <id> <work>
   ```
2. Write the theme. Put `theme.name` and `theme.selection` in `templates/starters/<id>/starter.json`.
   For a new starter, create the file with `{ "id": "<id>", "removed": [], "theme": { ... } }`.
   Then build `src/styles/theme.json`. Never write that file by hand.
   ```
   (cd apps/server && npx tsx scripts/build-starter-theme.ts <id> <work>)
   ```
3. Build the pages in `<work>`. Obey `<work>/CLAUDE.md`. Add `STARTER.md` at the project root.
   Run the checks of the project in `<work>`:
   ```
   npx -y pnpm@11.7.0 run typecheck && npx -y pnpm@11.7.0 run lint && npx -y pnpm@11.7.0 run build
   ```
4. Look at the pages. The command writes PNG files for each path into `<shots>`.
   ```
   node templates/starters/scripts/shot.mjs <work> <shots> --paths /,/app --full --mobile --widths 1024,1280
   ```
   - No flag: `<name>-top.png`, the first screen at 1440 x 900.
   - `--full`: also `<name>-full.png`, the full page.
   - `--mobile`: also `<name>-mobile.png` at 390 x 844. With `--full`, also `<name>-mobile-full.png`.
   - `--widths`: also `<name>-w<width>.png`, the first screen at each width.
   - A path with `@<pixels>`, for example `/@1800`: `<name>-at-1800.png`, the desktop view after a scroll of 1800 px.
   - A warning line shows each view that is wider than its viewport. Such a page scrolls sideways.
5. Save the work as the overlay.
   ```
   node templates/starters/scripts/extract.mjs <id> <work>
   ```
6. Prove that the overlay builds on a new copy of the base.
   ```
   node templates/starters/scripts/check.mjs <id>
   ```
7. Publish the catalog images. The first path gives `cover.webp`. The next paths give `shot-1.webp` to `shot-3.webp`.
   ```
   node templates/starters/scripts/shot.mjs <work> <shots> --paths /,/app,/app/orders --publish <id>
   ```
   A one-page website has one path. Use scroll positions for its sections: `--paths /,/@1800,/@4200,/@6900`.
   Find each position in `home-full.png`: the pixel row where the section starts.
   The last line is the value of the `shots` field of the catalog entry.

To continue a starter later, delete `<work>` and do step 1 again. Step 1 applies the overlay.

## Screenshots of the pages behind sign-in

A work folder has no backend. `shot.mjs` does not change the project code:

- It writes `<work>/.env` with a dummy Supabase URL. `extract.mjs` ignores that file.
- It puts a session into the `localStorage` of the browser before the page loads.
- It answers each request to the dummy host with fixed JSON: the auth calls and the `profiles` row.

A starter must make no other Supabase call. `shot.mjs` prints a warning when a page makes one.
Chromium comes from the Playwright package of `apps/server`. `--publish` uses the sharp package of `apps/server`.

## When `templates/web-app` changes

A base change can break a starter: a renamed export, a new lint rule, a removed text key.
After each change of `templates/web-app`, run:

```
node templates/starters/scripts/check.mjs --all
```

The command prints `PASS` or `FAIL` for each starter, with the output of the command that failed.
To repair a starter, do step 1, correct the files in `<work>`, then do steps 5 and 6.
CI does not run this check, and the root Biome config ignores `templates/starters/*/files`.
