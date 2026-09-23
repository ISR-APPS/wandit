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
