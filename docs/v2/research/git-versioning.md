# Version history and git for non-technical users — wandit V2

Date: 2026-09-03. Branch: `feat/v2-builder` (same as `dev`, commit `1b2a9a1e`).
Author: Claude Fable research agent. Read-only. No code changed.

Evidence marks: `path:line` = read in this worktree. URL = fetched on 2026-09-03. **UNVERIFIED** = not confirmed from a primary source. **ESTIMATE** = a planning number that I derived, not a vendor number.

Note on method: the web search budget of this session was already used up before this task started. Every web fact below comes from a direct fetch of a known URL (official docs, pricing pages, GitHub repos, npm registry). I could not run keyword searches. Facts I could not reach are marked UNVERIFIED.

---

## 0. Summary in twelve sentences

1. Every competitor (Lovable, Bolt, v0, Base44, Replit) makes one version per chat change, hides git by default, and offers GitHub as an optional export or sync.
2. Restore in Lovable and Bolt restores code only, never the database; wandit V2 should state the same rule in the UI.
3. Claude Code has its own checkpoint feature, but it tracks only `Write`/`Edit`/`NotebookEdit` tool changes, not bash changes, not subagent edits, and it dies with the session; the docs say to use git for permanent history.
4. So the correct source of truth for V2 versions is a real git repository inside the sandbox, with one commit per assistant message and a tag `msg/<messageId>` on each commit.
5. Sandbox filesystem snapshots (Vercel `$0.08/GB-month`, full filesystem with `node_modules`) are the right tool for warm resume, but the wrong tool for version history: a per-message snapshot would cost about `$32` per project-month at 2 GB per snapshot (ESTIMATE), versus cents for git.
6. The cheapest durable store for git data is Cloudflare R2, which the repo already uses: `$0.015/GB-month`, egress free, strongly consistent, presigned S3 URLs (`apps/server/src/infrastructure/storage/r2.ts:42-61`).
7. A source-only git repo for a Vite or Expo app is about 1–10 MB after 200 messages (ESTIMATE); 10,000 projects then cost about `$1.50/month` of R2 storage.
8. GitHub as the internal store is workable but wrong for this product: a hard cap of 100,000 repos per account, 500 content-creating API requests per hour, 6 pushes per minute per repo, one-hour installation tokens, user code inside a wandit-owned org, and GitHub acceptable-use language on excessive bandwidth.
9. A self-hosted Gitea or Forgejo is a good phase-2 upgrade (standard `git push`, server-side diff and archive API, push mirrors to GitHub, fork API), and it needs about 2 CPU cores and 1 GB RAM plus a Railway volume at `$0.15/GB-month`, capped at 1 TB on Pro.
10. Phase 1 needs no git server: the sandbox writes incremental `git bundle` files to R2 after each commit, Postgres holds the head pointer and the per-message metadata, and a fresh sandbox rebuilds the repo from the bundles in seconds.
11. Restore should copy forward (a new commit whose tree equals the old commit), exactly like V1's `restoreVersion` (`apps/server/src/modules/pages/application/services/page-edits.service.ts:188-234`), so history stays linear and chat continues.
12. Export to GitHub later is a `git push --all --tags` from the sandbox with a GitHub App user token; two-way sync later is a GitHub App `push` webhook plus `git pull --ff-only` in the sandbox, with Lovable's fallback-branch rule for rejected pushes.

---

## 1. What V1 does today (repo facts)

V1 already has an immutable-version model. V2 should keep the shape and change the payload from "one HTML file" to "one git commit".

| Fact | Evidence |
| --- | --- |
| A project has one `landing_page` artifact and many immutable `versions` rows. Rows are only inserted, never updated. | `packages/db/src/schema/artifacts.ts:19, 48-50, 63-64` |
| `artifacts.activeVersionId` is the mutable draft pointer. | `packages/db/src/schema/artifacts.ts:31-33` |
| Each version stores one R2 key `sites/{project_id}/{version_id}/index.html` and the assistant `messageId` that produced it. | `packages/db/src/schema/artifacts.ts:75-80` |
| Version numbers are per-artifact sequences `v1, v2...`. | `packages/db/src/schema/artifacts.ts:73-74, 91-94` |
| Extra files are written beside `index.html` with `siteFileKey`, but there is no per-file DB row and no manifest. | `apps/server/src/infrastructure/storage/r2.ts:69-77` |
| Publish writes an immutable archive `published/{project_id}/v/{deployment_id}.html` and then overwrites `published/{project_id}/current.html`. | `apps/server/src/infrastructure/storage/r2.ts:79-94` |
| `deployments` is an ordered publish history: `pending → active | failed`, `superseded`, `unpublished`. | `packages/db/src/schema/deployments.ts:16-25` |
| A deployment points at a version through a composite FK `(projectId, versionId)`. | `packages/db/src/schema/deployments.ts:62-70` |
| New versions use compare-and-swap on the active pointer (`expectedActiveVersionId`, `VersionConflictError`). | `apps/server/src/modules/pages/infrastructure/persistence/pages.repository.ts:1007-1068` |
| Restore is copy-forward: "Restoring is copy-forward, never a pointer rewind: read the selected historical version, then append its stamped HTML as a brand-new version." The new row carries `source: "restore"` and `restoredFromVersionId`. | `apps/server/src/modules/pages/application/services/page-edits.service.ts:188-234` |
| Restore endpoint: `POST projects/:projectId/page/versions/:versionId/restore`, guarded by workspace permission `project:update`. | `apps/server/src/modules/pages/presentation/http/controllers/pages.controller.ts:172-192` |
| Version sources are `"ai-edit" | "inline" | "restore" | "theme"`. | `apps/server/src/modules/pages/application/services/page-edits.service.ts:341` |
| Publish rollback re-runs the publish pipeline from the archived bytes of an older deployment. | `apps/server/src/modules/sites/application/services/sites.service.ts:177-231` |
| The web UI has a `VersionSwitcher` dropdown with `v{n}`, relative time, `live` and `latest` badges. | `apps/web/src/features/workspace/components/page/version-switcher.tsx:17-80` |
| R2 is accessed through `@aws-sdk/client-s3` with `region: "auto"` and `requestChecksumCalculation: "WHEN_REQUIRED"`. | `apps/server/src/infrastructure/storage/r2.ts:42-57` |
| The API server runs on Railway (`europe-west4`), background tasks on Trigger.dev, the edge on Cloudflare Workers + KV + R2. | `docs/v2/research/inspect-infra-ops.md:12, 33, 101-113` |

The sibling report `docs/v2/research/inspect-data-model.md` (section 6.3) already proposes an `app_snapshots` table with `projectId`, `number`, `parentSnapshotId`, `messageId`, a manifest, and a root R2 prefix. Section 7 of this report refines that proposal into a git-backed design.

---

## 2. Requirements from the product context

| Requirement | What it means in git terms |
| --- | --- |
| Restore to any message | One commit per assistant message; a tag `msg/<messageId>`; restore = copy-forward commit. |
| Diff view | Per-message patch and numstat, computed at commit time; on-demand `git diff A B` for any pair. |
| Branch per chat | Git branch `chat/<chatId>`; one sandbox per checked-out branch. |
| Fork a project | New project row + copy of the git data; database schema copied, data not (Lovable rule). |
| Export to GitHub later | `git push --all --tags` to a repo in the user's account; GitHub App user token. |
| Cheap storage | Git pack deltas in R2 at `$0.015/GB-month`. |
| Works with Claude Code doing git inside the sandbox | Git CLI in the sandbox image; the server drives the commit after each turn; the model may read git, not push. |
| Hide git from non-technical users | UI words: "Versions", "Restore", "Compare", "Try an idea" (branch), "Bring into main" (merge), "Copy project" (fork), "Export code to GitHub". |

---

## 3. How the competitors do it

### 3.1 Lovable

- "Lovable automatically captures every project change as a version without requiring manual saves." Each version offers a full-screen preview, "code change diffs showing modified files and lines", navigation to the chat message, revert, and a bookmark toggle. https://docs.lovable.dev/features/projects/history.md
- "Reverting restores your project's code only...It does not restore or roll back your database data." Revert is disabled when you are already on that version, for projects remixed from Cloud-backend versions, or for very old versions (preview still works). Same page.
- Editing a past message triggers "an automatic revert-and-resend workflow". Same page.
- Git sync is two-way on one branch at a time: "changes you make in Lovable are committed to your repository, and commits pushed to the synced branch appear back in your Lovable project." Limits: export-only (no import of an existing repo), one repository per project, one active branch, no sync for drafts. Reconnecting creates a **new** repository. https://docs.lovable.dev/integrations/git-sync-overview.md
- GitHub App permissions requested: "Contents (write), Metadata (read), Pull requests (write), Workflows (write), Administration (write)". Repos are private by default. "Each Lovable edit becomes a commit authored by the GitHub app identity (`lovable-dev[bot]`)", co-attributed to the workspace member. Lovable cannot save files larger than 10 MB. https://docs.lovable.dev/integrations/github.md
- Remix copies code and database structure ("tables and schema, not the records"), optionally chat history. Version history "starts fresh". Secrets, domains, git connections, collaborators do not carry over. https://docs.lovable.dev/features/projects/remix.md
- GitLab.com and self-managed GitLab are supported. https://docs.lovable.dev/integrations/gitlab.md
- I could not find an engineering blog post that explains Lovable's internal version store. The docs changelog has no entry about the history panel. **UNVERIFIED** how Lovable stores versions internally (git-backed is the likely answer given per-edit commits, but that is inference).

### 3.2 Bolt.new

- Built-in Version History "automatically keeps older versions of your work", with a visual timeline, preview, and "Restore this version". Restore is also possible from the chat history. "Restoring to an earlier project version will not change your current Bolt or Supabase databases." https://support.bolt.new/building/using-bolt/rollback-backup.md
- No retention limit or backup count is documented. **UNVERIFIED** how long Bolt keeps backups.
- GitHub: "Every time you make a change that doesn't break the project, Bolt creates a commit for you." Bolt "checks GitHub every 30 seconds for any updates made outside Bolt and pulls those in." Repos start private on `main`. Branch creation in-app; "Bolt currently doesn't support merging branches in-app." https://support.bolt.new/integrations/git.md
- Bolt's docs position GitHub as the "advanced" path: "if you need ... advanced collaboration, branching, or detailed history, Bolt's built-in system may not be sufficient." https://support.bolt.new/concepts/version-history-github.md
- Org install: "an organization admin installs the app once and selects which repositories Bolt users can access." https://support.bolt.new/integrations/github-org.md

### 3.3 v0 (Vercel)

- "v0 creates a private repository and pushes the project's current code to it." v0 "creates a working branch from that base", "Generated code changes are then committed and pushed to the working branch automatically", and v0 "creates a pull request if the branch does not have one, or reuses its existing pull request." After publish, v0 re-syncs with the base branch. https://v0.app/docs/github
- The v0 docs do not describe a separate version store. Git **is** the version history in v0. The sibling report confirms per-chat branches like `v0/username-abc123` (`docs/v2/research/competitor-architectures.md:153`).

### 3.4 Base44

- Two-way GitHub sync, automatic only ("There's no option to manually push updates"), `main` branch only ("This branch must be named `main`"). "After you connect GitHub to your app, you cannot use Version History to revert to versions from before the GitHub integration." Builder plan or higher. https://docs.base44.com/developers/app-code/local-development/github.md
- Branches for non-technical users: "each branch has its own chat and its own live preview"; "up to 5 builds at the same time"; "Merge to main replaces the Publish button"; after merge "a summary of the branch's changes appears in main's chat" and the branch becomes read-only. "A branch uses your real, live data." No limit on branch count. https://docs.base44.com/Building-your-app/working-with-branches.md
- This is the best UX model for wandit's "branch per chat" requirement.

### 3.5 Replit and Emergent (from the sibling report)

- Replit: "Time travel: restore your database to any Agent checkpoint" — code and data restore together (`docs/v2/research/competitor-architectures.md:200, 206`).
- Emergent: Kubernetes pods; an init container "pulls the user's previous working state from a content-addressed backup in object storage", which "typically completes in 2–6 seconds"; a sidecar makes "an incremental backup of the working state back to object storage before the pod exits". They moved off VolumeSnapshot because of "scaling limits (millions of snapshots)". https://emergent.sh/blog/real-environments-for-ai-agents-and-why-we-bet-on-kubernetes

Pattern across all five: one version per change, code-only restore, git hidden by default, GitHub optional.

---

## 4. Building-block facts

### 4.1 Claude Code checkpoints are not a version store

- Claude Code CLI: "Every user prompt creates a new checkpoint"; it "keeps file snapshots for the 100 most recent checkpoints in a session"; checkpoints are deleted "along with sessions after 30 days". Limitations: "Checkpointing does not track files modified by bash commands"; subagent edits are not restored ("Use git to revert them"); "Not a replacement for version control". https://code.claude.com/docs/en/checkpointing
- Agent SDK file checkpointing: `enableFileCheckpointing: true` plus `extraArgs: { 'replay-user-messages': null }`; rewind with `rewindFiles(checkpointUuid)`. "Only changes made through the Write, Edit, and NotebookEdit tools are tracked." "Checkpoints are tied to the session that created them." "Creating, moving, or deleting directories is not undone by rewinding." https://code.claude.com/docs/en/agent-sdk/file-checkpointing
- Agent SDK sessions: "Sessions persist the conversation, not the filesystem." Fork "branches the conversation history, not the filesystem." Sessions live in `~/.claude/projects/<encoded-cwd>/*.jsonl`; a `SessionStore` adapter mirrors them for cross-host resume. https://code.claude.com/docs/en/agent-sdk/sessions

Conclusion: the agent will run `pnpm add`, `mv`, `rm`, and codemods through bash. Only git captures all of that. Use git for file history and the Agent SDK session (or the harness resume state) for chat history.

### 4.2 AI SDK harness and Vercel Sandbox

- `HarnessAgent` takes a `sandbox: HarnessV1SandboxProvider`, and `sandboxConfig: { workDir?, bootstrapHash?, onBootstrap?, onSession? }`. Sessions: `createSession()`, `session.detach()` (keeps sandbox warm), `session.stop()` (saves resume state, stops sandbox), `session.destroy()`. Packages: `@ai-sdk/harness`, `@ai-sdk/harness-claude-code`, `@ai-sdk/sandbox-vercel`. https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent
- "all AI SDK agent harnesses operate in a sandbox". https://ai-sdk.dev/docs/ai-sdk-harnesses/overview
- Host tools receive `experimental_sandbox` with `readTextFile`, `writeTextFile`, `run` (`docs/v2/research/ai-sdk-harness.md:147`). This is one way for the server to run `git` inside the sandbox between turns. The other way is a direct `@vercel/sandbox` handle (`sandbox.runCommand`, `sandbox.readFile`, `sandbox.writeFiles`, `sandbox.fs`). https://vercel.com/docs/sandbox/sdk-reference
- `Sandbox.create({ source: { url, username?, password?, depth?, revision? } })` clones a git repo at creation. `Sandbox.fork({ sourceSandbox })` clones a sandbox. `sandbox.snapshot({ expiration })` returns `snapshotId`, `sizeBytes`, `regions`, `expiresAt`; "Once you create a snapshot, the sandbox shuts down automatically." https://vercel.com/docs/sandbox/sdk-reference ; https://vercel.com/docs/sandbox/concepts/snapshots
- Persistence is the default: on stop the SDK snapshots the filesystem; `snapshotExpiration` defaults to 30 days from last use; `keepLastSnapshots: { count: 1 }` "keeps snapshot storage flat"; "Vercel removes sandboxes that can't resume from a snapshot after 14 days of inactivity." https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
- Drives (private beta): up to 1 TiB per drive, up to 4 per sandbox, "single reader, single writer", "Free during private beta", "Persists until manually deleted". https://vercel.com/docs/sandbox/concepts/drives
- Managed images: `vercel/sandbox/universal` = "Node.js LTS (24), Python (3.14), coding agents, utilities"; `vercel/sandbox/node:22|24|26` = Node + pnpm; `vercel/sandbox/arch` lists `git` explicitly. **UNVERIFIED** whether `universal` and `node` images ship `git` (the table does not list it). A custom image from a Dockerfile with `git` installed removes the doubt. https://vercel.com/docs/sandbox/concepts/images
- "Data your sandbox downloads from the internet, such as packages, Git repositories, artifacts, and datasets, is free." Data sent out is `$0.15/GB`. https://vercel.com/docs/sandbox/pricing

### 4.3 Sandbox snapshots as a version store (why not)

| Provider | What a snapshot is | Retention | Price | Source |
| --- | --- | --- | --- | --- |
| Vercel Sandbox | Full filesystem (64 GB disk). Memory not included. `sizeBytes` reported. | 30 days after last use by default; `0` = forever; `keepLastSnapshots` 1–10 | `$0.08/GB-month`, Hobby 15 GB lifetime; billed from daily average | https://vercel.com/docs/sandbox/pricing ; https://vercel.com/changelog/vercel-sandbox-now-calculates-snapshot-storage-costs-daily |
| E2B | `createSnapshot()` captures "filesystem and memory state"; one sandbox can have many snapshots; needs envd ≥ v0.5.0. Paused sandboxes are "kept indefinitely". | Not documented | Storage "Free on both tiers (10 GiB Hobby; 20 GiB Pro)"; snapshot price not documented | https://docs.e2b.dev/sandbox/snapshots ; https://docs.e2b.dev/sandbox/persistence ; https://e2b.dev/pricing |
| Daytona | Container sandboxes: filesystem only, sandbox must be stopped; VM sandboxes: `includeMemory`. "Snapshots automatically become inactive after 2 weeks of not being used." | 2 weeks active | Storage `$0.000108/GiB-hour` (≈ `$0.078/GiB-month`) after first 5 free; snapshot price not separated | https://www.daytona.io/docs/en/snapshots/ ; https://www.daytona.io/pricing |

A Vite + Expo workspace with `node_modules` is on the order of 1–3 GB (ESTIMATE; the sibling sandbox report plans 2 GB, `docs/v2/research/sandboxes.md:310`). Per-message snapshots at 2 GB × 200 messages × `$0.08` = `$32` per project-month, and none of the providers deduplicate across snapshots in their docs. Snapshots are for warm resume only. Keep one per project, expire it after inactivity, and rebuild from git.

### 4.4 Git tooling in Node and in the sandbox

| Tool | Version | Notes | Source |
| --- | --- | --- | --- |
| git CLI (in sandbox) | distro package | The only complete option. Bundles, worktrees, packs, `read-tree`, delta compression. | https://git-scm.com/docs/git-bundle ; https://git-scm.com/docs/git-worktree |
| `simple-git` | 3.36.0 | Thin wrapper over the git CLI for Node. Needs git on the host. | https://registry.npmjs.org/simple-git/latest |
| `isomorphic-git` | 1.41.9 | "A pure JavaScript reimplementation of git for node and browsers". clone, commit, push, fetch, merge, tag, log, diff, status. Useful on the API server (Railway) to read packs without a git binary. Cannot read `.bundle` files directly (a bundle is a header plus a packfile; you would strip the header). **UNVERIFIED** performance on large packs. | https://registry.npmjs.org/isomorphic-git/latest ; https://github.com/isomorphic-git/isomorphic-git |
| `nodegit` (libgit2 bindings) | 0.28.3 (libgit2 v0.28.3) | 343 open issues, native build. libgit2 itself is at v1.9.7 (2024-08-13 security release). Do not use; the binding lags libgit2 by years. | https://github.com/nodegit/nodegit ; https://github.com/libgit2/libgit2/releases |
| `git-remote-s3` (AWS Labs) | Python ≥ 3.9, Apache-2.0 | A git remote helper that stores "bundles organized as `<prefix>/<ref>/<sha>.bundle`" in S3, with per-ref locking (stale after 60 s). Proves the "bundles in object storage" pattern. R2 speaks S3, so it should work against R2 (**UNVERIFIED**, not tested). Python in the sandbox is one more dependency; a 40-line shell script does the same job for one writer. | https://github.com/awslabs/git-remote-s3 |
| git bundle | built-in | "Incremental Bundles (Basis)": `git bundle create incremental.bundle old..new`; `git bundle verify`; `git clone file.bundle`; `git fetch bundle`. | https://git-scm.com/docs/git-bundle |
| git worktree | built-in | "A branch can only be checked out in one worktree at a time." Linked worktrees share objects and refs. | https://git-scm.com/docs/git-worktree |

### 4.5 Object storage prices and limits

| Store | Storage | Writes | Reads | Egress | Limits | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Cloudflare R2 Standard | `$0.015/GB-month` (10 GB-month free) | Class A `$4.50/M` (1 M free) | Class B `$0.36/M` (10 M free) | Free | Object ≤ 5 TiB; "1 per second" concurrent writes to the same object; REST management API 1,200 req / 5 min; 1,000,000 buckets | https://developers.cloudflare.com/r2/pricing/ ; https://developers.cloudflare.com/r2/platform/limits/ |
| Cloudflare R2 Infrequent Access | `$0.01/GB-month`, 30-day minimum | Class A `$9.00/M` | Class B `$0.90/M`; retrieval `$0.01/GB` | Free | Same | https://developers.cloudflare.com/r2/pricing/ |
| AWS S3 Standard (us-east-1) | **UNVERIFIED** (pricing tables did not render in the fetch; commonly `$0.023/GB-month` for the first 50 TB, egress ≈ `$0.09/GB`) | UNVERIFIED | UNVERIFIED | Not free | — | https://aws.amazon.com/s3/pricing/ |
| Railway volume | `$0.15/GB-month`; Hobby max 5 GB, Pro up to 1 TB | — | — | `$0.05/GB` | Single service attach | https://docs.railway.com/reference/pricing/plans |
| Vercel snapshot storage | `$0.08/GB-month` | — | — | — | Region-bound | https://vercel.com/docs/sandbox/pricing |

R2 wins on every axis for wandit: cheapest, egress free, already integrated, same account as the edge Worker.

### 4.6 GitHub facts (for options A and B)

- Repository limits: recommended on-disk size "10 GB"; single file enforcement "100 MB"; push size "2GB"; "15 operations per second per repository" for git reads; "6 pushes per minute per repository"; maximum "100,000" repositories per account with a warning at "50,000". https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- REST primary rate limit for a GitHub App installation: "5,000 requests per hour" base; "+50 requests per hour for each repository" above 20 repos and "+50 ... for each user" above 20 users; ceiling "12,500 requests per hour" (15,000 on Enterprise Cloud). Secondary limits: "No more than 100 concurrent requests"; "No more than 900 points per minute"; "No more than 80 content-generating requests per minute and no more than 500 content-generating requests per hour". https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Creating an org repository (`POST /orgs/{org}/repos`) and deleting a repository need the App's repository "Administration" permission at `write`; git push needs "Contents" at `write`. https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
- Installation access tokens "expire after 1 hour". Clone/push syntax: `git clone https://x-access-token:TOKEN@github.com/owner/repo.git`. https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- Pricing: Free plan has "Unlimited" private repositories; Team `$4` per user/month (promo, first 12 months); Enterprise from `$21` per user/month. Seats are per human, not per repo. https://github.com/pricing
- Acceptable use: "If we determine your bandwidth usage to be significantly excessive in relation to other users of similar features, we reserve the right to suspend your Account, throttle your file hosting, or otherwise limit your activity." "automated excessive bulk activity" is prohibited. https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
- Terms: "One person or legal entity may maintain no more than one free Account" plus "no more than one free machine account". https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- User access token lifetime (8 h) and refresh token lifetime (6 months) are **UNVERIFIED** here; the page I fetched did not include the numbers. https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user

### 4.7 Gitea / Forgejo / GitLab facts (for options C and D)

- Gitea: "A Raspberry Pi 3 is powerful enough to run Gitea for small workloads"; "2 CPU cores and 1GB RAM is typically sufficient for small teams/projects". Databases: SQLite3, MySQL, PostgreSQL, MSSQL. https://docs.gitea.com/
- Docker image `docker.gitea.com/gitea:1.27.3`, volume `/data`, ports 3000 (web) and 22 (SSH). https://docs.gitea.com/installation/install-with-docker
- Repo creation limits `MAX_CREATION_LIMIT`, `USER_MAX_CREATION_LIMIT`, `ORG_MAX_CREATION_LIMIT` default `-1` (unlimited). Repos live on local disk under `[repository] ROOT`. Object storage (`[storage]`) covers attachments, LFS, packages, avatars, repo archives, actions — **not** the git objects. https://docs.gitea.com/administration/config-cheat-sheet
- API: tokens with scopes (`repository`, `organization`, `admin`...), `Sudo:` header for admins, pagination `MAX_RESPONSE_ITEMS` 50; no built-in API rate limit documented. https://docs.gitea.com/development/api-usage
- Push mirrors: "Sync when new commits are pushed" (Gitea 1.18+) pushes to GitHub with a personal access token as password. "This will force push to the remote repository." https://docs.gitea.com/usage/repo-mirror
- Forgejo v16.0.3: same API family, swagger at `/api/swagger`, no rate limits documented. https://forgejo.org/docs/latest/user/api-usage/
- GitLab self-managed baseline: "8 vCPU" and "16 GB" for a single node (8 GB minimum in constrained setups), "40 GB" application storage plus repositories. https://docs.gitlab.com/install/requirements/ . GitLab pricing page returned HTTP 403; tier prices **UNVERIFIED**. https://about.gitlab.com/pricing/

---

## 5. Option analysis

Scoring key: ✅ good, ⚠️ workable with cost or caveat, ❌ blocker.

### Option A — GitHub App, one repo per project inside the wandit org

- Verdict: ⚠️ Works at small scale; wrong as the primary store.
- Pros: zero storage cost; standard git remote; diff, blame, archive, compare APIs for free; export to the user is a transfer or a push; battle-tested.
- Cons: hard cap 100,000 repos per account with warnings at 50,000; 500 content-creating requests per hour (repo creation is one) so at most ~500 new projects per hour per App; 6 pushes/min/repo and 15 git reads/s/repo; installation tokens expire every hour; every user's code sits in a wandit-owned org (privacy and data-residency questions); GitHub acceptable-use language on excessive bandwidth and bulk automation; a second org per 50k projects is a workaround that smells like ToS abuse; wandit depends on GitHub availability for every restore.
- Pricing: `$0` storage; Free org has unlimited private repos; Team `$4/user/month` per human seat; API and push limits as above.
- Sources: https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits ; https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api ; https://github.com/pricing ; https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies

### Option B — GitHub two-way sync to the user's own account (Lovable / Bolt / Base44 style)

- Verdict: ✅ as an optional export and sync feature, ❌ as the primary store.
- Pros: users own their code; matches the market (Lovable, Bolt, v0, Base44 all do it); costs wandit nothing; the GitHub App pattern is well documented (Contents write, Administration write, Pull requests write).
- Cons: non-technical users do not have GitHub accounts, so it cannot be the default; two-way sync creates conflicts (Lovable pushes to `lovable-sync` when the branch is protected; Base44 added AI conflict resolution in 2026-08); Base44 disables restore to pre-integration versions; Bolt polls GitHub every 30 s.
- Pricing: `$0` for wandit; the user's GitHub plan.
- Sources: https://docs.lovable.dev/integrations/github.md ; https://support.bolt.new/integrations/git.md ; https://docs.base44.com/developers/app-code/local-development/github.md ; https://v0.app/docs/github

### Option C — Self-hosted Gitea or Forgejo with API

- Verdict: ✅ strong phase-2 choice for a real internal remote.
- Pros: standard `git push` from the sandbox (no custom sync code); server-side diff, archive, compare, fork APIs; push mirrors to GitHub cover "export later"; webhooks; unlimited repos (`MAX_CREATION_LIMIT=-1`); tiny footprint (2 cores, 1 GB); SQLite or the existing Postgres; Apache/MIT licence; Forgejo is the community fork with the same API.
- Cons: one more stateful service to run and upgrade; git objects must live on a local volume (Railway `$0.15/GB-month`, 1 TB cap on Pro → about 100,000 projects at 10 MB); single point of failure for restores unless you also back up to R2; per-project auth tokens to manage; `git gc` and disk growth to watch; push mirrors force-push.
- Pricing: Railway service ≈ `$20/month` compute at 1 vCPU / 1 GB (ESTIMATE from `$20/vCPU-month` and `$10/GB-month`) + `$0.15/GB-month` volume. 10,000 projects × 10 MB = 100 GB → `$15/month` volume.
- Sources: https://docs.gitea.com/ ; https://docs.gitea.com/administration/config-cheat-sheet ; https://docs.gitea.com/usage/repo-mirror ; https://forgejo.org/docs/latest/user/api-usage/ ; https://docs.railway.com/reference/pricing/plans

### Option D — Self-hosted GitLab

- Verdict: ❌ too heavy.
- Pros: full platform (CI, registry, MR); Lovable supports self-managed GitLab as a sync target.
- Cons: 8 vCPU / 16 GB baseline for one node; heavy upgrades; no feature wandit needs beyond what Gitea gives.
- Pricing: UNVERIFIED (pricing page blocked); infra alone ≈ `$160+/month` on Railway at 8 vCPU (ESTIMATE).
- Sources: https://docs.gitlab.com/install/requirements/ ; https://docs.lovable.dev/integrations/gitlab.md

### Option E — Bare git data in object storage (git bundles on R2, "git on S3")

- Verdict: ✅ recommended phase-1 internal remote.
- Pros: no server; `$0.015/GB-month`, egress free; strongly consistent; presigned PUT/GET from the sandbox; immutable objects fit the V1 model (`sites/{project}/{version}` style keys); restore = download a few bundles and `git clone`/`git fetch`; fork = copy a prefix; disaster recovery is a bucket copy; the AWS `git-remote-s3` project proves the pattern.
- Cons: custom code (bundle chain, head pointer, compaction); no server-side git API (diff and archive must be produced in a sandbox at commit time or on demand); a broken chain blocks restore (mitigate with `git bundle verify` before recording, plus a full bundle every N commits); one writer per project only (fine: one sandbox owns a branch).
- Pricing: 10,000 projects × 10 MB → `$1.50/month`; 1 M messages/month × 3 Class A ops → `$13.50/month`.
- Sources: https://git-scm.com/docs/git-bundle ; https://github.com/awslabs/git-remote-s3 ; https://developers.cloudflare.com/r2/pricing/ ; `apps/server/src/infrastructure/storage/r2.ts:42-94`

### Option F — Content-addressed file snapshots per message in R2 (Bolt / Emergent style)

- Verdict: ⚠️ good, but git does the same thing better.
- Pros: simple mental model (manifest JSON → blob keys); language-agnostic; server can render any version without git; per-file dedup for free.
- Cons: no delta compression (a 300 KB lockfile changes on every `pnpm add`, and each change is a new full blob); you re-implement diff, blame, merge, and branch semantics; export to GitHub needs a git conversion step; the agent cannot use `git log`/`git diff` to reason about its own history.
- Pricing: same R2 rates; storage roughly 2–5× git packs (ESTIMATE).
- Sources: https://emergent.sh/blog/real-environments-for-ai-agents-and-why-we-bet-on-kubernetes ; https://developers.cloudflare.com/r2/pricing/

### Option G — Sandbox filesystem snapshots as versions

- Verdict: ❌ as a version store; ✅ for warm resume only.
- Pros: zero code; captures `node_modules`, caches, everything; `Sandbox.fork` gives instant "try an idea" sandboxes.
- Cons: `$0.08/GB-month` on full filesystems; no diff; region-bound; 30-day default expiry; not exportable as code; Vercel docs recommend `keepLastSnapshots: { count: 1 }` for flat storage.
- Pricing: 2 GB × `$0.08` = `$0.16` per snapshot-month; per-message snapshots ≈ `$32` per project-month (ESTIMATE).
- Sources: https://vercel.com/docs/sandbox/concepts/snapshots ; https://vercel.com/docs/sandbox/pricing ; https://docs.e2b.dev/sandbox/snapshots ; https://www.daytona.io/docs/en/snapshots/

---

## 6. Recommended design

### 6.1 Principles

1. Git inside the sandbox is the source of truth for files. Postgres is the source of truth for the version list. R2 is the durable copy of the git data. The sandbox snapshot is only a cache.
2. One commit per assistant message. The server makes the commit after the turn ends. The model does not decide when to commit.
3. Restore copies forward. History never rewinds. This is the V1 rule (`page-edits.service.ts:188-190`) and the Lovable rule.
4. Restore changes code only. The UI says so. Database data stays (Lovable, Bolt, Base44 all state this).
5. No git word in the default UI. Words: Versions, Restore, Compare, Try an idea, Bring into main, Copy project, Export code.
6. Secrets and media never enter git. `.env` is generated at session start from the secrets table. Media goes to R2 through the upload API and is referenced by URL, as in V1 (`docs/v2/research/inspect-publish-serve.md:55`).

### 6.2 Layout inside the sandbox

```
/vercel/sandbox/app            # git worktree, branch chat/<chatId> or main
/vercel/sandbox/app/.git       # normal repo; objects shared by worktrees
/vercel/sandbox/.wandit/       # bundle scripts, last-bundled sha, harness bridge
```

Git identity: `user.name = "wandit"`, `user.email = "bot@wandit.app"`; commit trailer `Wandit-Message: <messageId>` and `Wandit-Chat: <chatId>` so a plain `git log` in an export is self-describing.

Claude Code settings in the sandbox (`.claude/settings.json`): deny `Bash(git push:*)`, `Bash(git reset --hard:*)`, `Bash(git checkout:*)`, `Bash(git switch:*)`, `Bash(git rebase:*)`, `Bash(git tag:*)`; allow read-only git (`log`, `diff`, `status`, `show`, `blame`). The server owns branch state. Permission rules are a Claude Code feature (settings reference is linked from https://code.claude.com/docs/en/checkpointing); exact rule syntax to confirm at implementation time.

### 6.3 Commit after each message

Trigger: the harness `finish` part for the assistant message (server `onFinish`). Run in the sandbox through `sandbox.runCommand` (or the host tool `experimental_sandbox.run`):

```sh
cd /vercel/sandbox/app
git add -A
git commit -q --allow-empty -m "$SUMMARY" \
  --trailer "Wandit-Message: $MSG_ID" --trailer "Wandit-Chat: $CHAT_ID"
git tag -f "msg/$MSG_ID"
SHA=$(git rev-parse HEAD)
git diff --numstat HEAD~1 HEAD > /tmp/numstat.txt
git diff HEAD~1 HEAD | head -c 1000000 > /tmp/patch.diff
LAST=$(cat /vercel/sandbox/.wandit/last-bundled-sha || true)
if [ -z "$LAST" ] || [ "$N_SINCE_FULL" -ge 50 ]; then
  git bundle create /tmp/b.bundle --all; KIND=full
else
  git bundle create /tmp/b.bundle ^"$LAST" --all; KIND=inc
fi
git bundle verify /tmp/b.bundle
# upload /tmp/b.bundle, /tmp/patch.diff, /tmp/numstat.txt to presigned R2 PUT URLs
echo "$SHA" > /vercel/sandbox/.wandit/last-bundled-sha
```

`--allow-empty` keeps the rule "one commit per message" even when the model changed nothing (the UI can hide empty versions). `$SUMMARY` is the first line of the assistant text or a short model-written summary. The 1 MB patch cap keeps R2 objects small; larger diffs are produced on demand.

R2 keys (immutable, same style as `r2.ts`):

```
git/{projectId}/bundles/{seq:08d}-{full|inc}-{sha}.bundle
git/{projectId}/patches/{sha}.diff
git/{projectId}/patches/{sha}.numstat
git/{projectId}/archives/{sha}.tar.zst       # optional, for publish builds
```

Postgres (aligns with `inspect-data-model.md` 6.3 `app_snapshots`, renamed here to say what it is):

```
app_commits
  id uuid pk
  project_id uuid            -- composite FK pattern like versions (artifacts.ts:97-104)
  chat_id uuid null
  message_id text null       -- assistant message that produced it
  branch text                -- 'main' | 'chat/<id>'
  number int                 -- per-project sequence, like versions.number
  sha char(40), parent_sha char(40) null
  source enum ('agent','restore','merge','import','manual')
  restored_from_commit_id uuid null
  summary text
  files_changed int, insertions int, deletions int
  patch_key text null, numstat_key text
  created_at timestamptz
  unique (project_id, sha), unique (project_id, number)

app_bundles
  id, project_id, seq int, kind enum('full','inc'), r2_key, from_sha null, to_sha, size_bytes, created_at

app_branches
  project_id, name text, head_commit_id, sandbox_name text null, created_from_commit_id, merged_into_commit_id null, status enum('active','merged','archived')
  primary key (project_id, name)

projects: add current_branch text default 'main'
deployments: add commit_id uuid (pair FK with project_id), keep the partial-unique rules (deployments.ts:55-61)
```

Head pointer updates use the same compare-and-swap as V1 (`pages.repository.ts:1007-1068`): `expectedHeadCommitId` in the request, `409 VERSION_CONFLICT` on mismatch.

### 6.4 Rebuild a sandbox from R2

When a sandbox is gone (snapshot expired after 30 days, or deleted after 14 idle days), or for a second sandbox on another branch:

1. Create the sandbox from the warm base snapshot (image + `pnpm` store, no project files).
2. Download the latest `full` bundle and every `inc` bundle after it (presigned GET URLs; downloads into the sandbox are free on Vercel).
3. `git clone full.bundle app && cd app && for b in inc/*.bundle; do git fetch "$b" '+refs/*:refs/*'; done && git switch <branch>`.
4. `pnpm install --frozen-lockfile` (fast when the store is in the base snapshot or on a Drive).
5. Start dev servers.

With a full bundle every 50 commits, a rebuild reads at most 50 small objects plus one full bundle. For a 10 MB repo this is seconds. Compaction can also run in the background: after every full bundle, older `inc` bundles may be deleted.

### 6.5 Restore to a message

`POST /projects/:id/versions/:commitId/restore` with `expectedHeadCommitId`.

In the sandbox: `git read-tree -u --reset <sha> && git commit -m "Restore to version N" --trailer "Wandit-Restore-From: <sha>"`. Then the normal commit hook (tag, bundle, patch). The chat gets a system card "Restored to version N". Later messages still exist and can be restored again (Lovable behaviour: "preserves edits made after reverting"). The UI shows "Restore does not change your app's data" (Lovable/Bolt rule).

Preview of an old version without restoring (Lovable "preview in new tab"): `git worktree add /tmp/preview-<sha> <sha>` in the same sandbox and start a second dev server on another port, or `Sandbox.fork` and `git switch --detach <sha>`. Phase 2.

### 6.6 Diff view

- Adjacent diff (message N vs N-1): read `patches/{sha}.diff` and `.numstat` from R2. No sandbox needed. Render with any unified-diff component.
- Any two versions: `git diff A B` run in the project's sandbox on demand (the user is in the workspace, so a sandbox is warm). Cache the result under `patches/{A}..{B}.diff`.
- Per-file view: `git show <sha>:<path>` on demand.

### 6.7 Branch per chat ("Try an idea")

- New chat = `git switch -c chat/<chatId>` from the current head. One sandbox holds one checkout. Switching the active chat in the same sandbox is `git switch` (dev servers hot-reload).
- Parallel previews (Base44: "each branch has its own chat and its own live preview", up to 5 builds) = `Sandbox.fork({ sourceSandbox })` then `git switch chat/<id>`. Cap at N per plan.
- "Bring into main" = in the main sandbox `git merge --no-ff chat/<id>`; on conflict, run one agent turn with the prompt "resolve the merge conflicts, keep both intents" (Base44 shipped exactly this on 2026-08-11, `competitor-architectures.md:180`). The merge commit is a version with `source: 'merge'`. The branch becomes read-only (`status: merged`).
- Database is shared across branches. Say it in the UI (Base44: "A branch uses your real, live data").

### 6.8 Copy project (fork)

- Insert a new `projects` row; copy `git/{src}/bundles/*` to `git/{dst}/bundles/*` with S3 `CopyObject` (Class A ops, no egress); insert `app_commits` rows for the history (or only the head, and let the new sandbox re-derive); optionally copy chat rows.
- Copy the backend schema, not the data; do not copy secrets, domains, or the GitHub link (Lovable remix rules).

### 6.9 Export to GitHub (one-way, then two-way)

- Phase 3a: a wandit GitHub App with user authorization. Create `POST /user/repos` (private) with the user token, then in the sandbox `git remote add github https://x-access-token:$TOKEN@github.com/$USER/$REPO.git && git push github --all --tags`. Installation tokens last 1 hour; mint per push.
- Phase 3b: two-way on one branch. App webhook `push` → server → sandbox `git fetch github && git merge --ff-only github/main`. If the wandit push is rejected (protected branch), push to `wandit-sync` and tell the user (Lovable rule). If the synced branch is deleted, fall back to `wandit-fallback`.
- If Option C (Gitea) is adopted later, Gitea push mirrors replace 3a with a checkbox.

### 6.10 Publish

Publishing a version = build the tagged commit and upload the output to R2 under the V1-style `published/{projectId}/...` keys, promote a `deployments` row that now stores `commit_id`. The edge Worker path stays (`inspect-publish-serve.md:9`). For Workers-based apps, the build output is a Worker script version; the `deployments` row gets a `target` kind (already proposed in `inspect-data-model.md:356`).

### 6.11 Storage cost estimates

Assumptions (ESTIMATE, to be measured in the alpha): source-only repo, no `node_modules`, no media; initial pack 0.5–2 MB for a Vite + Expo starter; 5–50 KB packed delta per message; 200 messages per project; full bundle every 50 commits (+20 % overhead); 1 MB cap on stored patches (average 20 KB).

| Scale | Git data in R2 | R2 storage / month | Ops / month (3 PUTs per message, 1 M messages) | Total / month |
| --- | --- | --- | --- | --- |
| 1,000 projects × 10 MB | 10 GB | `$0` (free tier 10 GB) | `$13.50` Class A | ≈ `$14` |
| 10,000 projects × 10 MB | 100 GB | `$1.50` | `$13.50` | ≈ `$15` |
| 100,000 projects × 10 MB | 1 TB | `$15` | `$13.50` | ≈ `$29` |

Same scales on the alternatives:

| Alternative | 10,000 projects | Notes |
| --- | --- | --- |
| Gitea on Railway volume | `$15` volume + ≈ `$20` compute = ≈ `$35/month` | 1 TB cap on Pro ≈ 100,000 projects |
| GitHub org | `$0` storage | 100,000-repo hard cap; 500 repo creations / hour; privacy |
| Vercel snapshot as the only persistence (1 per project, 2 GB) | `$1,600/month` | This is the sandbox warm-cache cost, not versioning; expire idle snapshots after 7 days and rebuild from R2 to cut it |
| Per-message Vercel snapshots | `$320,000/month` | Not viable |

Restore latency (ESTIMATE): bundle download < 1 s; `git clone` + `fetch` 1–3 s; `pnpm install` from a warm store 10–40 s; dev server start 5–15 s. The install dominates, so keep one warm snapshot per active project and use git only for the tree.

### 6.12 Security and privacy

- Presigned R2 URLs per object, short TTL, scoped to `git/{projectId}/`. The sandbox never holds R2 account keys.
- `.gitignore` template: `.env*`, `node_modules`, `.expo`, `dist`, `*.log`, media directories. A pre-commit size guard rejects files over 10 MB (Lovable's own limit) and moves them to R2 uploads.
- Secret scanning before bundle upload (gitleaks or a regex set) — tool choice **UNVERIFIED**, decide at implementation.
- The user can delete a project: delete the R2 prefix, the rows, the sandbox and its snapshots. Nothing lives in a third party unless the user exported to GitHub.

### 6.13 Rollout phases

1. **Alpha**: git in sandbox, commit per message, tags, R2 bundles, `app_commits`, Versions list, Restore, adjacent diff.
2. **Beta**: branch per chat, parallel preview sandboxes, merge with AI conflict resolution, Copy project, compare any two versions, preview an old version.
3. **GA**: Export to GitHub (one-way), then two-way sync.
4. **Optional**: Gitea/Forgejo as the internal remote when collaboration, PR-style review, or external `git push` into wandit is needed. The bundle format makes the migration a `git clone` + `git push` per project.

---

## 7. Risks

1. **Bundle chain integrity.** A missing or corrupt incremental bundle blocks rebuild. Mitigation: `git bundle verify` before recording the row; full bundle every 50 commits; nightly job that rebuilds one random project from R2 and reports failures.
2. **Git binary in the sandbox image.** Not confirmed for `vercel/sandbox/universal`. Mitigation: custom image with `git` pinned (also faster boots).
3. **Commit timing vs a still-running turn.** Commit only on `finish`; on abort, still commit (`source: 'agent'`, summary "Interrupted") so no work is lost.
4. **Lockfile churn.** `pnpm-lock.yaml` changes on every dependency edit and can be 300 KB+; git delta-compresses it well, but the stored patch cap (1 MB) may truncate; show numstat and "large change" in the UI.
5. **Branch state drift.** If the model runs a forbidden git command, the server's idea of HEAD and the sandbox disagree. Mitigation: deny rules plus a check of `git rev-parse HEAD` against `app_branches.head` before each turn; reconcile by recording the unknown commits.
6. **Two-way GitHub sync conflicts.** Known pain at Lovable and Base44. Ship one-way first.
7. **Sandbox provider lock-in.** The design uses only `runCommand`, `readFile`, `writeFiles`, and a public egress to R2; it does not need provider snapshots to be correct. Any provider in `docs/v2/research/sandboxes.md` works.
8. **Restore does not restore data.** Users will expect it (Replit has DB time travel). State it clearly; consider per-version database backups later for the managed backend.
9. **Region and egress.** Sandbox egress is `$0.15/GB` on Vercel; a 10 MB bundle per message at 1 M messages is 10 TB = `$1,500/month`. Incremental bundles are tens of KB, so this stays under `$10/month`, but never upload full bundles per message.

---

## 8. Unverified items

- Lovable's internal version storage (git-backed or not); no engineering post found.
- Bolt backup retention count or duration.
- Whether `vercel/sandbox/universal` and `vercel/sandbox/node` images include `git`.
- AWS S3 Standard prices (pricing tables did not render).
- GitLab tier prices (HTTP 403).
- GitHub App user access token and refresh token lifetimes (page fetched lacked the numbers).
- `git-remote-s3` compatibility with Cloudflare R2 (not tested).
- `isomorphic-git` performance on large packfiles; whether it can index a bundle's packfile after stripping the header.
- E2B snapshot storage price; Daytona snapshot price separate from disk.
- Repo size and per-message delta numbers (all ESTIMATE; measure in the alpha).
- Exact Claude Code permission-rule syntax for `Bash(git push:*)`-style denies.

---

## 9. Sources

Repo (worktree `.claude/worktrees/v2-builder`):
- `packages/db/src/schema/artifacts.ts`, `deployments.ts`, `projects.ts`, `chats.ts`
- `apps/server/src/infrastructure/storage/r2.ts`
- `apps/server/src/modules/pages/application/services/page-edits.service.ts`
- `apps/server/src/modules/pages/infrastructure/persistence/pages.repository.ts`
- `apps/server/src/modules/pages/presentation/http/controllers/pages.controller.ts`
- `apps/server/src/modules/sites/application/services/sites.service.ts`
- `apps/web/src/features/workspace/components/page/version-switcher.tsx`
- `docs/v2/research/inspect-data-model.md`, `inspect-publish-serve.md`, `inspect-infra-ops.md`, `sandboxes.md`, `ai-sdk-harness.md`, `competitor-architectures.md`

Web (all fetched 2026-09-03):
- https://docs.lovable.dev/features/projects/history.md
- https://docs.lovable.dev/integrations/git-sync-overview.md
- https://docs.lovable.dev/integrations/github.md
- https://docs.lovable.dev/integrations/gitlab.md
- https://docs.lovable.dev/integrations/github-api.md
- https://docs.lovable.dev/features/projects/remix.md
- https://docs.lovable.dev/changelog.md
- https://support.bolt.new/building/using-bolt/rollback-backup.md
- https://support.bolt.new/integrations/git.md
- https://support.bolt.new/integrations/github-org.md
- https://support.bolt.new/concepts/version-history-github.md
- https://v0.app/docs/github
- https://docs.base44.com/developers/app-code/local-development/github.md
- https://docs.base44.com/Building-your-app/working-with-branches.md
- https://emergent.sh/blog/real-environments-for-ai-agents-and-why-we-bet-on-kubernetes
- https://code.claude.com/docs/en/checkpointing
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/agent-sdk/sessions
- https://code.claude.com/docs/en/agent-sdk/file-checkpointing
- https://ai-sdk.dev/docs/agents/overview
- https://ai-sdk.dev/docs/ai-sdk-harnesses/overview
- https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent
- https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- https://vercel.com/docs/sandbox
- https://vercel.com/docs/sandbox/concepts/snapshots
- https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
- https://vercel.com/docs/sandbox/concepts/drives
- https://vercel.com/docs/sandbox/concepts/images
- https://vercel.com/docs/sandbox/sdk-reference
- https://vercel.com/docs/sandbox/pricing
- https://vercel.com/changelog/vercel-sandbox-now-calculates-snapshot-storage-costs-daily
- https://docs.e2b.dev/sandbox/persistence
- https://docs.e2b.dev/sandbox/snapshots
- https://e2b.dev/pricing
- https://www.daytona.io/docs/en/snapshots/
- https://www.daytona.io/pricing
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/platform/limits/
- https://docs.railway.com/reference/pricing/plans
- https://aws.amazon.com/s3/pricing/ (numbers not rendered)
- https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user
- https://docs.github.com/en/rest/repos/repos
- https://docs.github.com/en/rest/git/refs
- https://github.com/pricing
- https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
- https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- https://docs.gitea.com/
- https://docs.gitea.com/installation/install-with-docker
- https://docs.gitea.com/development/api-usage
- https://docs.gitea.com/administration/config-cheat-sheet
- https://docs.gitea.com/usage/repo-mirror
- https://forgejo.org/docs/latest/user/api-usage/
- https://docs.gitlab.com/install/requirements/
- https://about.gitlab.com/pricing/ (HTTP 403)
- https://git-scm.com/docs/git-bundle
- https://git-scm.com/docs/git-worktree
- https://github.com/awslabs/git-remote-s3
- https://github.com/isomorphic-git/isomorphic-git
- https://registry.npmjs.org/isomorphic-git/latest
- https://registry.npmjs.org/simple-git/latest
- https://registry.npmjs.org/@vercel/sandbox/latest
- https://github.com/nodegit/nodegit
- https://github.com/libgit2/libgit2/releases
