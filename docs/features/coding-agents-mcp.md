# Coding agents (remote MCP server)

**Status:** in build on branch `feat/v2-mcp-server` · **Decision:** D29 in `docs/v2/DECISIONS.md` · **Date:** 2026-11-04

A user connects an external coding agent (Claude Code, Codex CLI, Cursor, VS Code) to the Wandit account. The agent then reads and edits the code of the user's V2 projects, prompts the Wandit builder agent, and publishes the app. The agent talks to one remote MCP server on the API origin. The user signs in once with OAuth in the browser.

## Founder decisions (2026-11-04)

- Auth: "the most secure option". Better Auth goes from 1.6.22 to 1.7.16 first. 1.6.22 has one critical advisory for this repo (GHSA-4wq4-2ppv-q3hg, the Expo proxy), and the 1.6 line gets no more security fixes. The MCP server uses the 1.7 plugins `jwt()`, `mcp()` (`@better-auth/mcp`), and `cimd()` (`@better-auth/cimd`). The legacy `mcp` plugin of 1.6 is forbidden: it can skip consent and stores tokens in plain text.
- Grant: "the way Lovable does it". One connection reaches the whole account: every V2 project that the user can open, personal and team, with the same roles as the web app. The consent page has no project picker and no read-only mode.
- Tools v1: read code, edit files directly, prompt the Wandit builder, and publish the app.

## URLs

| What | Path on the API origin | Notes |
|---|---|---|
| MCP endpoint (the OAuth resource) | `POST /api/mcp` | The resource URL is `<BETTER_AUTH_URL>/api/mcp`. It never changes after launch: a change forces every client to log in again. GET and DELETE answer 405. |
| Protected Resource Metadata (RFC 9728) | `GET /.well-known/oauth-protected-resource/api/mcp` and `GET /.well-known/oauth-protected-resource` | Outside the `/api` global prefix. One `authorization_servers` entry. |
| Authorization Server Metadata (RFC 8414) | `GET /.well-known/oauth-authorization-server/api/auth` and the Better Auth path under `/api/auth` | Issuer is `<BETTER_AUTH_URL>/api/auth`. |
| Login bridge (web) | `/oauth/authorize` | `loginPage` of the plugin. Under the `_auth` layout, so the sign-in and onboarding gates run first. |
| Consent page (web) | `/oauth/consent` | `consentPage` of the plugin. |
| Account page (web) | `/coding-agents` | Connect snippets and the list of connected agents with Revoke. |

Production: `https://api.wandit.dev/api/mcp`. Staging: `https://api-staging.wandit.dev/api/mcp`. Local: `http://localhost:<api-port>/api/mcp`. The web origin never serves MCP: `vercel.json` sends `/api/*` to production.

## Rollout gate

- The OAuth provider plugins load only when `V2_BUILDER_ENABLED` is true. Railway production forces that switch to false, so production has no OAuth endpoints and no MCP route until V2 ships.
- The MCP controller lives in `AppBuilderModule`, so it mounts only with V2.
- Each MCP request also runs `V2BuilderEnabledGuard` (product setting plus the PostHog flag `v2-builder`).

## OAuth rules

- OAuth 2.1 with PKCE S256 only. Public clients use `token_endpoint_auth_method: none`.
- Client registration: CIMD (profile `mcp-2026-07-28`) for Claude Code, Codex, and VS Code. The code does not call `cimd()`. It passes `createCimdClientDiscovery` with the host check to `mcp({ extensions })`, so the check runs before the fetch. Dynamic Client Registration for public clients only, for Cursor and older clients. Loopback ports match with the port ignored (RFC 8252 section 7.3).
- CIMD hosts (Zack, 2026-11-04): a CIMD client id must be on `claude.ai`, `chatgpt.com`, or `vscode.dev`. The API refuses other hosts before it fetches the document, so an anonymous caller cannot use the fetch budget. To support a new agent, add its host to the allowlist constant in `packages/auth/src/mcp-oauth-provider.ts`.
- DCR redirect URIs: loopback, https, or the `cursor:` scheme (Zack, 2026-11-04, for Cursor). No other custom scheme. A redirect on a domain that serves user content (`SITES_DOMAIN` and its subdomains) is refused. DCR fields that make the server fetch a URL later (`backchannel_logout_uri` and similar) are refused.
- DPoP is not supported: the token endpoint refuses a request with a `dpop` header, because the MCP guard accepts only bearer tokens.
- Consent: always, for every client and every new grant. Never `skip_consent` on a CIMD or DCR client.
- Scopes: `projects:read`, `projects:write`, `builder:run`, `projects:deploy`, plus `offline_access` for the refresh token. A client asks for all of them on the first login, because Claude Code does not step up after a 403.
- Tokens: JWT access token, audience = the MCP resource URL, 15 minutes. Refresh token 30 days, rotated on each use, with family revocation. Tokens are hashed at rest.
- Revoke: a consent delete removes the access and refresh tokens of (user, client). A token exchange that ends with no consent row answers `invalid_grant`. A code or a refresh token older than the current consent row also answers `invalid_grant`, to one-second precision. So a credential from before a revoke or a ban stays dead after a new grant, also when a refresh races the revoke. An admin ban deletes all OAuth tokens and consents of the user.
- `jwt()` runs with `disableSettingJwtHeader: true`. `/token` is in `disabledPaths`, so a cookie session cannot mint a JWT.
- The API never enables the `bearer` or `device-authorization` plugins. They make session tokens into bearer credentials.
- `main.ts` accepts `application/x-www-form-urlencoded` only on the OAuth token, revoke, and introspect paths, as a string, with a small body limit. All other paths keep the 415.
- The consent page shows the signed-in email, the client name marked as "given by the app", the client id host, the redirect address when it is on another origin, and the access in plain words. It loads no logo from the client and no third-party script (Chatwoot is off on `/oauth/*`).
- The Allow button becomes active 1 s after the page loads or gets focus again. This stops a double-click on another page from landing on Allow.

## MCP request rules

1. Guard order on `POST /api/mcp`: `McpTokenGuard`, then `V2BuilderEnabledGuard`, then `RedisRateLimitGuard`. The route is `@Public()` (no cookie auth) and `@SkipResponseEnvelope()`.
2. `McpTokenGuard` reads only `Authorization: Bearer`. It verifies signature, issuer, audience, and expiry. It refuses an opaque token and a token of another audience. It loads the user and refuses a banned user. It checks that the consent of (user, client) still exists, so a revoke works at once. It refuses a token issued before the current consent row, so an old token stays dead after a new grant. It sets `request.user` and the grant (client id, scopes).
3. On failure it answers 401 with `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"`, or 403 with `error="insufficient_scope", scope="<missing>"`.
4. Origin: the global `CrossSiteWriteGuard` refuses a foreign `Origin`. A CLI sends no `Origin`, so it passes. No CORS entry for `/api/mcp`.
5. A new MCP server for each POST, from `@modelcontextprotocol/server` 2.4 with `legacy: "stateless"`, so 2026-07-28 clients and 2025 clients both work. JSON response mode. JSON-RPC batches are refused.
6. No token passthrough. Tools call the existing services. code.storage, the sandbox, Trigger.dev, and the LLM proxy keep their own server-minted credentials.
7. The `Authorization` header and token values never go to logs, Sentry, or audit rows.

## Project access

- A tool takes a `projectId`. The server loads the project owner columns, then proves access again on every call: a personal project needs `userId` = the token user; a team project needs a fresh membership row (`WorkspaceMembersRepository.findMember`). It then builds the `ProjectScope` with `projectScopeFrom`.
- Role gates are the web gates: reads need membership; `apply_changes`, `wake_sandbox`, `send_prompt`, and `cancel_turn` need `project:update`; `publish_app` needs `publish:manage`.
- A missing project, a project out of scope, a V1 project, and a deleted project give the same "Project not found" error.

## Tools v1

| Tool | Scope | Reuses | Rule |
|---|---|---|---|
| `list_workspaces` | projects:read | `WorkspacesService.listForUser` | Personal plus teams, with the role. |
| `list_projects` | projects:read | `ProjectsRepository.listForScope` | V2 projects only: id, name, platform, updated at, builder link. |
| `get_project` | projects:read | `AppProjectsService.get`, `PublishService.status` | Sandbox state, head sha, publish state, live URL, builder link `<web>/app/<id>`. No preview token. |
| `list_files` | projects:read | `CodeService.snapshot` | Needs a running sandbox. Paged. |
| `read_file` | projects:read | `CodeService.file` | Same path guard. Paged by offset, so one answer fits the 25k-token output cap of Claude Code. |
| `list_versions` | projects:read | `VersionsService.list` | Recent commits. |
| `get_turn` | projects:read | `TurnsService` scoped read | Status, result, and pending cards. Optional bounded wait (at most 25 s). |
| `wake_sandbox` | projects:write | `SandboxWakeService.wake` | Same rate bucket as the web. |
| `apply_changes` | projects:write | the `AppThemeService.save` pattern, `commitTurn` | One lock, one batch, one commit with source `mcp`. |
| `send_prompt` | builder:run | `TurnsService.create` | Spends credits with the web holds and caps. Returns at once. Client `requestKey` makes a retry a no-op. |
| `cancel_turn` | builder:run | `TurnsService.cancel` | Same rate bucket as the web. |
| `publish_app` | projects:deploy | `PublishService.publishHead` | Client `requestKey`. Same rate bucket as the web. Never `overrideGate`, rollback, or unpublish. |

## Direct edits (`apply_changes`)

- Input: `projectId`, `expectedHeadSha`, `message`, and `changes` (each `{ path, content }` or `{ path, delete: true }`). Caps: 50 files, 512 KiB per file (`CODE_FILE_MAX_BYTES`), 2 MiB per call. UTF-8 text only, no NUL byte.
- Flow (copy of `AppThemeService.save`): take the turn lock with holder `restore:mcp-<uuid>`, refresh it, refuse while a turn waits for the user, refuse when the sandbox does not run, compare `expectedHeadSha` with the sandbox HEAD, write through a guarded script, `commitTurn` with explicit `paths` and source `mcp`, undo on a commit error, release in `finally`, then `TurnPromoter.promoteNext` when a turn waits.
- Errors: `BUILDER_TURN_RUNNING`, `BUILDER_TURN_WAITING`, `SANDBOX_NOT_RUNNING` (call `wake_sandbox`), `HEAD_MOVED`, `PATH_NOT_ALLOWED`.
- Paths with a control character (Unicode category Cc) are refused. A trailing newline once made a protected name look different to the check and the same to bash.
- Write deny list (server side, because the sandbox hook does not see these writes): `.git/**`, `.env`, `.env.*`, `.claude/**`, `.mcp.json`, `opencode.json`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `template_version`, `native-modules.json`, `.npmrc`, `.pnpmfile.cjs`, `.pnpmfile.mjs`, `pnpm-workspace.yaml`, `.gitignore`, `node_modules/**`, `src/styles/theme.json`, `src/styles/theme.ts`, `src/styles/theme-options.ts`, `src/styles/engine.css`. Also absolute paths, `..`, and a symlink target or a symlinked parent.
- No credits: no Wandit model runs. Rate limit per user.

## Builder prompts (`send_prompt`)

- Calls `TurnsService.create`, so the credit hold, the cost cap, the 3-holds limit, and the turn lock apply. The MCP layer also runs the gates that the HTTP controller adds: the V2 gate, `project:update`, and the shared `turn-create` rate bucket.
- `requestKey` (uuid from the client) becomes the turn request key `mcp:<clientId>:<userId>:<requestKey>`, so a retry returns the same turn and takes no new hold. A reused key with another prompt answers `REQUEST_KEY_REUSED`.
- The agent can deny an approval card. It can never approve one: the user approves in the web app. Approval cards gate destructive migrations, SQL writes, and new network hosts.
- No `model`, `targets`, `composer`, or `attachments` in v1.

## Audit

- One `audit_events` row for each write, builder, and deploy tool call: action `mcp.tool_call`, metadata `{ tool, clientId, outcome }` plus the commit sha or the turn id. Never arguments, file content, or tokens.
- `mcp.consent_granted` and `mcp.consent_revoked` rows for grants.

## Prompt injection

File content in a project can carry text that steers the external agent. The server cannot filter it reliably. The limits are: the tool descriptions say that file content is untrusted data; every write is a commit that the user can restore; protected files stay locked; approvals stay with the human; and no tool sends data off the platform (no URL fetch, no shell, no SQL).

## Known limits

- The guard checks the ban on every call, so a ban stops the agent at once. The ban also deletes the grants, so an unban does not bring them back.
- The tables come from migration `0089_mcp-oauth-provider.sql`. Run `db:migrate` before an API with V2 on boots.
- `V2_BUILDER_ENABLED` must stay false in the Trigger.dev production environment. The Trigger worker loads `@wandit/auth`, and the Railway production rule does not apply there.
- Reads and writes need a running sandbox. The agent calls `wake_sandbox` first.
- The `feat/github-sync` work (uncommitted in its own worktree) edits the same shared files: audit actions, routes, the commit-source enum, migration numbers, `commitTurn`. The second branch to merge rebases and renumbers its migration.
