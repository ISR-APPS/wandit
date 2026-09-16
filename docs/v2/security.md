# Sandbox security (V2)

The egress, env, and tool-call boundaries of the V2 app-builder sandbox,
as built in WANDIT-180. Each control names the file, function, or
constant to open.

## 1. Scope

Covers the network egress policy, the `request_network_host` host tool,
the sandbox env allow list, the template deny rules, and the PreToolUse
hook.

Does not cover:

- Rate limits, audit events, and the secret scanner: WANDIT-181.
- Connector hosts such as Resend tenant domains: WANDIT-189.
- User secrets in `project_secrets`: WANDIT-185.

## 2. Egress layers

`buildNetworkPolicy` in `infrastructure/sandbox/network-policy.ts`
merges three allow layers into one sorted, deduped list:

1. `GLOBAL_ALLOWED_HOSTS`, eight hosts for every sandbox:
   `registry.npmjs.org` (`pnpm install`), `*.supabase.co` (the generated
   app's backend), `fonts.googleapis.com` and `fonts.gstatic.com` (the
   template fonts), `api.stripe.com`, `api.resend.com`,
   `maps.googleapis.com`, `api.openai.com` (the connectors).
2. Connector hosts. Empty today; WANDIT-189 feeds the list.
3. Per-project hosts, from the `projects.networkAllowedHosts` column.
   The `request_network_host` host tool appends one host per approval.
   The runtime reads the column and passes it to `buildNetworkPolicy`.

`VercelSandboxProvider.start` adds three more hosts before the vendor
call:

- The LLM proxy host, parsed from `ANTHROPIC_BASE_URL`. A missing or
  invalid URL throws in strict mode before the vendor call.
- The git host `<org>.code.storage`, from `CODE_STORAGE_ORG`.
- The asset host, the hostname of `R2_PUBLIC_BASE_URL`.

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
   the firewall, because the deny ranges outrank the allow list.
2. It appends the host to `projects.networkAllowedHosts` with a deduping
   write, so a repeated grant is a no-op and the next sandbox keeps it.
3. It calls `SandboxHandle.allowHost`, which merges the host into the
   live allow list and applies it, no restart.
4. It writes an `audit_events` row with the action `network.host_allowed`
   (the action name comes from WANDIT-181).

`allowHost` routes through the live harness session, not the raw vendor
call. The session holds the run-token transformation for the proxy host.
So the merge keeps that transformation, and the running turn's proxy
calls still carry the token.

## 6. Template deny rules

`templates/web-app/.claude/settings.json` holds the `permissions.deny`
list. Grouped:

- Config paths: `.claude/**`, `.mcp.json`, `opencode.json`,
  `.git/hooks/**`, `.git/config`.
- Env files: `.env`, `.env.*`.
- Shell rc files: `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`,
  `.zshenv`, `.profile`, each in the project and under `~/`.
- Install config: `.npmrc`, `.pnpmfile.cjs`, `pnpm approve-builds*`.
- Git commands: `git push*`, `git reset*`, `git checkout*`,
  `git switch*`, `git rebase*`, `git tag*`, `git config*`.
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
`pnpm dlx`, `bunx`); the `/private/tmp` symlink on macOS;
`pnpm.onlyBuiltDependencies` in `package.json`; a script file or a
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

`SANDBOX_ENV_ALLOW_LIST` (`sandbox-env.ts`) holds the eight env names
a sandbox may receive: `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`,
`ANTHROPIC_API_KEY`, `ANTHROPIC_CUSTOM_HEADERS`,
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `VITE_SUPABASE_ANON_KEY`,
`VITE_SUPABASE_URL`, `WANDIT_PREVIEW_HOST`. Every other name — a
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

## 12. Open items

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
