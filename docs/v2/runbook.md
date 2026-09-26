# V2 runbook

Operator steps for the V2 app builder. Each entry names the issue that
added it. WANDIT-176 adds the staging alpha entries.

## Rotate `APP_SECRETS_ENCRYPTION_KEY` (WANDIT-185)

The value has the form `v1:<base64 32 bytes>,v2:<base64 32 bytes>`. The
highest version encrypts every new write. All listed versions decrypt.
Every `project_secrets` row stores the version that encrypted it in
`key_version`. The API and the Trigger worker read the same value.

1. Add the new version. Make a key with `openssl rand -base64 32`. Append
   `,v<N+1>:<base64>` to the value in Railway, on the API service and on
   the Trigger worker. Keep `v<N>` in the value.
2. Deploy both services. New writes now use `v<N+1>`. Old rows still
   decrypt with `v<N>`.
3. Run the script from `apps/server` with the production env:
   `pnpm secrets:rotate`. It re-encrypts the rows with an older
   `key_version` in pages of 100 and prints one line per page with the
   counts `rotated`, `skipped`, and `failed`. A `skipped` row was written
   by a user during the run and already has the new version. A `failed`
   row prints its id and its version; the usual cause is a version that
   is not in the value. Fix the value and run the script again until
   `failed` is 0.
4. Remove `v<N>` from the value and deploy both services again. Check
   with `SELECT key_version, count(*) FROM project_secrets GROUP BY 1`
   that only `v<N+1>` remains.

### After a suspected key leak

Do steps 1 to 4 in one session, without a pause between step 3 and
step 4. The rotation protects the rows from the old key. It does not
change the stored values: a person who read the database with the old
key knows them. After step 4, ask the affected users to replace their
secrets in the Secrets panel, and re-create the `system` rows of their
Supabase backends.

## Workers for Platforms (WANDIT-200)

A published V2 app runs as one Worker, `app-<projectId>`, in a Workers for
Platforms dispatch namespace. The edge Worker binds the namespace as
`DISPATCHER`. The API and the Trigger worker upload and delete the app
Workers through the W4P REST API. Do these steps in this order.

1. Enable the Workers for Platforms subscription on the Cloudflare account
   `6b421048e434497bce142970530e4eb1`: Dashboard > Workers & Pages >
   Workers for Platforms. The plan costs $25 per month.
2. Create the two namespaces from `apps/edge`, logged in to that account:
   `npx wrangler dispatch-namespace create production` and
   `npx wrangler dispatch-namespace create staging`. Check them with
   `npx wrangler dispatch-namespace list`.
3. Create the API deploy token: Dashboard > My Profile > API Tokens >
   Create Token > Custom token. Give it one permission, "Account: Workers
   Scripts: Edit", on this account only. Give it no zone permission and no
   other permission. Do not reuse `CLOUDFLARE_API_TOKEN`.
4. Set three values on the API service in Railway and in the Trigger.dev
   environment, for staging and for production:
   - `CLOUDFLARE_ACCOUNT_ID`: the account id of step 1. It can already be
     set for the domain tasks; keep the same value.
   - `CLOUDFLARE_W4P_NAMESPACE`: `staging` on staging, `production` on
     production.
   - `CLOUDFLARE_V2_DEPLOY_TOKEN`: the token of step 3.
   `GET /api/v2/health` then reports `CLOUDFLARE_W4P_NAMESPACE` and
   `CLOUDFLARE_V2_DEPLOY_TOKEN` as `true`. Without all three values the
   publish is off, a project delete records the Worker step as `skipped`,
   and the daily `w4p-orphan-sweep` task does nothing. The sweep also runs
   only in the Trigger.dev PRODUCTION and STAGING environments; in a
   PREVIEW or DEVELOPMENT environment it logs
   `w4p.orphan-sweep.environment-skipped` and deletes nothing.
5. Merge order: the namespaces of step 2 must exist before the edge Worker
   deploys with the `dispatch_namespaces` entry. A push to `staging` or to
   `main` that touches `apps/edge` deploys it, and the deploy fails when the
   namespace is missing. The pull request dry run does not check the
   namespace, so a green pull request does not prove step 2.

The GitHub repository secret with the same name, `CLOUDFLARE_V2_DEPLOY_TOKEN`,
is a different token: the CI deploy of the edge Worker uses it, and it
keeps its wider scopes (Workers Scripts and Workers Routes). Do not put the
narrow token of step 3 into GitHub, and do not put the CI token into
Railway or Trigger.dev.

## Backend lifecycle (WANDIT-184)

The operator steps to pause or wake one backend by hand, and to test the
daily `backend-pause-sweep` on staging, are in
`docs/v2/backend-lifecycle.md` ("Operator steps"). The sweep needs
`SUPABASE_PLATFORM_TOKEN` and `SUPABASE_PLATFORM_ORG_ID` in the Trigger.dev
environment and runs only in PRODUCTION and STAGING. `BACKEND_IDLE_DAYS`
and `BACKEND_IDLE_DAYS_PUBLISHED` override the idle windows; leave them
unset in production until WANDIT-153 settles the numbers.

## Mobile builds (WANDIT-194)

The Android card of the publish popover builds an APK on EAS. The API and the
`mobile-build` Trigger task use the robot token of the wandit Expo
organization. Do these steps in this order.

1. In the wandit Expo organization, open Settings > Access tokens. Add a
   robot user with the Developer role, so it can create projects and
   builds. Create a token for it. Never paste the token in a chat.
2. Set two values on the API service in Railway and in the Trigger.dev
   environment, for staging first:
   - `EXPO_TOKEN`: the robot token of step 1.
   - `EXPO_ACCOUNT`: the name of the Expo organization.
   `GET /api/v2/health` then reports both as `true`. Without them the create
   route answers 503 `V2_ENV_MISSING`, and a queued build fails with
   `unconfigured`.
3. The Trigger deploy adds git, `eas-cli@24.8.0`, and `pnpm@11.7.0` to the
   worker image (`apps/server/trigger.config.ts`). It needs no manual step.
4. Check the EAS plan of the organization. The free plan gives 15 Android
   builds per month, one build at a time, and a 45-minute build timeout.
   After the quota, an Android build costs about $1 to $2.
5. End test on staging: open a mobile project that has a saved version,
   click "Build APK" in the publish popover, and install the APK on an
   Android phone. Log the build id, the EAS build id, the project id, the
   duration, and the credits.

Local run: install `npm install -g eas-cli@24.8.0 pnpm@11.7.0`, put
`EXPO_TOKEN` and `EXPO_ACCOUNT` in `apps/server/.env`, and start the worker
with `npx trigger.dev@4.5.3 dev` from `apps/server`. Caution: each run uses
one EAS build.

Check these facts on the first real build (UNVERIFIED):

- `eas init --account <org>` with a robot token creates the EAS project.
- code.storage allows a fetch by commit sha. Else the task fetches `main`
  and checks out the sha.
- The first non-interactive build creates the Android keystore on EAS
  (eas-cli 18.2 and later).
