# Sandbox security (V2)

The egress, env, and tool-call boundaries of the V2 app-builder sandbox,
as built in WANDIT-180. Each control names the file, function, or
constant to open.

## 1. Scope

Covers the network egress policy, the `request_network_host` host tool,
the sandbox env allow list, the template deny rules, and the PreToolUse
hook.

It also covers the mobile build worker (section 12) and desktop apps
(section 14).

Does not cover:

- Rate limits, audit events, and the secret scanner: WANDIT-181.
- Connector hosts such as Resend tenant domains: WANDIT-189.
- User secrets in `project_secrets`: WANDIT-185.

## 2. Egress layers

`buildNetworkPolicy` in `infrastructure/sandbox/network-policy.ts`
merges three allow layers into one sorted, deduped list:

1. `GLOBAL_ALLOWED_HOSTS` holds seven hosts for every sandbox:
   `registry.npmjs.org` for `pnpm install`; `fonts.googleapis.com` and
   `fonts.gstatic.com` for the template fonts; `api.stripe.com`,
   `api.resend.com`, `maps.googleapis.com`, and `api.openai.com` for the
   connectors. The list has no `*.supabase.co` (WANDIT-283). That
   wildcard also reaches a Supabase project of an attacker. Bad code can
   send the project source or the proxy token to that project.
2. Connector hosts. Empty today; WANDIT-189 feeds the list.
3. Per-project hosts, from the `projects.networkAllowedHosts` column.
   The `request_network_host` host tool appends one host per approval.
   The runtime reads the column and passes it to `buildNetworkPolicy`.
   The tool denies every `supabase.co` and `supabase.com` host, and
   `buildNetworkPolicy` rejects a stored one (`isSupabaseHost`), except the
   backend host.

`VercelSandboxProvider.start` adds four more hosts before the vendor
call:

- The LLM proxy host, parsed from `ANTHROPIC_BASE_URL`. A missing or
  invalid URL throws in strict mode before the vendor call.
- The git host `<org>.code.storage`, from `CODE_STORAGE_ORG`.
- The asset host, the hostname of `R2_PUBLIC_BASE_URL`.
- The backend host `<ref>.supabase.co`, the hostname of
  `SandboxCreateOptions.backendUrl`. The builder-turn runtime passes that
  value only while the `app_backends` row is `active`. `start` rebuilds the
  policy on each turn and pushes it when its hash changes. So a backend
  that becomes active gets its host on the next turn, with no restart. A
  backend that becomes active during a turn with a fresh harness session
  gets its host within 60 s: the keep-alive tick of the turn calls
  `allowHost` through the session, which keeps the proxy run-token rule.
  The provisioning task never pushes the policy, because a push from that
  process deletes this rule. In strict mode, an invalid or wildcard
  backend host throws. A `backendUrl` that is not a URL gives no backend
  host.

Two leak paths stay open (WANDIT-283):

- The vendor matches the SNI only. Sandbox code can send the SNI of its
  own Supabase host with the `Host` header of another project. The shared
  Supabase edge can then route it there (domain fronting). The upgrade is
  a Host-pin request transform through the harness session.
  `createSession` in `claude-code.harness.ts` clears the provider
  transforms today. Whether the Supabase edge routes by `Host` is
  UNVERIFIED.
- `registry.npmjs.org`, `api.resend.com`, `api.stripe.com`, and
  `api.openai.com` also accept a key that the attacker brings. A
  per-project list is WANDIT-189 and later work.

`SANDBOX_DENIED_RANGES` holds six IPv4 CIDRs that stay denied in every
mode:

| CIDR | Why it stays denied |
| --- | --- |
| `169.254.0.0/16` | Link-local; the cloud metadata endpoints live here. |
| `10.0.0.0/8` | Private network range. |
| `172.16.0.0/12` | Private network range. |
| `192.168.0.0/16` | Private network range. |
| `100.64.0.0/10` | Carrier-grade NAT; vendors run internal services on it. |
| `127.0.0.0/8` | Loopback; vendor-internal services can listen there. |

Vendor facts the design relies on (`toVendorNetworkPolicy`):

- An object policy denies every host by default; `allow` opens it.
- `subnets.deny` wins over `allow`, so `open` mode keeps the deny ranges.
- Host rules match the negotiated TLS hostname (SNI), not the IP.
- `updateNetworkPolicy` changes the policy on a live sandbox, no restart.
- The provider never emits `subnets.allow`: it would leave DNS open.
- The vendor API accepts IPv4 CIDRs only; IPv6 ranges are a `LIMIT`.
- `metadata.google.internal` is a hostname, not an IP; the allow list
  denies it.

## 3. The mode switch

`V2_SANDBOX_EGRESS_MODE` picks the mode; `packages/env/src/server.ts`
defaults it to `strict`.

- `strict`: the merged allow list applies; every other host is denied.
- `open`: `allowedHosts` is `["*"]`; the deny ranges still apply. It is
  the fallback when the allow list breaks a turn.

To flip: set the env value and restart the API. The next sandbox start
applies it. A live sandbox gets it on the next `getOrCreate` or
`resume`, because `start` calls `updateNetworkPolicy` on every reuse.
On a resume the update runs before the dev command starts, so the
command never runs under the stored policy.

Every start logs `sandbox.network-policy.applied`:

- `projectId`, `sandboxId`: the project and the vendor sandbox name.
- `mode`: `strict`, `open`, or `override` when the caller passed
  `options.networkPolicy`.
- `allowedHosts`: the allow-list count, as a string.
- `rejected`: caller hosts that failed validation, comma-joined.

The level is `warn` only when the mode is `open` with no override;
every other case logs `info`.

## 4. How the harness proxy host joins the list

The builder-turn task sets `ANTHROPIC_BASE_URL` to the LLM proxy's
public URL from `V2_LLM_PROXY_PUBLIC_URL`. Local dev sets a tunnel URL,
because the sandbox runs in the vendor cloud. `buildNetworkPolicy`
parses the hostname on every start and adds it, so a new tunnel host
reaches the policy on the next start.

The harness adapter adds no hosts. It manages request transformations
on the sandbox session: the run-token header for the proxy host.
`createSession` calls `setRequestTransformations([])` first. An earlier
session leaves transformations the SDK cannot attribute; clearing them
re-applies the network policy unchanged.

`SandboxHandle.setNetworkPolicy` replaces the whole vendor policy. The
integration spec calls it before a harness session runs.

## 5. The request_network_host host tool

The agent asks to reach one extra host through `request_network_host`
(`application/host-tools/request-network-host.host-tool.ts`). The
registry marks it `user-approval`, so the user approves the call first.
A denied call never runs the tool body and changes nothing.

On approval the tool does four steps:

1. It normalizes `host` to lower case and checks it with
   `isValidNetworkHost`. An IP address or a private label returns
   `denied`. A hostname that resolves into a denied range still fails at
   the firewall, because the deny ranges outrank the allow list. A
   `supabase.co` or `supabase.com` host also returns `denied` (WANDIT-283,
   section 2).
2. It appends the host to `projects.networkAllowedHosts` with a deduping
   write, so a repeated grant is a no-op and the next sandbox keeps it.
3. It writes an `audit_events` row with the action `network.host_allowed`
   (the action name comes from WANDIT-181).
4. It calls `SandboxHandle.allowHost`, which merges the host into the
   live allow list and applies it, no restart.

Steps 2 to 4 run in one Postgres transaction. The live allow has no undo,
so it runs last. When any step fails, both rows roll back and the agent
gets `denied`, so the next sandbox does not allow the host. If the commit
fails after `allowHost`, the host stays live in the current sandbox until it
stops, with no stored host and no audit row (`LIMIT` in
`request-network-host.host-tool.ts`).

`allowHost` routes through the live harness session, not the raw vendor
call. The session holds the run-token transformation for the proxy host.
So the merge keeps that transformation, and the running turn's proxy
calls still carry the token.

## 6. Template deny rules

`templates/web-app/.claude/settings.json` holds the `permissions.deny`
list. `templates/mobile-app` has a byte-identical copy. Grouped:

- Config paths: `.claude/**`, `.mcp.json`, `opencode.json`,
  `.git/hooks/**`, `.git/config`.
- Agent rules files (WANDIT-280): `CLAUDE.md`, `CLAUDE.local.md`,
  `AGENTS.md`, `template_version`, `native-modules.json`. A changed
  `CLAUDE.md` is committed and steers every later turn.
- Env files: `.env`, `.env.*`.
- Shell rc files: `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`,
  `.zshenv`, `.profile`, each in the project and under `~/`.
- Install config: `.npmrc`, `.pnpmfile.cjs`, `.pnpmfile.mjs`,
  `pnpm-workspace.yaml`, `pnpm approve-builds*`. pnpm 11 keeps its
  `allowBuilds` list in `pnpm-workspace.yaml` and loads `.pnpmfile.mjs`
  by default. So the agent cannot approve the build script of a package.
  pnpm then stops with `ERR_PNPM_IGNORED_BUILDS`, and the agent removes
  that package.
- Git commands: `git push*`, `git reset*`, `git checkout*`,
  `git restore*`, `git stash*`, `git clean*`, `git switch*`,
  `git rebase*`, `git tag*`, `git config*`.
  Limit: a project gets a new `settings.json` only on a create, a resume,
  or a finished boot. A Version Restore to an old version brings back the
  old deny list until the next of these starts.
- Root and network tools: `sudo *`, `ssh *`, `nc *`, `ncat *`,
  `docker *`.

Claude Code facts the design relies on:

- Deny rules apply even in bypass mode. The harness runs
  `permissionMode: "allow-all"` and the rules still hold.
- Claude Code never consults `Write(...)` rules. Only the hook reads
  them, as one set with the `Edit` rules.
- A `Bash(x *)` rule also matches the bare `x` command.

## 7. The PreToolUse hook

`templates/web-app/.claude/hooks/pre-tool-use.mjs` runs before every
tool call and reads the deny list from `settings.json` itself. Exit 2
blocks the call and writes `denied by wandit rules: <reason>` on
stderr. Empty stdin exits 0. Malformed stdin exits 0 with a warning.
A stdin read error exits 2. A missing `settings.json` or a hook bug
exits 2: the hook fails closed. The spec
is `infrastructure/template/pre-tool-use-hook.spec.ts`; its `allowed
commands` describe holds the positive cases.

### Rule 1: download and run

Denies `curl` or `wget` piped to an interpreter (`sh`, `bash`, `zsh`,
`dash`, `ksh`, `node`, `perl`, `ruby`, `python*`, `source`, `.`). It
also denies a
downloader as the first word of a `$( )`, backtick, or `<( )`
substitution segment; wrappers and assignments before it are stripped.
The pipe check covers `sudo`, wrappers, `tee`, `|&`, path prefixes,
and quotes. A plain download stays allowed. Spec:
`rule 1: download and run`.

### Rule 2: git config

Denies the `config` subcommand after the git option flags are skipped,
plus the run flags `git -c`, `--config`, and `--config-env`. `git
status`, `git commit -m "fix config"`, and `git add vite.config.ts`
stay allowed. Spec: `rule 2: git config`.

### Rule 3: restricted first words

Denies a first word in `DENIED_FIRST_WORDS`: `sudo`, `su`, `doas`,
`nc`, `ncat`, `netcat`, `socat`, `telnet`, `ssh`, `scp`, `sftp`,
`docker`, `podman`. The parser skips keywords, assignments,
Object.prototype names, and wrappers (`env`, `timeout`, `xargs`,
`npx`, and more) with their flags first, so `constructor sudo ls`
meets the check on `sudo`. A first word that holds `$` or a backtick
denies: the command word cannot resolve. An `env` call with `-S` or
`--split-string` denies: env splits the string into a command. `env
-C` and `env --chdir` mark the directory state broken, so relative
write targets deny. The
script of `sh -c`, `bash -c`, `zsh -c`, `dash -c`, `ksh -c`, or
`eval` is checked up to three levels deep with a copy of the
directory state.
Spec: `rule 3: denied first words`.

### Rule 4: writes to denied or outside paths

Three checks share `checkTarget`. Quotes and backslash escapes in a
raw target are removed first. A deny pattern hits at any depth inside
the project (`src/.env` matches `.env`); outside the project the
absolute path is tested. The target must match no deny pattern, and
it must resolve inside the project or `/tmp`. An unresolvable target
(a variable, a glob, `~name`, a broken `cd`) denies.

- Redirects: `>`, `>>`, `>|`, `N>`, `&>`, `&>>` write a file. `>&1`
  and `>&-` only copy descriptors and are skipped. Spec:
  `rule 4a: output redirects`.
- `cd` and `pushd` move the base for relative targets; `popd`, `cd -`,
  variable targets, and a `cd` inside `( )` mark it broken. Spec:
  `rule 4: directory changes`.
- Writing commands: `tee`; `cp`, `mv`, `install`, `ln`, `rsync` (only
  the destination must stay inside); `sed -i`; `dd of=`; `truncate`,
  `touch`, `mkdir`, `chmod`, `chown`, `chattr`, `rm`, `rmdir`, `shred`;
  `git rm`, `git mv`. `xargs` in front of a write command denies
  outright, because the targets arrive on stdin. A mutating `find`
  (`-delete`, or `-exec`/`-execdir` of a writing command) denies
  unless every root resolves under `/tmp`. `find -fprint`, `-fprint0`,
  `-fprintf`, and `-fls` check their file argument. The output paths
  of `curl` (`-o`, `--output`) and `wget` (`-O`, `-P`,
  `--output-document`, `--directory-prefix`) get the same checks.
  The command after `-exec`, `-execdir`, `-ok`, or `-okdir`
  runs to `;` or `+` and gets the same first-word checks as a
  segment. Spec: `rule 4b: writing commands`.

### Rule 5: install scripts

- Denies the flags that re-enable dependency build scripts, matched
  case-insensitively: `dangerouslyAllowAllBuilds`,
  `dangerously-allow-all-builds`,
  `npm_config_dangerously_allow_all_builds`, `--ignore-scripts=false`.
  It also denies the text `allow-build`, `allowbuild`, `allow_build`,
  and `pnpmfile`. These cover `pnpm add x --allow-build=x`,
  `--config.allowBuilds.x=true`, `pnpm_config_allow_builds=...`, and
  `--config.pnpmfile=...`. A read such as `cat .pnpmfile.cjs` denies too.
- Denies the package-manager subcommands that run scripts:
  `pnpm approve-builds`, `pnpm rebuild`, `pnpm rb`; `npm install` and
  its aliases, `npm ci`, `npm rebuild`, `npm add`; `yarn` (bare),
  `yarn install`, `yarn add`; `bun install`, `bun add`, `bun i`; the
  same nested under `exec`, `dlx`, `x`, `npx`, or `corepack`. A
  `config set`, `config delete`, or `config edit` under `pnpm`,
  `npm`, or `yarn` denies: it writes `.npmrc`.

`pnpm install`, `pnpm add`, `npm run`, and `npm test` stay allowed.
Spec: `rule 5: install scripts`.

### The file-tool boundary

`Edit`, `MultiEdit`, `Write`, and `NotebookEdit` share the deny
patterns plus the workspace bound. The file must sit inside the project
or `/tmp`, after `~` and `$HOME` expand. Spec: `file tools outside the
workspace`.

### What the hook does not parse

The `LIMIT` list from the hook comment: heredoc body lines are checked
as commands, so a body line that starts with `sudo` is denied;
`$( )` nested deeper than one level; `sh -c` and `eval` strings
nested deeper than three levels; interpreter
one-liners (`node -e`, `python -c`, `npx -c`) that write through an
API; `git apply` and `patch`; `tar -x` and `unzip` targets; symlinks;
`GIT_CONFIG_*` env vars; package-run shortcuts (`npx <pkg>`,
`pnpm dlx`, `bunx`); the `/private/tmp` symlink on macOS; a script file or a
`package.json` script run through `sh`, `node`, or `pnpm run`;
launchers not in `WRAPPERS` (`setsid`, `flock`); Debian binary names
(`nc.openbsd`); `perl -i` and `awk` file writes. Upgrade: a shell
parser package in the image.

## 8. Telemetry

`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` appears in
`buildSandboxEnv` (`sandbox-env.ts`) and in `buildAgent`
(`claude-code.harness.ts`). Deny-by-default egress makes the Claude
Code telemetry and update calls fail and log noise, so the CLI must
not make them. `buildSandboxEnv` writes the flag last, so `extra`
cannot re-enable them.

## 9. No platform secret in the VM

`SANDBOX_ENV_ALLOW_LIST` (`sandbox-env.ts`) holds the six env names
a sandbox process may receive: `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_CUSTOM_HEADERS`,
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `WANDIT_PREVIEW_HOST`.
The public Supabase URL and anon key go to the `.env` file of the
workspace (`syncBackendEnvFile`), not to the process env: the web-app
template reads `VITE_*`, the mobile-app template reads `EXPO_PUBLIC_*`.
Every other name — a
Vercel token, a real Anthropic key, a service-role key, a signing
key — is a platform secret and stays out. `buildSandboxEnv` throws
`SandboxEnvRejectedError` on a non-listed `extra` name and writes
`ANTHROPIC_API_KEY` empty: the real key lives on the LLM proxy.

The integration spec greps `$HOME` and the workspace for `sk-ant-`,
the first 12 chars of `VERCEL_SANDBOX_TOKEN`, the first 12 chars of
the first `LLM_PROXY_SIGNING_KEY`, and the first 24 chars of the
`CODE_STORAGE_PRIVATE_KEY` body. The needles travel through the exec
env only, never in the command string or a log. A `command -v grep`
precondition stops a vacuous pass; an unset source gets an
`unset-needle-<name>` sentinel.

## 10. Non-root

`VERCEL_SANDBOX_IMAGE` is unset, so `start` boots `DEFAULT_IMAGE`, the
vendor's `vercel/sandbox/node:22`. The round-1 integration run measured
the sandbox user as `ubuntu` — not root.

`tooling/sandbox-image/` holds the custom image (Node 22, pnpm, git,
Claude Code, Playwright Chromium) built with `USER builder`; nothing
selects it yet. Whether the vendor honors `USER` for `runCommand` is
UNVERIFIED.

## 11. The integration spec

`sandbox-hardening.integration.spec.ts` runs only with
`V2_SANDBOX_INTEGRATION_TEST=true`; CI never sets the flag. One run
creates a real sandbox on Vercel (cost: cents) and destroys it in
`finally`; the case timeout is 10 minutes.

```sh
cd apps/server
V2_SANDBOX_INTEGRATION_TEST=true npx vitest run \
  src/modules/app-builder/infrastructure/sandbox/sandbox-hardening.integration.spec.ts
```

The single case asserts: `example.com` denied, `registry.npmjs.org`
allowed, `169.254.169.254` denied, `example.com` allowed after a live
`setNetworkPolicy`, only allow-listed env names, no secret on disk,
and a non-root user. Probes use `node -e` with `fetch`, `process.env`,
and `os.userInfo()` because the image has no `curl`, `printenv`, or
`whoami`.

Measured on the final run (2026-09-15): sandbox user `ubuntu`, create
took 24194 ms, the live policy update took 1335 ms, and the case
passed.

## 12. Mobile builds on the Trigger worker (WANDIT-194)

The `mobile-build` task runs `eas build` on the Trigger.dev worker, never in
a sandbox: `EXPO_TOKEN` must not enter a VM. The worker holds
`DATABASE_URL` and every other platform secret in its process env, and a
child process can read `/proc/<parent pid>/environ`. So no code of the user
app runs on the worker:

- `eas` runs the local `node_modules/expo/bin/cli config` and loads every
  config plugin of app.json. That `node_modules` comes from the trusted
  template files (`templates/mobile-app/package.json` and its lockfile),
  installed with `--ignore-scripts` in a separate folder. The user lockfile
  never installs on the worker; EAS installs it on its own build machines.
- A config plugin must be a template dependency or a module of
  `native-modules.json` (`checkConfigPlugins` in
  `app-builder/domain/mobile-build.ts`). A local plugin file is refused.
- A top-level `app.config` or `app.config.*` file or folder is refused: the
  expo CLI reads it before app.json. A symbolic link anywhere in the commit
  is refused, so no tool reads a worker file such as `/proc/<pid>/environ`
  through it. A `package.json` with an `exports` field is refused: Node
  would then resolve `expo/bin/cli` to the files of the app.
- `eas` runs with `EAS_SKIP_AUTO_FINGERPRINT=1`, so it never loads the user
  `fingerprint.config.js`, and `eas init` runs with `--no-icon`, so no user
  file leaves the worker as the dashboard icon. The workspace stops when the
  trusted install shows `metro-config` at the top of `node_modules`,
  because eas would then load the user `metro.config.js`.
- wandit writes the EAS identity into app.json: the slug `p` plus the
  project id without dashes, the owner `EXPO_ACCOUNT`, and the package
  `app.wandit.<slug>`. A
  user value can never link the EAS project, and so the keystore, of
  another app.
- `eas.json` is the trusted template copy, and `.easignore` is a fixed file.
  The task removes each path before it writes it, so a user symlink is
  never followed.
- Each child process gets an explicit env. Only the `eas` process gets
  `EXPO_TOKEN`. The code.storage credential is read-only (`git:read`) and
  never enters `.git/config`.

`view` and `cancel` call the EAS GraphQL API with the token, so the API can
cancel a build without the eas CLI. The GraphQL API is the one eas-cli
uses; Expo does not document it as a public contract (UNVERIFIED).

## 13. Open items

- The Host-pin transform for the backend host, and the per-project list
  for the multi-tenant connector hosts (section 2, WANDIT-189).
- Connector hosts into `buildNetworkPolicy`: WANDIT-189.
- The custom image and `VERCEL_SANDBOX_IMAGE`: `tooling/sandbox-image/`
  is built; whether the vendor honors `USER builder` is UNVERIFIED.
- IPv6 deny ranges: the vendor API accepts IPv4 only today (`LIMIT` in
  `network-policy.ts`).
- The `Write(...)` deny rules: Claude Code never reads them; the hook
  does. Whether to drop the duplicates is a later cleanup.
- The hook `LIMIT` list (section 7): the upgrade is a shell parser in
  the image.
- The live `allowHost` merge has no integration test: it needs a real
  harness session. Staging proves it (Verification step 3).

## 14. Desktop apps

The contract is `docs/v2/desktop-apps.md`, and its section 1 gives the
trust of each part. Decisions: D30 to D36 in `DECISIONS.md`. This section
gives each threat and its controls. A security audit found 16 holes in
this feature. A bullet that starts with "Audit fix:" gives the fix of one
hole.

### Untrusted frontend and SQL

The agent writes the frontend and the migration files, so a prompt
injection or a bad user can write them too. The frontend runs in the
webview of every installed app. The SQL runs at each start of the app.

- The project holds only the frontend and `migrations/`. The build ignores
  a `src-tauri/` folder of the project. CI compiles the trusted copy of
  `templates/desktop-shell` from the worker image.
- `capabilities/main.json` grants 4 commands: `db_select`, `db_execute`,
  `db_batch`, and `app_info`. It grants no plugin permission. The webview
  gets no file system, no shell, no process, and no file path.
- An SQLite authorizer refuses ATTACH, DETACH, PRAGMA, every CREATE, DROP,
  and ALTER, transactions, and a write to `wandit_migrations` or a
  `sqlite_` table. `db_select` accepts a read-only statement only.
- The connection sets `SQLITE_DBCONFIG_DEFENSIVE=1`, `trusted_schema=OFF`,
  and `SQLITE_LIMIT_ATTACHED=0`. Extension load stays off.
- Each command has limits: 100,000 bytes of SQL, 999 parameters, one
  statement, 500 statements per batch, and 10,000 rows per select.
- Audit fix: each webview command had no time limit. A query that never
  ends held the database lock, and the update install then waited for
  good. Now each command has a time limit of 10 s, and a whole batch
  counts as one command. SQLite checks it only between two VM steps. So
  it stops a loop, for example a recursive CTE over a cycle.
- Audit fix: SQLite cannot stop one long function call, for example LIKE,
  `instr`, or `replace` on a long text. So the update backup copies
  through its own read-only connection and does not wait for the database
  lock. A waiting command holds no thread, and each command runs on a
  blocking thread. So a stuck command never blocks the async workers of
  the update check and download (`desktop-apps.md` sections 4 and 10).
- Residual risk: a stuck command still delays the later commands. It also
  delays Back up now, Export, and Import, which wait for the lock. An
  update then waits only when the copy through its own connection also
  fails, for example on a full disk.
- The gate (D33) checks every migration file in the `add_local_migration`
  host tool, and again in the `desktop-build` task with the frozen rows.
  The MCP `apply_changes` tool refuses a path under `migrations/` of a
  desktop project. A GitHub Update can write `migrations/`, so the build
  gate is the check that protects installed apps.
  Its dry run uses sql.js in memory, with no file access. New INSERT,
  UPDATE, and check statements execute on at most 15 test rows per table.
  The gate refuses WITH, so no recursive query runs.
- Audit fix: the earlier text said that a heap limit of 64 MiB stops a
  query that grows without end. That was false: sql.js keeps the database
  file and the temp files in JavaScript memory, outside the heap limit. A
  probe used 4 to 6 GB of worker memory. Now each dry-run database also
  sets `temp_store = MEMORY`, so sorts and temp tables count in the heap
  limit. It also has a file limit of 32 MiB (`max_page_count`). The same
  probes now fail in less than 1 s with "out of memory" or "database or
  disk is full".
- Audit fix: the dry run had no time limit. A slow check blocked the
  event loop of the task until its `maxDuration`. Now the three runs share
  one deadline of 30 s. The `node:vm` watchdog stops sql.js, also inside
  WebAssembly. A timeout gives a `migration_dry_run_failed` finding, and
  the gate loads a new copy of the sql.js package.
- Residual risk: after a timeout, the static import keeps the first
  sql.js module in memory. That is about 160 MB at most per process. Each
  later timeout frees the module before it. One tool call can run the gate
  two times. So it can block the event loop of the turn for 60 s at most.
  Upgrade: a worker thread (`desktop-apps.md` section 12).
- Audit fix: the trigger rule compared `total_changes()` with `changes()`
  on the test rows. A trigger with a WHEN clause that the test rows do not
  meet passed. On installed apps, it could then delete or rewrite saved
  rows. Now the gate refuses, before it runs, an INSERT or an UPDATE whose
  `EXPLAIN` has a `Program` opcode. SQLite compiles one for each trigger
  and each foreign key action that the write can fire. It does so also
  with a WHEN clause or empty tables.
- Audit fix: `IS [NOT] DISTINCT FROM` in a SET value stopped the column
  parser of the gate, so an UPDATE of a saved column passed. Now the gate
  refuses such an UPDATE (fail closed).
- Residual risk: a trigger that a migration creates can fire when the app
  writes a row. It stays after a rebuild of older code. App code can
  already update and delete rows, so this gives no new right. The gate
  does not read trigger bodies.
- The task reads `migrations/` and `src/styles/theme.json` at the build
  commit before `pnpm install`, so no install or build script changes them.
  A migration file must be UTF-8. theme.json must be a regular file under
  64 KiB, and the contracts schema parses it.
- The task checks `dist/` with the publish limits (no symlink, 5,000 files,
  100 MB) and runs the secret scanner (`secret_in_frontend`). Each path
  must be printable ASCII and a valid Windows name, with no `..` part and
  no two paths that differ only in case. So no archive entry lands outside
  its folder on the Windows runner.

### CI injection

A dispatch input can try to run as code in the workflow. A user file can
try to run on CI.

- Each input of `build.yml` reaches a script through `env:` only. No
  `${{ }}` expression is in a `run:` script. The first step reads the two
  URLs from the event file to mask them and check them.
- The script refuses these inputs:
  - a `build_id` that is not a uuid
  - an `input_sha256` that is not 64 hex digits
  - a URL that is empty or holds a line break
  - an `input_url` that is not a presigned R2 URL of
    `desktop-temp/<project uuid>/inputs/<build uuid>-<32 hex>.tar.gz`
  - an `output_url` that is not a presigned R2 URL of
    `desktop-temp/<project uuid>/staging/<build uuid>-<32 hex>.exe`
  - a URL outside the buckets of the repo variable
    `DESKTOP_BUILD_BUCKET_URLS`. An empty variable fails the run.
- The SHA-256 of the downloaded archive must equal `input_sha256`. So CI
  builds the archive that the server made, and nothing else.
- Audit fix: the earlier check accepted any `https` URL. The dispatcher
  sends the URL and the hash together, so the hash proved integrity, not
  origin. A stolen dispatch token could then make CI compile its own Rust
  code, and the server signed the result. Now the URL check proves the
  origin. Only the API holds the R2 keys that write a `desktop-temp/`
  object and sign its URL. A stolen dispatch token alone cannot run code
  on CI. The check is a full-string regex, the query cannot hold `/`, `#`,
  or `@`, and each bucket goes through `[regex]::Escape`.
- After the extraction, the workspace must hold only `src-tauri/`,
  `dist/`, and `migrations/`. So no root `.cargo/config.toml` can make
  cargo run a command.
- CI runs no user JavaScript and no user build script. The frontend comes
  built. `build.rs` embeds the SQL as text. Only the trusted shell
  compiles, with `cargo tauri build ... -- --locked`: cargo uses the pinned
  `Cargo.lock`.
- The self-test runs the user SQL on the runner, inside the trusted shell,
  on a new database in a temp folder. The connection has the safety
  settings of `desktop-apps.md` section 5: no extension load and no
  ATTACH. The exe prints one result line, with each CR and LF as a space.
  The step prints it between `::stop-commands::` markers, so no SQL text
  becomes a workflow command. The install step before it checks that
  `mainBinaryName` is lowercase kebab-case and that the exe exists in the
  install folder. So the exe path stays inside that folder.
- Audit fix (supply chain): the installer embeds the WebView2
  bootstrapper, and the pinned tauri-bundler downloaded it with no check.
  Now CI downloads it itself. It requires the Authenticode status `Valid`
  and the signer CN `Microsoft Corporation` before the bundler embeds it.
  NSIS and `nsis_tauri_utils.dll` keep the hard-coded SHA-1 checks of the
  bundler.
- Residual risk: the signer check pins the CN, not the Microsoft root.
  Status `Valid` means a chain to any trusted root of the runner.
- The job has `permissions: {}` and reads no secret. A broken job finds no
  repo or cloud credential. It holds only the two presigned URLs of its own
  build, the cache token of the runner, and the bucket URLs of the repo
  variable, which are not secret.
- Each action is pinned by commit SHA. The repo allows only actions made
  by GitHub. Rust is pinned. tauri-cli is pinned and installed with
  `--locked`.
- The builder repo is private. Forks and fork pull request workflows are
  off. A ruleset protects `main`.
- `DESKTOP_BUILD_GITHUB_TOKEN` is a fine-grained token with "Actions: Read
  and write" on the builder repo only. Only the API and the
  `desktop-build` task read it. It never enters a sandbox or a CI run. It
  cannot change a repo variable.

Setup: `tooling/desktop-builder/README.md`. Step 9 adds
`DESKTOP_BUILD_BUCKET_URLS`.

### Cache poisoning

A run can write a cargo cache with a changed crate or binary, and later
builds then use it.

- `build.yml` and `build-macos.yml` only restore the cache
  (`actions/cache/restore`). Only `warm-cache.yml` saves it. That workflow
  runs on `main` and builds only trusted files of the builder repo.
- Each build workflow restores the exact key only, with no `restore-keys`.
  The key holds the Rust version, the tauri-cli version, and the hash of
  `Cargo.lock`. The macOS key also holds `macos-arm64`, so it never meets
  the Windows cache.
- A cache entry never changes after its first save.
- Residual risk: code that runs in a job can take the cache token of the
  runner and save a new key (UNVERIFIED for the current runner). No user
  code runs in a build job. The URL check of the first step refuses an
  input that the API did not make. The attack works only while the key is
  absent:
  - between a shell change and the green `warm-cache.yml` run
  - after GitHub evicts the key: 7 days with no use, or the 10 GB limit of
    the repo
  - after a holder of `DESKTOP_BUILD_GITHUB_TOKEN` deletes the key. The
    token has "Actions: Read and write", so it can delete a cache entry.
    It cannot save a new entry, and no dispatch with it runs attacker
    code. Until `warm-cache.yml` saves the key again, builds are cold.
- Audit fix: the earlier text named only the first two cases of an absent
  key. A stolen token could delete the key. Then it could run its own code
  in a build job and save a new entry. The URL check of "CI injection"
  closes the second part.
- When a bad entry has the key, `warm-cache.yml` finds the key and skips
  its build (`lookup-only`). So the bad entry stays. To replace a suspect
  entry, delete it in Actions > Caches. Then start `warm-cache.yml` by
  hand.

### Free builds and shared runners

A user can try to get a signed installer for free. A user can also try to
hold the shared CI runners.

- Audit fix: a cancel in `signing` refunded the hold. But the task still
  uploaded the signed installer to a key that the user could predict. Now
  the cancel route stops only a `queued`, `preparing`, or `building` build.
  A `signing` build answers as it is, until a crashed run leaves it there
  for 90 min (`DESKTOP_SIGNING_STUCK_AFTER_MS`).
- Audit fix: the installer key now has a random part of 128 bits
  (`desktop/<project id>/builds/<build id>-<random>/...`). Nobody knows it
  until the `ready` row stores it, so a build that stops before `ready`
  leaks no installer.
- Audit fix: no cap existed across projects. Now a payer has at most 2 live
  builds in all its projects (`MAX_LIVE_DESKTOP_BUILDS_PER_PAYER`). The
  payer is the organization of a team project, else the owner of a personal
  project (`projects.user_id`), also when a member or a collaborator builds.
  The count reads the payer from the project row, because
  `desktop_builds.user_id` holds the actor. The create transaction takes the advisory lock
  `desktop-builds:<credit owner>` before the count, so two parallel creates
  never both pass it. A third build answers 409
  `DESKTOP_BUILD_LIMIT_REACHED`, and the hold comes back.
- Workspaces: every desktop route needs the project role `editor`
  (`@RequireProjectRole`), so a Can view member cannot build, cancel,
  release, or read unreleased download links. The `desktop-build` task reads
  its hold with no payer check. With billing on, a missing hold or a hold of
  another project, actor, or operation fails the build before any CI work.
- Audit fix: ten parallel releases deadlocked the database pool. Each
  release held a connection and then read the project on a second one.
  Now every read of the release runs on its own transaction.
- Residual risk: a cancel or a failure before `signing` still refunds the
  full hold after some CI work. The cap of 2 limits the runners that one
  payer can hold. No global cap exists: the GitHub account runs every build
  in parallel up to its concurrency.

### Key custody

The updater private key signs every update of one app. A leak lets the
holder sign a bad update.

- Each app has its own Ed25519 key pair. The API makes it at the first
  build.
- The private key is encrypted with AES-256-GCM and
  `APP_SECRETS_ENCRYPTION_KEY`. The authenticated data is
  `<project id>:DESKTOP_UPDATER_KEY`, so a ciphertext copied to another row
  does not decrypt.
- Only the API and the `desktop-build` task decrypt it. CI never sees it:
  `bundle.createUpdaterArtifacts` is `false`. The sandbox never sees it.
- The task verifies each signature with the public key before the upload.
- A rotation of `APP_SECRETS_ENCRYPTION_KEY` also re-encrypts the desktop
  keys (`docs/v2/runbook.md`).

### Update hijack and downgrade

A bad manifest (`latest.json` on Windows, `latest-macos.json` on macOS) or
a bad update file can try to reach installed apps. An older build with a
known bug can try to replace a newer one.

- tauri-plugin-updater verifies the minisign signature of the download
  with the public key of the installed app. It does this before NSIS runs
  on Windows, and before it unpacks the archive on macOS. A file without a
  valid signature of that key never installs.
- `requireSignedVersion` is `true`. The version in the signed trusted
  comment must equal the version of the manifest. So a bad manifest cannot
  pair a new version number with an older signed installer. This is a
  security setting: never remove it.
- The endpoint is `https` and is fixed in each installer. Only the API
  writes the two manifests, at a release. Only Wandit services can write to
  the R2 bucket.
- Audit fix: the earlier shell accepted any version that differed from its
  own. A person with write access to `latest.json` could then push any
  older signed build with an old manifest entry. Such access comes from a
  leaked R2 key or a bad CDN host. Now the shell uses the default
  comparator of the plugin: only a newer version installs (D35). With
  `requireSignedVersion`, a higher version cannot come with the url and
  signature of an older build. The release route refuses a build older
  than the current one (`DESKTOP_BUILD_OLDER_THAN_CURRENT`). A rollback is
  a rebuild of the older code with a higher version (`desktop-apps.md`
  section 10).
- `output_url` is a presigned PUT that expires after 2 h. CI masks it in
  the log. Windows: the task accepts only a file that starts with `MZ` and
  is at most 300 MB. macOS: `update_url` has the same expiry and mask. The
  disk image must end with a `koly` trailer, and the archive must start
  with the gzip magic. Each file is at most 300 MB (`STAGED_FILES` in
  `desktop-build.runtime.ts`).
- Residual risk: a person with `output_url` can replace the staged
  installer before the task signs it. The CI log shows the SHA-256 of the
  file that CI uploaded. Compare it with `desktop_builds.installer_sha256`
  (runbook).

### A malicious import file

A user can import a `.db` file from another person. The file can hold a
trigger or a view that runs on the next query, or broken pages.

- All dialogs are Rust calls. The webview never gives a path to Rust.
- The shell opens the file read-only. It checks the SQLite header,
  `PRAGMA integrity_check`, the ledger, and each ledger row against an
  embedded file (version and SHA-256).
- The schema must equal a fresh database migrated to the same version: the
  same `sqlite_schema` rows. So an extra table, trigger, or view stops the
  import.
- Then a confirm dialog, a backup, an atomic file swap, and the migration
  runner. A failed check changes nothing.

### Webview escape

Frontend code can try to leave the app origin: a remote page, a new
window, or a remote script. From there it can try to call the commands.

- The CSP allows scripts from `'self'` only, and connections only to the
  Tauri IPC. It sets `object-src 'none'`, `frame-src 'none'`, and
  `form-action 'none'`.
- Audit fix: the earlier text said that the CSP allows scripts from
  `'self'` only. That was false: Tauri added a nonce to each script tag of
  an HTML file, also to a remote one. So a remote script ran. Now
  `dangerousDisableAssetCspModification` is `["script-src"]`, and Tauri
  adds no nonce and no hash to `script-src`. A remote script tag and an
  inline script never run.
- Audit fix: Tauri sets the CSP only on an `.html` answer. So a worker
  script or an `.svg` page ran with no CSP. Now the shell adds the CSP of
  `tauri.conf.json` to every other answer of the app protocol
  (`on_web_resource_request`). A build with no CSP does not start.
- Audit fix: the earlier text said that the app has no remote connection.
  That was false: WebRTC and DNS prefetch are outside the CSP. Now the
  WebView2 browser args on Windows close these channels (`desktop-apps.md`
  section 3). They set a proxy on loopback port 1 and the WebRTC policy
  `disable_non_proxied_udp`. A resolver rule fails every host name. The
  updater runs in Rust, so the args do not touch it.
- Audit fix: WebView2 downloads were on. So a page could write a file
  with a name of its choice into the Downloads folder. Now the shell
  refuses every download (`on_download`).
- Residual risk: Windows staging must confirm that WebView2 takes the 4
  browser args as the shell gives them (UNVERIFIED, runbook). The File
  System Access API (`showSaveFilePicker`) stays on. It writes a file only
  after the user picks a path in a native dialog.
- `app.withGlobalTauri` is `false`. `app.security.freezePrototype` is
  `true`.
- The navigation lock lets the main window load only the app origin of
  the current system: `http://tauri.localhost` on Windows,
  `tauri://localhost` on macOS (`is_app_origin` in `lib.rs`). It refuses
  every other navigation and every `window.open`.
- The capability names no remote URL, so a remote page gets no command.
- Rust owns the native menu and all dialogs. The frontend cannot change
  them.
- The theme fonts are local files in `dist/wandit-fonts/`, so the CSP
  allows no font host. The task fetches them at build time from the
  Google Fonts or Fontshare css of theme.json, with no redirect. It keeps
  only `@font-face` blocks with allowed descriptors whose values match
  strict patterns. A font file must come over https from
  `fonts.gstatic.com` or `cdn.fontshare.com` and start with the woff2 or
  woff signature. Caps: 40 files, 2 MB each, 8 MB in total, one 60 s
  deadline. The task drops every user file under `dist/wandit-fonts/`.

### Data loss

An update, a bad migration, a crash, or an import can try to destroy the
saved data.

- The gate keeps every table, column, and view of an older build (D33).
- The runner checks the SHA-256 of each ledger row whose file the app
  embeds. It stops when a pending version is below the highest ledger
  version.
- All pending files of one start run in one `BEGIN IMMEDIATE` transaction
  with their ledger rows. On an error, ROLLBACK keeps the data exactly as
  it was before the update.
- The gate runs each new file on hostile test rows and on a new install.
  Every INSERT and UPDATE must use OR IGNORE. A check query must answer the
  integer 1, else the update stops and rolls back.
- The SQLite online backup API copies the database before a migration,
  before an update install, and before an import. The copy before an
  update first uses its own read-only connection, so a stuck webview
  command cannot stop it. In the `migration_failed` state, no connection
  is open. Then the backup before an import is a copy of the closed file
  (`.db` and `-wal`). So is the backup before an update, when its own
  connection fails. No migration runs without a backup. The shell keeps
  the 10 newest automatic backups and never deletes a manual backup.
- The gate refuses CREATE UNIQUE INDEX on a table of an earlier build,
  because saved rows can hold duplicates.
- Residual risk: a migration can pass the dry run and fail on the saved
  rows of an install. The runner rolls back the whole update and keeps the
  data. A rebuild of older code embeds the failed file too. Only a
  replacement file fixes the data statements (`desktop-apps.md` section
  6). Until then, the app stays in `migration_failed`. A frozen DDL
  statement has no fix.
- WAL with `synchronous=NORMAL`: a power cut can lose the last
  transactions, but the file stays valid.
- In the `migration_failed` state, the update check still runs, so a fixed
  build reaches the user.
- An update never deletes data. The NSIS uninstaller keeps the data unless
  the user ticks its delete box.

### Suspend and delete

A suspended or deleted app must stop reaching users.

- A staff suspend clears both current-build pointers, every
  `installer_key`, and every `update_archive_key` of the project
  (`withdrawRelease`). Then it deletes all of `desktop/<project id>/` in
  R2: both manifests, both stable files, and every build file. So no
  update and no download link works. An unsuspend restores nothing.
- Audit fix: the build installers had a 1-year immutable `Cache-Control`
  and no cache purge. So an edge copy stayed downloadable after a
  takedown. Now each installer object, of a build and the stable copy, has
  `Cache-Control: no-cache`. A cache must then ask R2 again before it
  serves a copy. Both manifests have `no-cache` too.
- The suspend waits for a release in progress, so its R2 delete runs after
  the last write of that release. The release reads the project again
  after its writes, on its own transaction. When staff suspended or
  deleted it, the release deletes the writes and rolls back. So the
  current-build pointer of its platform does not change.
- The `ready` write refuses a suspended or deleted project. The task then
  deletes the installer, cancels the row, and releases the hold at once.
  This is also true when staff lift the suspension before the next check.
  A live build of a suspended or deleted project stops at its next check.
- The temporary objects of a build live under `desktop-temp/<project id>/`.
  A suspend does not delete them. The task deletes them when it stops. An
  R2 lifecycle rule deletes each one 1 day after its upload, and the
  project delete drains that prefix.
- The project delete removes the `desktop_apps` row with the encrypted
  updater key, then drains `desktop/<project id>/`. No path restores a
  deleted project, so no route can use that key again.
- Residual risk: when the row delete fails, the task logs
  `app-project.delete.desktop-app-failed` and continues. The encrypted
  updater key then stays until staff delete the row (runbook, "Suspend and
  delete").
- Residual risk: Wandit cannot stop or delete an installed app. It keeps
  its version and its local data.

### macOS builds

A macOS build (D36) uses the controls above, with these changes and risks.
The contract is `desktop-apps.md` sections 3, 9, and 10.

- WebRTC: WKWebView takes no browser args, and the CSP does not stop WebRTC
  UDP. `locked_webview_configuration` (`lib.rs`) sets the private key
  `peerConnectionEnabled` to false before the first page script and reads
  it back. A missing key or a failed read-back keeps the window closed
  (fail closed). The app menu and the update check still run, so a fixed
  build reaches the user. Residual risk: Apple can remove or change the
  key. Repeat the runbook network probe after each macOS major release.
- Loopback proxy: `proxy_url(LOOPBACK_PROXY_URL)`, `http://127.0.0.1:1`,
  from the `macos-proxy` feature of `tauri` (`lib.rs`, `Cargo.toml`). No
  service listens on that port. So an HTTP load that the CSP does not
  govern, for example a preconnect, reaches no host. The proxy does not
  stop WebRTC UDP. It needs macOS 14 or later, and D36 sets 15.
- Update archive: the updater unpacks the `.app.tar.gz` with no path
  guard. CI writes plain ustar with the root `<binary name>.app` and checks
  the seal of an unpacked copy. `repackMacAppArchive` parses with strict
  rules. It takes plain ustar only, with no pax, GNU, or link header. Each
  name is ASCII and matches one pattern. It needs the exact root, only
  `Contents/`, and each parent folder first. It has size and count limits.
  The task signs only its own re-packed archive. So no parser difference between the server and the updater can
  reach a signed file (`desktop-apps.md` section 9).
- Residual risk: a person with `update_url` can replace the staged archive
  before the task re-packs and signs it. The re-pack checks the structure
  of the archive, not its content. Every installed Mac app then takes that
  file at the release of the build. The task keeps no hash of the staged
  archive (`downloadStaged` in `desktop-build.runtime.ts`). So the manual
  check of "Update hijack and downgrade" does not cover the signed archive.
  Upgrade: the task logs the SHA-256 of the staged archive, and support
  compares it with the CI log line.
- URL check: `build-macos.yml` keeps the input URL check of `build.yml` and
  adds the `update_url` pattern. A stolen dispatch token cannot make CI
  build its own input.
- No secret on the macOS runner: the ad-hoc identity `-` needs no key,
  `permissions: {}`, and no `TAURI_SIGNING_PRIVATE_KEY`. The archive comes
  from `tar`, not from the bundler.
- Cache: only `warm-cache.yml` on `main` saves the macOS cache.
  `build-macos.yml` restores the exact key only.
- Unsigned disk image: the download is HTTPS from the updates host, and the
  row holds its SHA-256. The task checks only the `koly` trailer. This is
  the same trust as the content of the Windows setup exe.
- Gatekeeper habit: "Open Anyway" teaches users to pass a security alert.
  Accepted until notarization (D36).
- Navigation lock: each system accepts only its own app origin (see
  "Webview escape").
- Single instance: the lock of the plugin is a socket in the shared `/tmp`.
  Another local user can take the path first and stop the start. Accepted.
  Upgrade: a per-user socket path in a fork of the plugin.
- Privacy grants: the ad-hoc designated requirement is the code hash, so
  each update resets the privacy grants (TCC) of the app. The shell uses no
  grant today.
- Hardened runtime: on (the Tauri default), with no entitlements.
- Standard users: the updater asks for an admin password through
  AppleScript. The prompt comes from the plugin (macOS staging check 10).
- Takedown: `withdrawRelease` clears both pointers and both file keys. The
  suspend then deletes both manifests and both stable files with the
  `desktop/<project id>/` prefix.
- Kill switch: `DESKTOP_MACOS_BUILDS_ENABLED=false` stops new macOS builds.
- Uninstall: a drag to the Trash leaves `~/Library/Application
  Support/<identifier>`, `~/Library/WebKit/<identifier>`, and
  `~/Library/Caches/<identifier>`.
- One key, one counter: one minisign key signs both platforms. The shared
  release counter gives each build its own version, and the signed version
  must equal the manifest version. So a signed file of one platform never
  passes as an update of the other.
- Files before release: at `ready`, the disk image and the archive go to a
  random build folder. The Windows setup exe has the same rule. Only a
  release writes `latest-macos.json` and the stable `<binary name>.dmg`. A
  build that stops before `ready` deletes both files (`signedKeys` in
  `desktop-build.runtime.ts`).
- The flag gates only create. Release and cancel use no runner minute, and
  a fixed build must reach Mac apps also while new builds are off.
- Downgrade: the release refuses a build older than the current build of
  its platform (409). Each platform has its own pointer, so a Windows
  release cannot move a Mac app back.

### Open items

- No Authenticode signature (D34). SmartScreen warns on the first
  download.
- No rotation of the updater key pair of one app. The public key is in
  every installer. Upgrade: a release, signed with the old key, that ships
  a new public key.
- The staged installer check is manual (see "Update hijack and
  downgrade"). The staged macOS archive has no check (see "macOS builds").
- The preview applies the statement rules by the first keyword only
  (`desktop-apps.md` section 7). The installed app enforces the real
  rules.
- A frozen DDL statement that fails on saved rows has no fix: a
  replacement must copy it (`desktop-apps.md` section 12).
- macOS DNS prefetch: open until macOS staging check 6 of the runbook.
  The shell sets `DNSPrefetchingEnabled` to false only where WebKit still
  has the setter. Newer WebKit ignores it. Write the result of the check
  here. If the check sees a DNS query, a WebKit content rule list must
  block it before production turns macOS on.
- macOS apps have no Developer ID signature and no notarization (D36).
  Upgrade: sign and notarize on the server with rcodesign, after a decision
  on whose Developer ID signs user apps (D36).
- The gate dry run still runs on the event loop of the task. Upgrade: a
  worker thread (see "Untrusted frontend and SQL").
