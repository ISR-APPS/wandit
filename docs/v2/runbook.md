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
