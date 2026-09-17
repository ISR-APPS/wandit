# CI

The `CI` workflow in `.github/workflows/ci.yml` checks each code change before it merges.

## What runs

Three jobs run in parallel on `ubuntu-latest`. Each job has a 15 minute limit.

- `typecheck` runs `pnpm turbo run check-types` for every package that has the script.
- `test` runs `pnpm turbo run test` for every package that has the script.
- `biome` runs `npx biome ci --error-on-warnings` on a scoped path list.

The workflow runs on each pull request and on each push to `dev`, `staging`, and `main`. It also runs on a manual start from the Actions page. A new push on the same ref stops the older run.

Set the three job names as required checks on `dev` and `main`. Open Settings, Branches, the branch rule, then "Require status checks to pass". Pick `typecheck`, `test`, and `biome`. This is a founder step in the GitHub settings, not a code change.

## Run the same checks locally

```sh
pnpm turbo run check-types
pnpm turbo run test
pnpm --filter <app> test        # one package only, for example -F server
npx biome ci --error-on-warnings apps/edge apps/preview-proxy apps/server/src/infrastructure apps/server/src/modules/app-builder apps/server/src/modules/metering apps/server/src/trigger apps/web apps/worker packages/analytics packages/auth packages/config packages/contracts packages/db packages/internationalization packages/jobs packages/observability packages/preview-editor packages/ui tooling
```

Three env stubs make the checks run without secrets:

- `CI=true` keeps the test runners in CI mode.
- `SKIP_ENV_VALIDATION=true` stops `packages/env` from demanding real secrets. Turbo drops it before a task runs, so it guards only commands outside turbo, like `pnpm --filter`.
- `VITE_SERVER_URL=http://localhost:3000` is a placeholder. `packages/env/src/web.ts` requires it for the web and admin `vite build` steps. It is not a secret.

The server suite sets its own env values in `apps/server/vitest.config.ts`.

## Why `test` depends on `topo`

Vitest reads the TypeScript sources directly, so the tests do not wait for a dependency build. The `topo` task creates only dependency edges; it has no script. It carries the file hashes of the workspace dependencies into the `test` cache key. A change in `packages/contracts` then reruns the tests.

## Skip rule

A test that fails and needs product work is skipped with `it.skip` and a comment that names the issue. The pull request description lists each skipped test with its reason.

## Biome scope

`biome ci .` at the root fails today. `templates/web-app/biome.json` is a nested root configuration, and the files below hold lint errors. The CI job checks the passing paths only. Widen the scope to `biome ci .` when the files are fixed.

- `apps/admin`: `src/features/conversations/lib/conversation-turns.ts`
- `apps/native`: `features/projects/api/projects.mutations.ts`, `features/projects/components/project-actions-sheet.tsx`, `features/projects/components/prompt-box.tsx`, `features/projects/components/rename-project-dialog.tsx`, `features/workspace/api/pages.requests.ts`, `features/workspace/components/page-editor/edit-mode.tsx`, `features/workspace/components/page-editor/page-web-view.tsx`, `features/workspace/components/page-editor/publish-sheet.tsx`, `features/workspace/lib/page-preview/preview-document.ts`, `features/workspace/lib/page-preview/use-original-theme.ts`, `features/workspace/lib/page-preview/use-page-editor.ts`, `features/workspace/lib/use-publish-controller.ts`, `features/workspace/screens/page-screen.tsx`
- `apps/server`: `src/modules/billing/application/services/billing-customer.service.spec.ts`, `src/modules/billing/infrastructure/persistence/billing-change-intents.repository.ts`, `src/modules/billing/infrastructure/persistence/billing-checkout-attempts.repository.ts`, `src/modules/connector-generations/application/services/connector-generation-recovery.service.ts`, `src/modules/email/application/services/email-send-policy.service.ts`, `src/modules/email/email.module.ts`, `src/modules/lead-scrapes/application/services/lead-scrapes.service.ts`, `src/modules/marketing-assets/application/services/marketing-html.spec.ts`, `src/modules/projects/domain/project-scope.ts`, `src/modules/workspaces/application/services/workspaces.service.ts`, `src/modules/workspaces/infrastructure/persistence/organization-limits.repository.ts`, `src/modules/workspaces/presentation/http/guards/workspace-context.guard.ts`
- `packages/env`: `src/web.ts`

## No remote cache, no coverage tool

The Turbo cache is the local `.turbo` directory, restored with `actions/cache`; there is no remote cache. No coverage tool runs in CI.
