# code.storage 100-repository measurement

Status: waiting. The spike needs the real `code.storage` account, which
WANDIT-156 opens. There is no script yet — this README holds the steps
and the targets so the follow-up issue can write it.

## What to measure

WANDIT-152 asks for the cost of the repository lifecycle at 100 projects:

1. Create 100 repositories (`POST /api/v1/repos`, one `repo:write` JWT per
   repository, TTL 300 s).
2. Push one small commit to each repository.
3. Clone each repository once.
4. Delete the 100 repositories.

Measure wall time for each phase and the p50/p95 of one create call, one
push, and one clone. Note the rate-limit answer: how the API responds
when creates run concurrently (429 + `Retry-After`, or a hard limit).

## How to run it (once the account exists)

- `CODE_STORAGE_ORG`: the org slug from the code.storage dashboard.
- `CODE_STORAGE_PRIVATE_KEY`: the PKCS8 PEM of the org's ECDSA P-256 key
  (`\n` escapes are accepted by `mintCodeStorageJwt`).
- Reuse `CodeStorageGitStore` for create/delete and `issueCredential` +
  `authenticatedRemoteUrl` for push/clone with the git CLI.
- The integration spec
  `apps/server/src/modules/app-builder/infrastructure/git/code-storage.integration.spec.ts`
  is the single-repository version of this flow and a good starting
  point for the script.
- Set `V2_CODE_STORAGE_INTEGRATION_TEST=true` to run that spec as a
  smoke test first.

## Acceptance targets (from WANDIT-152)

- 100 repositories created without manual intervention.
- Repository creation p95 below 10 s.
- Push and clone of a template-size repository p95 below 30 s.
- Rate limits documented with the measured numbers.
- All 100 repositories deleted at the end (cleanup is part of the
  measurement).
