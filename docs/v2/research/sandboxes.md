# Cloud sandbox providers for the wandit V2 builder

Date: 2026-09-03. Author: research agent (Claude Fable). Status: research, no code changes.

> **Correction, 2026-09-05.** The Cloudflare rows below are out of date on 2 points. (1) Cloudflare Containers and Sandboxes are GA since 2026-04-13 on the Workers Paid plan (https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/). Only the Sandbox SDK 1.0 is a preview on the `@next` tag. (2) Disk persistence exists: a backup and restore API saves a folder to R2 (https://developers.cloudflare.com/changelog/post/2026-02-23-sandbox-backup-restore-api), and full-disk snapshots with an option to snapshot at sleep were announced on 2026-04-13 (https://blog.cloudflare.com/sandbox-ga/). Memory does not survive sleep yet ("In future releases, live memory state will also be captured"). Instance types: `standard-3` = 2 vCPU, 8 GiB, 16 GB; `standard-4` = 4 vCPU, 12 GiB, 20 GB. Rates: vCPU $0.000020 per second (active only), memory $0.0000025 per GiB-second, disk $0.00000007 per GB-second, egress $0.025 per GB with 1 TB included (https://developers.cloudflare.com/containers/platform/pricing/, page dated 2026-08-28). Preview URLs are public by default with a token in the host name (https://developers.cloudflare.com/sandbox/guides/expose-services/). Credential injection by egress proxy exists. The ranking stays: Vercel first because of the harness adapter. Cloudflare moves to second place, ahead of E2B.

## 1. Scope

This report compares cloud sandbox providers for one job. Each user project needs one sandbox. The sandbox must run three things at the same time:

1. A coding agent (Claude Code, driven through the AI SDK `HarnessAgent`).
2. A Vite/React dev server (web preview in an iframe).
3. An Expo/Metro dev server (mobile preview).

The sandbox must keep the project files between chat sessions. It must expose the dev-server ports on a URL that only the project owner can open.

All prices and limits come from the official pages listed in section 12. I fetched each page on 2026-09-03 unless a note says otherwise. Items I could not confirm from a primary source are marked **UNVERIFIED**.

## 2. Repo context

- The V1 stack already runs on Cloudflare. `apps/edge/wrangler.jsonc:3-34` defines the `wandit-edge` Worker with a KV pointer namespace (`PTR`) and an R2 bucket (`SITES`), routed on `*/*` for zone `wandit.app`.
- The server already uses AI SDK v7: `apps/server/package.json:45` (`"ai": "^7.0.19"`), `apps/server/package.json:23-24` (`@ai-sdk/gateway`, `@ai-sdk/mcp`).
- The web app uses Vite 8: `apps/web/package.json:63` (`"vite": "^8.0.8"`).
- The native app uses Expo 56 and React Native 0.85: `apps/native/package.json:35` (`"expo": "~56.0.3"`), `apps/native/package.json:60` (`"react-native": "0.85.3"`).
- The root uses pnpm 11.7.0 and Node 22 types: `package.json:35` (`"packageManager": "pnpm@11.7.0"`), `package.json:30` (`"@types/node": "^22.13.14"`).

## 3. What the product needs from a sandbox

These requirements come from the product context and from the toolchain facts below.

| Need | Why | Source |
| --- | --- | --- |
| Node 22 or newer | Expo SDK 57 needs Node 22.13.x minimum. Claude Code npm package needs Node 22 since v2.1.198 (the native binary itself does not use Node). | https://docs.expo.dev/versions/latest/ ; https://code.claude.com/docs/en/setup |
| 4 GB RAM or more | Claude Code system requirement is 4 GB+ RAM. Vite and Metro add more. Plan 2 vCPU / 4 GB as the floor, 4 vCPU / 8 GB as comfortable. | https://code.claude.com/docs/en/setup |
| Sessions of hours, not minutes | A user chats, waits, and returns. The agent runs for minutes per turn. Dev servers idle in between. | product context |
| Persist a project for days or weeks | A project lives across many chat sessions. | product context |
| Expose 2 or more ports (Vite 5173, Metro 8081, harness bridge) | Web preview, mobile preview, and the AI SDK Claude Code adapter each need a port. The adapter "requires a network sandbox with at least one exposed port". | https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code ; https://docs.expo.dev/more/expo-cli/ |
| Preview URL that an iframe can load | An iframe cannot add HTTP headers. Header-only tokens do not work for the iframe without a proxy. Signed URLs, query tokens, host tokens, or cookies do work. | browser fact; see section 7 |
| Egress control and secret brokering | The agent runs user-influenced code. The Anthropic key should not sit in the sandbox if the provider can inject it at the proxy. | https://vercel.com/docs/sandbox/concepts/firewall |
| EU region option | Users are in France and other regions. Latency to the preview matters for HMR. | product context |
| TypeScript SDK | The server is TypeScript. | repo |
| AI SDK `HarnessAgent` support | Plan is to use the AI SDK harness feature. Only one sandbox adapter is documented today: `@ai-sdk/sandbox-vercel`. | https://ai-sdk.dev/providers/ai-sdk-harnesses |

## 4. Summary table

Prices are on-demand list prices, default region, converted to per hour where the provider quotes per second. "2v/4G" is the hourly compute cost for a 2 vCPU / 4 GB sandbox while it runs.

| Provider | Isolation | Cold start | Max session | Persist between sessions | Preview URL auth | Egress control | EU | TS SDK | Free tier | 2v/4G per hour |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vercel Sandbox | Firecracker microVM | "milliseconds" (no number) | 45 min Hobby, 24 h Pro per session; unbounded across sessions | Auto filesystem snapshot on stop (default); resume on next call | Public URL, no token | allow-all / deny-all / allowlist, credential brokering, proxying | cdg1 (Paris) | `@vercel/sandbox` 3.2.1 | 5 CPU-h, 420 GB-h, 10 concurrent | ~$0.09 idle to ~$0.34 at 100% CPU |
| E2B | Firecracker microVM | <200 ms claim | 1 h Hobby, 24 h Pro; pause resets | Pause keeps FS + memory forever | Public by default; header token option | allow/deny by IP, CIDR, domain; live update | EU cluster, Pro and up, by support request | `e2b` 2.46.1 | $100 one-time credit, 20 concurrent | $0.166 |
| Daytona | Container (Sysbox) or VM | <90 ms container claim | No hard max seen; auto-stop 15 min idle | Stopped keeps FS; VM pause keeps memory; archive to object store | Public flag, header token, or signed URL (token in URL) | block-all, CIDR allowlist (10), domain allowlist (20); tiers 1-2 locked | `eu` target | `@daytona/sdk` 0.207.1 | $200 credit | $0.166 + disk |
| Modal Sandboxes | gVisor | sub-second claim, 1-5 s observed (third party) | 5 min default, 24 h max; idle timeout option | FS snapshot to image (30 d TTL); memory snapshot experimental (7 d) | Public tunnel URL; optional Sandbox Connect Tokens for HTTP | block_network, CIDR allowlist, domain allowlist (443 only) | eu, eu-west, eu-north, eu-south at 1.15x-1.75x | `modal` 0.9.0 | $30/month credit, 100 containers | $0.38 |
| Cloudflare Sandbox SDK / Containers | Per-instance VM (tech not named) | 1-3 s | No max; sleeps after 10 min idle by default | None native; disk erased on sleep; R2 directory backups | Token in hostname (16-char) on your wildcard domain | Not documented for Sandbox SDK | No region pin; first request picks location | `@cloudflare/sandbox` 0.12.9 | Workers Paid $5/mo includes 375 vCPU-min, 25 GiB-h | ~$0.08 idle to ~$0.22 (standard-3, 8 GiB) |
| Fly Machines | Firecracker microVM | "well under a second"; resume from suspend "a few hundred ms" | None | Volumes; stopped rootfs kept; suspend (RAM <= 2 GB) keeps memory | You build it (Fly Proxy + your auth) | Network policies by port/protocol; no domain filter | ams, fra, lhr, cdg, arn | REST API; no official TS SDK found (UNVERIFIED) | None stated | ~$0.03 shared, ~$0.09 performance |
| Fly Sprites | KVM/Firecracker (third-party reports) | 1-2 s (third party) | None; idle to warm in seconds | Checkpoints; 100 GB sparse NVMe; cold storage | Not documented in fetched pages | DNS-based network policy | Not documented | `@fly/sprites` | Not documented | $0.315 (third-party price data) |
| CodeSandbox SDK | Firecracker microVM | Resume 0.5-2 s | Hibernate after 300 s (free) / 1800 s (pro), max 86400 s | Memory snapshot on hibernate, 7 days, then archive | private / public-hosts / public; host tokens and signed URLs | Not documented in fetched pages | Not documented in fetched pages | `@codesandbox/sdk` 2.4.2 | 400 credits/month (search snippet) | ~$0.15 Nano (UNVERIFIED) |
| StackBlitz WebContainers | Browser WASM, in tab | Milliseconds after download | Tab lifetime | None; export/import FS yourself | Runs in user's browser; no public URL | Browser CORS only | N/A | `@webcontainer/api` 1.6.4 | Free for non-commercial; commercial license, price not public | $0 server compute |
| Northflank | microVM (Kata / Cloud Hypervisor / Firecracker) or gVisor | <1 s claim | None; scale to zero manually | Volumes ($0.15/GB-mo); config kept | Public DNS auto; public/private routing | Not documented in fetched pages | EU West | `@northflank/js-client` 0.10.1 | Free "Sandbox" plan: 2 services | $0.067 |
| Blaxel | Lightweight VM + OverlayFS | 25 ms resume claim | None; standby after ~15 s idle | Standby snapshot (memory + FS); archive; volumes | Public, or private with `bl_preview_token` query param or header | iptables and egress proxy with header injection | eu-lon-1, eu-fra-1 | `@blaxel/core` 0.3.17 | $200 credit, 10 sandboxes | $0.166 (RAM-priced, 4 GB) |
| Runloop | VM ("virtual machine technology") | "a few seconds" | 1 h default max lifetime; idle policy | Suspend keeps disk only, not memory | Tunnel open or bearer token | Network policies (egress) | Not documented | `@runloop/api-client` 1.31.0 | $50 credit, 3 devboxes | $0.3195 MEDIUM; suspend needs Pro $250/mo |
| AWS Lambda MicroVMs | Firecracker microVM | "rapid" from snapshot; no number | Suspend up to 8 h | Suspend keeps memory + disk; snapshot $0.08/GB-mo | JWE token in `X-aws-proxy-auth` header | Public by default; VPC egress connector | eu-west-1 (Ireland) | AWS SDK v3 (generic) | None stated | ~$0.25 baseline (Graviton) |
| Self-hosted Firecracker / gVisor | You choose | Firecracker <125 ms boot | You choose | Firecracker snapshots (production-ready); gVisor checkpoint/restore | You build it | You build it | You choose | You build it | Hardware cost | Bare-metal cost (UNVERIFIED) |

Notes on the table:

- "Cold start" figures are vendor claims unless marked third party. Nobody publishes a benchmark for "Claude Code + Vite + Metro" boot time. The real number is dominated by `pnpm install` and dev-server start, not by VM boot. Snapshots remove that cost.
- Persist columns describe what the provider keeps when the VM stops. A memory snapshot keeps the dev servers alive. A filesystem snapshot requires a restart of the dev servers on resume.

## 5. Provider details

### 5.1 Vercel Sandbox

- Isolation: "Each sandbox runs in its own Firecracker microVM with a dedicated kernel." Runs `sudo`, Docker inside, FUSE. https://vercel.com/docs/sandbox/concepts
- Cold start: "Sandboxes start in milliseconds." No number given. "Resuming from a snapshot is even faster than starting a fresh sandbox." https://vercel.com/docs/sandbox ; https://vercel.com/docs/sandbox/concepts
- Session length: default timeout 5 minutes. `timeout` option and `sandbox.extendTimeout()`. Max session 45 min Hobby, 24 h Pro and Enterprise. The limit applies per session, not per sandbox. "the total lifetime of a persistent sandbox is effectively unbounded". https://vercel.com/docs/sandbox/pricing
- Pause/resume and snapshots: persistence is the default. On stop, the SDK snapshots the filesystem. Any SDK call on a stopped sandbox starts a new session from the last snapshot. `Sandbox.getOrCreate({ name })` is the recommended long-lived pattern. `onCreate` and `onResume` hooks exist. Snapshots expire 30 days after last use by default; `snapshotExpiration: 0` keeps them forever; `keepLastSnapshots: { count: 1 }` keeps storage flat. Sandboxes that cannot resume are deleted after 14 days of inactivity. `Sandbox.fork()` clones from a snapshot. Memory is not snapshotted. https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
- Disk: 64 GB ephemeral NVMe per sandbox (SDK 3.0.0+ or custom image). Drives (beta) give persistent storage in one region. https://vercel.com/docs/sandbox/pricing
- Ports and preview URL: declare `ports` at create (up to 15). `sandbox.domain(port)` returns `https://<sandbox-id>-<port>.sandbox.vercel.app`. "Exposed ports are accessible via a public URL." No built-in token. https://vercel.com/docs/sandbox/sdk-reference ; https://vercel.com/docs/sandbox/concepts
- Egress: three modes: `allow-all` (default), `deny-all`, user-defined (domain and CIDR allowlists, denied ranges). Domain match uses TLS SNI. Credentials brokering injects headers at the proxy so "the secrets never enter the sandbox". Request proxying to your own `forwardURL` with a Vercel OIDC token. Policies update live. Hobby has the full firewall. https://vercel.com/docs/sandbox/concepts/firewall
- Secrets: `env` at create and per command. Prefer brokering for the Anthropic key. https://vercel.com/docs/sandbox/sdk-reference
- CPU/RAM: 1 vCPU or an even number 2-32. 2 GB RAM per vCPU. Default 2 vCPU. Max 4 vCPU / 8 GB Hobby, 8 / 16 GB Pro, 32 / 64 GB Enterprise. https://vercel.com/docs/sandbox/pricing
- Images: default `vercel/sandbox/universal` = Ubuntu 26.04 + "Node.js LTS (24), Python (3.14), coding agents, utilities". `vercel/sandbox/node:22|24|26` include pnpm. Custom OCI images from Vercel Container Registry. Nightly rebuilds pick up new agent releases. `ENTRYPOINT`/`CMD` are not run. https://vercel.com/docs/sandbox/concepts/images
- Regions: `iad1` default, `sfo1`, `cle1`, `cdg1` (Paris). Snapshots are region-bound. Failover regions need Pro. https://vercel.com/docs/sandbox/concepts/regions
- Pricing (iad1): Active CPU $0.128 per vCPU-hour, measured only while code uses CPU ("Time spent waiting for I/O ... does not count"). Provisioned memory $0.0212 per GB-hour, 1-minute minimum. Creations $0.60 per million. Data transfer out and exposed-port traffic $0.15/GB; downloads free. Snapshot storage $0.08/GB-month. Regional rates differ (page did not render the per-region table; UNVERIFIED for cdg1). https://vercel.com/docs/sandbox/pricing
- Free tier: Hobby includes 5 CPU-hours, 420 GB-hours, 5,000 creations, 20 GB transfer, 15 GB snapshots, 10 concurrent, 45-min sessions. Pro usage draws from the $20/month credit. https://vercel.com/docs/sandbox/pricing
- Concurrency: 10 Hobby, 10,000 Pro. vCPU allocation rate ramps from 150 to 5,000 vCPU/min on Pro. Control plane 10,000 requests/min on Pro. https://vercel.com/docs/sandbox/pricing
- TypeScript SDK: `@vercel/sandbox` 3.2.1 on npm. Also Python SDK and `sandbox` CLI. The npm description still says "private beta" but the docs say GA. https://registry.npmjs.org/@vercel/sandbox ; https://vercel.com/docs/sandbox
- AI SDK harness: `@ai-sdk/sandbox-vercel` is the only sandbox adapter documented. `@ai-sdk/harness-claude-code` 1.0.104 wraps `@anthropic-ai/claude-agent-sdk` and "ships a bridge process that runs inside a sandbox and talks to the host over a WebSocket". Needs `VERCEL_OIDC_TOKEN` plus `ANTHROPIC_API_KEY` or `AI_GATEWAY_API_KEY`. https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code ; https://registry.npmjs.org/@ai-sdk/harness-claude-code
- Node 22 + pnpm + Expo: yes. `node:22` image has pnpm. Universal image has Node 24. Custom image can pin anything.
- Auth to the API: Vercel OIDC token in Vercel deployments, or access tokens elsewhere. The wandit server runs outside Vercel, so it will use an access token. https://vercel.com/docs/sandbox

### 5.2 E2B

- Isolation: Firecracker microVM. "FULL ISOLATION". https://e2b.dev/
- Cold start: "less than 200 ms" same region, "80 ms" claim on the home page. https://e2b.dev/
- Session length: "up to 24 hours (Pro) or 1 hour (Base)". `setTimeout` resets the countdown. Default timeout not confirmed (UNVERIFIED; SDK default is believed to be 5 minutes). https://docs.e2b.dev/sandbox.md
- Pause/resume: `sandbox.pause()` saves filesystem and memory. Paused sandboxes "persist indefinitely". `Sandbox.connect()` resumes. Pause costs about 4 s per GiB of RAM; resume about 1 s. `onTimeout: 'pause'` auto-pauses. Option to drop memory and keep only the filesystem. Pause resets the 24 h clock. https://docs.e2b.dev/sandbox/persistence
- Snapshots: `sandbox.createSnapshot()` captures filesystem and memory and can spawn many sandboxes. Needs envd v0.5.0+. Retention and price not documented. https://docs.e2b.dev/sandbox/snapshots.md
- Disk: 10 GiB Hobby, 20 GiB Pro, included. https://docs.e2b.dev/faq/calculate-sandbox-price.md ; https://docs.e2b.dev/billing.md
- Ports and preview URL: `sandbox.getHost(port)` returns `[PORT]-[ID].e2b.app`. Public by default. Set `allowPublicTraffic: false` to require header `e2b-traffic-access-token` with `sandbox.trafficAccessToken`; missing header gets 403. Custom domains exist. https://docs.e2b.dev/network/public-url ; https://docs.e2b.dev/network/restrict-public-access.md
- Egress: allow and deny lists by IP, CIDR, and domain with wildcards; per-host header injection on intercepted HTTPS; `updateNetwork()` on a running sandbox. https://docs.e2b.dev/network/internet-access
- Secrets: environment variables page exists; per-host header injection can broker credentials. https://docs.e2b.dev/llms.txt
- CPU/RAM: default 2 vCPU / 512 MiB. RAM range 512 MiB to 8,192 MiB. Hobby max 8 vCPU / 8 GiB; Pro "8+". Pro has "customizable CPU & RAM". https://e2b.dev/pricing ; https://docs.e2b.dev/billing.md
- Regions: US by default. "shared EU cluster for customers on the Pro tier and above", enabled by support. https://docs.e2b.dev/faq/eu-region.md
- Pricing: vCPU $0.000014/s = $0.0504/h. RAM $0.0000045/GiB/s = $0.0162/GiB/h. Per second, only while running. "Paused and killed sandboxes are not billed" for compute; storage price for paused state not stated (UNVERIFIED). Hobby $0 with a one-time $100 credit. Pro $150/month plus usage. https://docs.e2b.dev/faq/calculate-sandbox-price.md ; https://e2b.dev/pricing
- Concurrency: 20 Hobby, 100 Pro, up to 1,100 with paid add-ons (Pro+ +$500/mo for 600, Pro++ +$1,000/mo for 1,100; the add-on prices come from a third-party summary, UNVERIFIED). https://docs.e2b.dev/billing.md
- TypeScript SDK: `e2b` 2.46.1. Mature; also Python. https://registry.npmjs.org/e2b
- Self-hosting: `e2b-dev/infra` is Apache-2.0, Terraform, Nomad, Consul, Firecracker. GCP supported, AWS beta. https://github.com/e2b-dev/infra
- Node 22 + pnpm + Expo: custom templates with a Dockerfile. No preinstalled coding agent in the default template (UNVERIFIED).

### 5.3 Daytona

- Isolation: two classes. Container sandboxes use Sysbox: user namespaces, virtualized procfs/sysfs, immutable mounts, syscall interception; host kernel is shared. VM sandboxes have their own kernel and support pause, fork, hot snapshots. Firecracker is used where nested virtualization exists (search snippet, UNVERIFIED which runners). https://www.daytona.io/docs/en/isolation/
- Cold start: "under 90 milliseconds" for container sandboxes. https://www.daytona.io/docs/en/sandboxes/
- Lifecycle: auto-stop after 15 min idle (container), auto-pause after 60 min (VM), auto-archive after 7 days stopped (30 days max), auto-delete off by default. Stopped keeps the filesystem; paused keeps memory too; archived moves the filesystem to object storage. Ephemeral sandboxes delete on stop. https://www.daytona.io/docs/en/persistence/
- Disk: default 3 GiB, max 10 GiB per sandbox. https://www.daytona.io/docs/en/sandboxes/
- Ports and preview URL: `https://{port}-{sandboxId}.{proxyDomain}`. Public sandboxes need no auth. Private sandboxes need header `x-daytona-preview-token`, or a signed URL `https://{port}-{token}.{proxyDomain}` with `expires_in_seconds` (default 60 s, max 86,400 s). `getPreviewLink(port)` and `getSignedPreviewUrl(port, expiresInSeconds)` in the TS SDK. https://www.daytona.io/docs/en/preview-and-authentication/ ; https://www.daytona.io/docs/en/typescript-sdk/sandbox/
- Egress: `networkBlockAll`, `networkAllowList` (10 CIDRs), `domainAllowList` (20 domains). Tiers 1 and 2 have restricted egress that a sandbox cannot override. Essential services (npm, GitHub) are not auto-added to a custom allowlist. https://www.daytona.io/docs/en/network-limits/
- Secrets: env vars at create; dedicated secrets feature. https://www.daytona.io/docs/en/sandboxes/
- CPU/RAM: default 1 vCPU / 1 GiB; max 4 vCPU / 8 GiB per sandbox. Snapshots `daytona-small/medium/large` (1/1/3, 2/4/8, 4/8/10). https://www.daytona.io/docs/en/sandboxes/
- Regions: `us` and `eu`. https://www.daytona.io/docs/en/sandboxes/
- Pricing: vCPU $0.0504/h, RAM $0.0162/GiB/h, disk $0.000108/GiB/h after 5 GiB free, per second. $200 trial credit, no card. https://www.daytona.io/pricing
- Concurrency: tier caps on total resources. Tier 1: 10 vCPU / 20 GiB / 30 GiB. Tier 2 (card + $25): 100 vCPU / 200 GiB. Tier 3 ($500): 250 vCPU. Tier 4 ($2,000/30 days): 500 vCPU. At 2 vCPU per project, Tier 2 gives 50 concurrent projects. Sandbox creation 300-600/min. https://www.daytona.io/docs/en/limits/
- TypeScript SDK: `@daytona/sdk` 0.207.1. The old `@daytonaio/sdk` is deprecated with "same API, no breaking changes". SDK has WebSocket state updates. https://registry.npmjs.org/@daytona/sdk ; https://registry.npmjs.org/@daytonaio/sdk
- Company note: a third-party source says Daytona closed its production source in June 2026 (UNVERIFIED).
- Node 22 + pnpm + Expo: custom snapshots from Dockerfile. 10 GiB disk cap is tight for Expo + Vite `node_modules` plus pnpm store, but workable.

### 5.4 Modal Sandboxes

- Isolation: gVisor. https://modal.com/docs/guide/security
- Cold start: sub-second claim; a third party reports 1-5 s under load (UNVERIFIED). https://modal.com/docs/guide/cold-start
- Session length: default 5 min, max 24 h. `idle_timeout` / `idleTimeoutMs` ends the sandbox after inactivity; open tunnel TCP connections count as activity. https://modal.com/docs/guide/sandbox ; https://modal.com/docs/sdk/js/latest/Sandbox
- Snapshots: filesystem snapshot becomes an Image (diff from base, 30-day TTL, or none). Memory snapshots are experimental: `_experimental_enable_snapshot`, 7-day TTL, no GPU, snapshot terminates the sandbox, cannot snapshot during `exec`, same instance type required. https://modal.com/docs/guide/sandbox-snapshots
- Disk: default 512 GiB quota; up to 3 TiB ephemeral; disk requests raise memory billing 20:1. Volumes for persistence. https://modal.com/docs/guide/resources
- Ports and preview URL: `encrypted_ports`, `unencrypted_ports`, `h2_ports`; `sandbox.tunnels()` returns `*.w.modal.host` URLs. Tunnels are "public and unauthenticated"; Sandbox Connect Tokens add auth for HTTP/WebSocket. Custom domains on Team and Enterprise. https://modal.com/docs/guide/sandbox-networking
- Egress: `block_network`, `outbound_cidr_allowlist`, `outbound_domain_allowlist` (TLS 443 only), `inboundCidrAllowlist`; runtime updates experimental. https://modal.com/docs/guide/sandbox-networking ; https://modal.com/docs/sdk/js/latest/Sandbox
- Secrets: Modal Secrets injected as env vars. https://modal.com/docs/guide/sandbox
- CPU/RAM: default 0.125 core / 128 MiB; soft CPU limit 16 cores above request; hard memory limit optional. https://modal.com/docs/guide/resources
- Regions: `eu`, `eu-west` (Dublin), `eu-north`, `eu-south`. Broad region 1.15x, narrow region 1.75x price multiplier. https://modal.com/docs/guide/region-selection
- Pricing (Sandbox rates): CPU $0.00003942 per core-second = $0.142/core-h; memory $0.00000667 per GiB-second = $0.024/GiB-h. Starter $0 with $30/month credit and 100 containers; Team $250/month with $100 credit and 5,000 containers. https://modal.com/pricing
- TypeScript SDK: `modal` 0.9.0 on npm, moved into `modal-labs/modal-client`. Younger than the Python SDK; V2 sandboxes via `experimentalCreate()`. https://www.npmjs.com/package/modal ; https://modal.com/docs/sdk/js/latest/Sandbox
- Node 22 + pnpm + Expo: any image. gVisor has "higher per-system call overhead"; file-watcher-heavy dev servers may feel it (UNVERIFIED for Vite/Metro). https://gvisor.dev/docs/

### 5.5 Cloudflare Sandbox SDK and Containers

- Isolation: "Each container instance runs inside its own VM". The VM technology is not named. Images must be `linux/amd64`. https://developers.cloudflare.com/containers/platform-details/architecture/
- Cold start: "often in the 1-3 second range". Images are pre-fetched globally. https://developers.cloudflare.com/containers/platform-details/architecture/
- Session length and idle: `sleepAfter` default `"10m"`; `keepAlive: true` sends heartbeats every 30 s. https://developers.cloudflare.com/sandbox/configuration/sandbox-options/ ; https://developers.cloudflare.com/sandbox/concepts/sandboxes/
- Persistence: "All disk is ephemeral." On sleep "All files are deleted / All processes terminate". Directory backups snapshot a directory to R2 and `restoreBackup()` mounts it with a FUSE overlay; "restored files do not survive sleep unless you restore again". Vite's `node_modules/.vite/deps` can hit `EXDEV` errors on the overlay. https://developers.cloudflare.com/sandbox/concepts/sandboxes/ ; https://developers.cloudflare.com/sandbox/concepts/backup-restore/
- Ports and preview URL: `sandbox.exposePort(port, { hostname, token })` gives `https://{port}-{sandbox-id}-{token}.yourdomain.com`. Token is 16 chars, auto or custom. Needs your wildcard domain. Port 3000 reserved. HTTP only, no raw TCP. https://developers.cloudflare.com/sandbox/concepts/preview-urls/
- Egress: not documented for the Sandbox SDK in the fetched pages (UNVERIFIED).
- Secrets: env vars via Worker bindings; the options page does not list `envVars`. https://developers.cloudflare.com/sandbox/configuration/
- CPU/RAM/disk: lite 1/16 vCPU 256 MiB 2 GB; basic 1/4 vCPU 1 GiB 4 GB; standard-1 1/2 vCPU 4 GiB 8 GB; standard-2 1 vCPU 6 GiB 12 GB; standard-3 2 vCPU 8 GiB 16 GB; standard-4 4 vCPU 12 GiB 20 GB. Custom up to 4 vCPU / 12 GiB / 20 GB. https://developers.cloudflare.com/containers/platform/limits/
- Regions: "Region:Earth". "The first request to a sandbox determines its geographic location." No pin. https://developers.cloudflare.com/sandbox/concepts/sandboxes/
- Pricing: CPU $0.000020 per vCPU-second = $0.072/vCPU-h (actual use); memory $0.0000025 per GiB-second = $0.009/GiB-h (provisioned); disk $0.00000007 per GB-second = $0.00025/GB-h; egress $0.025/GB NA/EU. Workers Paid ($5/month) includes 375 vCPU-min, 25 GiB-h, 200 GB-h, 1 TB egress. Billed per 10 ms; nothing while asleep. https://developers.cloudflare.com/containers/platform/pricing/
- Account limits: 1,500 concurrent vCPU, 6 TiB memory, 30 TB disk, 50 GB image storage. https://developers.cloudflare.com/containers/platform/limits/
- TypeScript SDK: `@cloudflare/sandbox` 0.12.9 (pre-1.0). RPC transport to avoid subrequest limits. https://registry.npmjs.org/@cloudflare/sandbox ; https://developers.cloudflare.com/sandbox/platform/limits/
- Node 22 + pnpm + Expo: any amd64 image; 20 GB disk cap.

### 5.6 Fly.io Machines and Sprites

Machines:

- Isolation: Firecracker microVM (Fly is listed as a Firecracker user; suspend uses "Firecracker snapshots"). https://firecracker-microvm.github.io/ ; https://fly.io/docs/reference/suspend-resume/
- Cold start: "started and stopped at subsecond speeds"; resume from suspend "a few hundred ms"; cold start "approximately 2+ seconds for typical applications". https://fly.io/docs/machines/ ; https://fly.io/docs/reference/suspend-resume/
- Lifecycle: `start`, `stop`, `suspend`, `wait` endpoints. Stop resets the rootfs to the image; suspend keeps memory and filesystem. Suspend not recommended above 2 GB RAM; no swap; snapshots invalidated by deploys. https://fly.io/docs/machines/api/machines-resource/ ; https://fly.io/docs/reference/suspend-resume/
- Persistence: volumes $0.15/GB-month; volume snapshots $0.08/GB-month; stopped rootfs $0.15/GB per 30 days. Volumes can die with the host; keep off-box backups. https://fly.io/docs/about/pricing/ ; https://fly.io/docs/blueprints/per-user-dev-environments/
- Preview URL: you build routing. Per-user dev environment blueprint: a router app uses `fly-replay` on a wildcard domain to reach per-user apps; pre-create app pools; single-app designs leak network between users and the proxy autostop "stops or suspends at most one Machine per region each pass". https://fly.io/docs/blueprints/per-user-dev-environments/
- Egress: network policies allow by port and protocol; once one egress rule exists the default is deny; policies "do not affect traffic routed through the Fly Proxy"; machines must restart for changes. No domain filter in the docs. https://fly.io/docs/machines/guides-examples/network-policies/
- Secrets: env in machine config, Fly secrets. https://fly.io/docs/machines/runtime-environment/
- CPU/RAM: shared and performance kinds; shared max 2 GB per CPU, performance max 8 GB per CPU; e.g. 4 performance CPUs up to 32 GB. https://fly.io/docs/machines/guides-examples/machine-sizing/
- Regions: ams, fra, lhr, cdg, arn in EU. https://fly.io/docs/about/pricing/
- Pricing (Amsterdam): shared-cpu-2x 1 GB $6.64/month, shared-cpu-4x 2 GB $13.27/month, performance-2x 4 GB $64.39/month; extra RAM about $5/GB/month; egress $0.02/GB NA/EU. https://fly.io/docs/about/pricing/
- SDK: REST Machines API; no official TypeScript SDK found in fetched pages (UNVERIFIED).

Sprites (Fly's agent-sandbox product, launched January 2026):

- `@fly/sprites` npm SDK, `SpritesClient(token)`, REST at `https://api.sprites.dev/v1`, checkpoint create/restore endpoints, DNS-based network policy. https://sprites.dev/api
- Third-party reports: KVM isolation, 100 GB sparse NVMe, 1-2 s create, running/warm/cold states, $0.07/CPU-hour, $0.04375/GB-hour, hot storage about $0.50/GB-month, cold $0.02/GB-month (UNVERIFIED; the sprites.dev home page redirected to a CLI page). https://simonwillison.net/2026/Jan/9/sprites-dev/ ; https://rywalker.com/research/sprites
- Regions, preview URL auth, and concurrency: not found in fetched pages (UNVERIFIED).

### 5.7 CodeSandbox SDK

The docs site (`codesandbox.io`) returned 403 and a CAPTCHA to the fetch tool. Facts below come from search snippets of the official docs and from the GitHub README. Treat every number as **UNVERIFIED** until someone opens the pages in a browser.

- Isolation: Firecracker microVM; memory snapshot on hibernate; resume 0.5-2 s; clone a running VM in about 2 s. https://codesandbox.io/blog/how-we-clone-a-running-vm-in-2-seconds ; https://codesandbox.io/docs/sdk/resume
- Lifecycle: `hibernationTimeoutSeconds` default 300 (free) / 1800 (pro), max 86,400. `automaticWakeupConfig: { http, websocket }`. Hibernated sandboxes kept 7 days, then archived. https://codesandbox.io/docs/sdk/create-resume ; https://codesandbox.io/docs/sdk/persistence
- VM tiers: Pico 1 vCPU 2 GB 20 GB (7 credits/h), Nano 2 vCPU 4 GB (10 credits/h), Micro 4 vCPU 8 GB 30 GB (20 credits/h), Small 8 vCPU 16 GB (40 credits/h). $0.01486 per credit. https://codesandbox.io/docs/sdk/specs ; https://codesandbox.io/docs/sdk/pricing
- Preview URL: `https://$SANDBOX_ID-$PORT.csb.app`. `privacy: 'public' | 'private' | 'public-hosts'`. Private hosts need `sdk.hosts.createToken(id)` and `client.hosts.getUrl(port)` signed URLs, headers, or cookies. https://codesandbox.io/docs/sdk/hosts ; https://codesandbox.io/docs/sdk/sandbox-hosts
- Concurrency: 100 concurrent VMs on Builder, 250 on Scale (search snippet). Free 400 credits/month.
- Egress control and regions: not found.
- TypeScript SDK: `@codesandbox/sdk` 2.4.2; needs `CSB_API_KEY`. https://registry.npmjs.org/@codesandbox/sdk ; https://raw.githubusercontent.com/codesandbox/codesandbox-sdk/main/README.md
- Company: CodeSandbox joined Together AI; Together also sells the same sandbox. https://codesandbox.io/blog/joining-together-ai-introducing-codesandbox-sdk

### 5.8 StackBlitz WebContainers (in-browser)

- What it is: "A browser-based runtime for executing Node.js applications and operating system commands, entirely inside your browser tab." https://webcontainers.io/guides/introduction
- Isolation: the user's browser tab. No server compute.
- Requirements: `SharedArrayBuffer` and cross-origin isolation (COOP/COEP headers), HTTPS. Full support only on Chromium browsers; Safari 16.4+ beta; Firefox alpha with preview limits. Only one `WebContainer.boot()` per page. https://webcontainers.io/guides/browser-support ; https://webcontainers.io/guides/quickstart
- Package managers: npm, yarn v1, pnpm run natively. https://blog.stackblitz.com/posts/announcing-native-package-manager-support/
- Node version: not published; multiple Node versions is a roadmap item (UNVERIFIED which version ships today). https://developer.stackblitz.com/platform/webcontainers/roadmap
- Preview: `server-ready` event gives a URL to load in an iframe. No public URL; only that browser can see it. https://webcontainers.io/guides/quickstart
- Persistence: none; you export and import the filesystem.
- Licensing: free for prototypes and open source; "Licensing is required for production usage of the API in a commercial, for-profit setting"; price not public. https://webcontainers.io/enterprise
- Expo: Bolt.new runs Expo projects in WebContainers for web preview. Native device preview from a browser tab is not possible because there is no reachable Metro host. https://support.bolt.new/building/intro-bolt
- Claude Code: cannot run inside. Claude Code is a native binary; WebContainers run Node only. The AI SDK harness needs a network sandbox with an exposed port. This option does not fit the agent runtime plan.
- TypeScript SDK: `@webcontainer/api` 1.6.4. https://registry.npmjs.org/@webcontainer/api

### 5.9 Northflank

- Isolation: "microVM-backed containers" with Kata Containers plus Cloud Hypervisor or Firecracker, or gVisor; "Each workload runs in its own microVM with a dedicated kernel". https://northflank.com/docs/v1/application/sandboxes/sandboxes-on-northflank ; https://northflank.com/docs/v1/application/sandboxes/deploy-sandboxes-on-northflank
- Cold start: "boot in under 1 second". https://northflank.com/docs/v1/application/sandboxes/sandboxes-on-northflank
- Lifecycle: no idle timeout in the docs; pause by scaling to zero, resume by scaling to 1. Ephemeral `/workspace` lost on restart (2 GB to 256 GB). https://northflank.com/docs/v1/application/sandboxes/sandboxes-on-northflank
- Persistence: volumes attached at create (`volumesToAttach`), $0.15/GB-month. https://northflank.com/pricing
- Preview URL: ports get a public DNS name automatically; public or private routing. Auth on URLs not documented (UNVERIFIED). https://northflank.com/docs/v1/application/sandboxes/sandboxes-on-northflank
- Egress: not documented in fetched pages (UNVERIFIED).
- Secrets: `runtimeEnvironment` at deploy. https://northflank.com/docs/v1/application/sandboxes/sandboxes-on-northflank
- CPU/RAM: plans like `nf-compute-200` (2 vCPU, 4 GB); range 0.1-32 vCPU, 256 MB-256 GB. https://northflank.com/pricing
- Regions: US West, US Central, US East, EU West, Asia East; 600 BYOC regions. https://northflank.com/pricing
- Pricing: $0.01667/vCPU-h, $0.00833/GB-h, disk $0.15/GB-month, egress $0.06/GB. Free "Sandbox" plan with 2 services. https://northflank.com/pricing
- TypeScript SDK: `@northflank/js-client` 0.10.1; the registry data shows activity through early 2023, so the client may lag the API (UNVERIFIED). https://registry.npmjs.org/@northflank/js-client
- Fit: the API is service-shaped (projects, services, volumes), not sandbox-shaped. Cheapest managed microVM per hour.

### 5.10 Blaxel

- Isolation: "lightweight virtual machines" with OverlayFS (EROFS base + tmpfs writable layer). About 50% of RAM is reserved for the tmpfs filesystem. https://docs.blaxel.ai/Sandboxes/Overview
- Cold start: "sub-25ms cold starts" (resume from standby). https://docs.blaxel.ai/Sandboxes/Overview
- Lifecycle: standby after about 15 s of inactivity with a memory + filesystem snapshot; archive keeps the filesystem only; TTL and `expires` policies; tiers 0 and 1 force deletion after 7 and 30 days, higher tiers unlimited. https://docs.blaxel.ai/Sandboxes/Overview ; https://docs.blaxel.ai/Sandboxes/Expiration.md
- Persistence: volumes $0.12/GB-month; Agent Drive shared filesystem; snapshot storage $0.20/GB-month. https://blaxel.ai/pricing ; https://docs.blaxel.ai/llms.txt
- Preview URL: `https://[id].us-pdx-1.preview.bl.run`. Public, or private with `bl_preview_token` query parameter or `X-Blaxel-Preview-Token` header; tokens have an expiry you set. Custom domains with wildcard. Port 80 reserved; bind to `$HOST`. Separate authenticated port API `.../port/{n}` with bearer token. https://docs.blaxel.ai/Sandboxes/Preview-url ; https://docs.blaxel.ai/Sandboxes/Ports.md
- Egress: optional iptables; egress proxy with header injection; dedicated egress gateways. https://docs.blaxel.ai/Sandboxes/Overview ; https://docs.blaxel.ai/llms.txt
- Secrets: env vars and proxy secret injection. https://docs.blaxel.ai/llms.txt
- CPU/RAM: memory sets cores (4 GB -> 4 cores, 16 GB -> 6 cores); standard cap 50 GB. https://docs.blaxel.ai/Sandboxes/Overview ; https://blaxel.ai/pricing
- Regions: us-pdx-1, us-was-1, eu-lon-1, eu-fra-1, auto. Some regions need a support request. https://docs.blaxel.ai/Infrastructure/Regions
- Pricing: $0.0000115 per GB-RAM-second = $0.0414/GB-h, CPU included; free tier $200 credit and 10 sandboxes; tiers up to 100,000 sandboxes. https://blaxel.ai/pricing
- TypeScript SDK: `@blaxel/core` 0.3.17; `SandboxInstance.createIfNotExists()`. https://registry.npmjs.org/@blaxel/core ; https://docs.blaxel.ai/Sandboxes/Overview
- Fit: good technical match (instant resume, EU, query-token previews). Young vendor; tier TTLs and quotas need a contract for a production builder.

### 5.11 Runloop

- Isolation: "virtual machine technology". Starter image has Node 22.15.0 and Python 3.12. https://docs.runloop.ai/docs/devboxes/overview
- Cold start: "a few seconds". https://docs.runloop.ai/docs/devboxes/overview
- Lifecycle: default max lifetime 1 hour; `keep_alive_time_seconds` or `lifecycle.after_idle` with `suspend` or `shutdown`. Suspend keeps disk only: "Only disk state, not in-memory state is preserved". Processes must restart on resume. Suspend/resume needs the Pro plan ($250/month). https://docs.runloop.ai/docs/devboxes/start-stop ; https://docs.runloop.ai/docs/devboxes/lifecycle ; https://www.runloop.ai/pricing
- Preview URL: `https://{port}-{tunnel_key}.tunnel.runloop.ai`; open or bearer-token mode; one tunnel per devbox; `wake_on_http` resumes suspended devboxes. https://docs.runloop.ai/docs/devboxes/tunnels
- Egress: network policies. https://docs.runloop.ai/docs/network-policies
- Sizes: X_SMALL 0.5 vCPU/1 GB $0.0806/h; SMALL 1/2 GB $0.1598/h; MEDIUM 2/4 GB $0.3195/h; LARGE 2/8 GB $0.4231/h; X_LARGE 4/16 GB $0.8407/h; custom 0.5-16 vCPU, 1-64 GiB, 2-64 GiB disk. https://docs.runloop.ai/docs/devboxes/configuration/sizes
- Pricing: CPU $0.108/CPU-h, memory $0.0252/GB-h, devbox storage $0.00034236/GB-h, snapshots $0.000072/GB-h. Basic $0 + usage; Pro $250/month + usage; $50 trial credit with 3 devboxes. https://www.runloop.ai/pricing
- Regions: not documented (UNVERIFIED).
- TypeScript SDK: `@runloop/api-client` 1.31.0. https://registry.npmjs.org/@runloop/api-client

### 5.12 AWS Lambda MicroVMs (new, June 2026)

Not on the requested list, but it is the newest Firecracker-based managed option and has an EU region.

- Isolation: Firecracker. Launch from a pre-initialized image snapshot. https://docs.aws.amazon.com/lambda/latest/dg/lambda-microvms-guide.html
- Lifecycle: suspend and resume by idle policy (`maxIdleDurationSeconds`, `suspendedDurationSeconds`, `autoResumeEnabled`) or API; suspended state kept up to 8 hours. https://docs.aws.amazon.com/lambda/latest/dg/microvms-networking.html ; https://aws.amazon.com/lambda/pricing/
- Preview URL: one HTTPS endpoint per MicroVM, HTTP/1.1, HTTP/2, WebSockets, gRPC, SSE. Every request needs a JWE token in `X-aws-proxy-auth` scoped to MicroVM, ports, and expiry. Target port via `X-aws-proxy-port` header or WebSocket subprotocol; default 8080. https://docs.aws.amazon.com/lambda/latest/dg/microvms-networking.html
- Bandwidth cap: 2 vCPU / 4 GB gets 8 MB/s on the endpoint. https://docs.aws.amazon.com/lambda/latest/dg/microvms-networking.html
- Egress: public internet by default; VPC egress connector for private. https://docs.aws.amazon.com/lambda/latest/dg/microvms-networking.html
- Pricing (us-east-1, Graviton): vCPU $0.0000276944/s = $0.0997/vCPU-h; memory $0.0000036667/GB-s = $0.0132/GB-h; burst to 4x baseline billed on use; snapshot write $0.0038/GB, read $0.00155/GB, storage $0.08/GB-month, 1-week minimum for images. https://aws.amazon.com/lambda/pricing/
- Regions: us-east-1, us-east-2, us-west-2, ap-northeast-1, eu-west-1 (third-party summary of the launch post, UNVERIFIED). https://www.infoq.com/news/2026/06/aws-lambda-microvms/
- Fit: the header-only token blocks direct iframe use; the endpoint bandwidth cap is low for Metro bundles and Vite HMR; the 8-hour suspend cap does not fit multi-day projects without extra work.

### 5.13 Self-hosted Firecracker or gVisor

- Firecracker: "Boot in <125ms", "<5 MiB overhead per VM", "up to 150 microVMs per second per host". Snapshots are production-ready (diff snapshots in developer preview). Snapshot restore uses `MAP_PRIVATE` mmap of the memory file. Restoring one snapshot into many VMs reuses random seeds and tokens; network connectivity is not guaranteed after resume. https://firecracker-microvm.github.io/ ; https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md
- Host needs: read/write `/dev/kvm`. On EC2 "only supports KVM on `.metal` instance types". So you need bare metal or a cloud with nested virtualization. https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md
- gVisor: user-space kernel (Sentry) that intercepts syscalls; lower footprint than a VM; "higher per-system call overhead"; checkpoint/restore exists with socket and CPU-feature limits. https://gvisor.dev/docs/ ; https://gvisor.dev/docs/user_guide/checkpoint_restore/
- E2B infra is the most complete open-source control plane (Apache-2.0, Terraform, Nomad, Consul, Firecracker; GCP supported, AWS beta). https://github.com/e2b-dev/infra
- Cost: bare-metal prices vary; not researched here (UNVERIFIED). Engineering cost: orchestration, snapshots, routing, auth, egress proxy, quotas, and on-call.
- Fit: not for the first V2 release. Revisit when monthly sandbox spend exceeds the cost of one engineer.

## 6. Cross-cutting findings

### 6.1 AI SDK harness only ships a Vercel Sandbox adapter today

- The harness index lists adapters for Claude Code, Cline, Codex, Cursor, fx, Grok Build, OpenCode, Pi, and ACP. The only sandbox package shown is `@ai-sdk/sandbox-vercel`. https://ai-sdk.dev/providers/ai-sdk-harnesses
- The Claude Code adapter "requires a network sandbox with at least one exposed port" and "streams Claude Code events back to the host over a sandbox-exposed WebSocket". https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- The feature was announced on 2026-06-12 as experimental on the canary channel; the npm `latest` tag is now 1.0.104. https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk ; https://registry.npmjs.org/@ai-sdk/harness-claude-code
- Consequence: any provider other than Vercel needs a custom sandbox adapter that implements the harness sandbox interface (create, run command, expose port, WebSocket). The interface is not documented in the fetched pages (UNVERIFIED). Budget this work if the fallback provider is chosen.

### 6.2 Claude Code inside the sandbox

- Claude Code needs 4 GB+ RAM and an internet path to Anthropic. The native installer does not need Node. The npm package needs Node 22+. https://code.claude.com/docs/en/setup
- Vercel's universal image includes "coding agents" and rebuilds nightly. https://vercel.com/docs/sandbox/concepts/images
- Keep `ANTHROPIC_API_KEY` out of the VM where possible. Vercel and E2B can inject headers at the egress proxy. https://vercel.com/docs/sandbox/concepts/firewall ; https://docs.e2b.dev/network/internet-access

### 6.3 Preview URL and iframe auth

An iframe navigation cannot set custom headers. This sorts the providers:

- Works directly in an iframe: Daytona signed URL (token in hostname), Blaxel `bl_preview_token` query param, Cloudflare token in hostname, CodeSandbox signed host URL, Runloop open mode.
- Needs your own proxy or app-level auth: Vercel (public URL), E2B (`e2b-traffic-access-token` header), Daytona standard token (header), Modal (public tunnel or connect token), AWS (JWE header), Runloop authenticated mode (bearer).

Recommended design for any provider: put a wandit preview proxy on the existing Cloudflare Worker (`apps/edge`) under a wildcard host such as `*.preview.wandit.app`. The Worker checks the wandit session cookie, looks up the sandbox host in KV, and forwards the request with the provider token header. WebSockets for Vite HMR and Metro must pass through. This also hides the vendor hostname and lets you change vendors without changing the client. Vercel bills exposed-port traffic at $0.15/GB, so keep HMR payloads small. https://vercel.com/docs/sandbox/pricing

### 6.4 Expo and Metro in a cloud sandbox

- Metro listens on 8081 by default. `EXPO_PACKAGER_PROXY_URL` forces the packager URL that the device opens (`exp://...`). `--tunnel` uses ngrok and is slow; it is not needed when the sandbox exposes the port. https://docs.expo.dev/more/expo-cli/
- Expo Go or a dev client on the user's phone can load the bundle from the public preview URL if the URL is reachable without a custom header. Use the same wandit proxy with a short-lived signed URL for the phone.
- Web preview in the iframe: `npx expo start --web` or the Vite app. Native rendering in the browser is not possible from any sandbox.
- Simulator or emulator streaming cannot run inside these sandboxes. iOS Simulator needs macOS. Android Emulator needs nested KVM, which Firecracker guests and gVisor do not expose. This is a separate service decision (for example a device-cloud vendor) and is out of scope here. See `docs/v2/research/inspect-native-and-simulator.md` for the native side.
- Expo SDK 57 needs Node 22.13+. Vercel `node:22` and `node:24` images, Runloop's starter image (Node 22.15.0), and any custom Dockerfile satisfy this. https://docs.expo.dev/versions/latest/ ; https://docs.runloop.ai/docs/devboxes/overview

### 6.5 Cost model for one project hour

Assume 2 vCPU / 4 GB, 60 minutes of wall time, 10 minutes of real CPU work.

| Provider | Compute for that hour | Storage per project-month at 3 GB | Fixed monthly |
| --- | --- | --- | --- |
| Vercel Sandbox | Memory 4 GB x $0.0212 = $0.085; CPU 2 x (10/60) x $0.128 = $0.043; total ~$0.13 | $0.24 (snapshot $0.08/GB) | Pro $20 (includes $20 credit) |
| E2B | $0.166 | not published | Pro $150 for >1 h sessions |
| Daytona | $0.166 | disk beyond 5 GiB only | none; card + $25 for Tier 2 |
| Modal | $0.38 (x1.15-1.75 in EU) | image snapshot storage not priced here | Team $250 for >100 containers |
| Cloudflare (standard-3) | memory 8 GiB x $0.009 = $0.072; CPU (10/60) x 2 x $0.072 = $0.024; total ~$0.10 | R2 | Workers Paid $5 |
| Fly performance-2x 4 GB | ~$0.09 | volume $0.45 | none |
| Fly shared-cpu-2x + 3 GB extra RAM | ~$0.03 | volume $0.45 | none |
| Northflank | $0.067 | $0.45 | none |
| Blaxel | $0.166 | $0.60 standby snapshot | none |
| Runloop MEDIUM | $0.32 | ~$0.75 | Pro $250 for suspend |
| AWS MicroVMs | ~$0.25 | $0.24 | none |

At 1,000 active projects x 20 hours/month: Vercel ~$2,600, E2B ~$3,300 + $150, Daytona ~$3,300, Cloudflare ~$2,000, Fly performance ~$1,800, Northflank ~$1,300, Modal ~$7,600. Idle-heavy real usage pushes Vercel and Cloudflare down because they bill CPU on use.

## 7. Ranked recommendation

### Rank 1: Vercel Sandbox (primary)

Reasons:

1. It is the only sandbox with a first-party AI SDK harness adapter. The plan to use `HarnessAgent` with Claude Code works on day one. https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
2. Persistence is automatic. Name the sandbox after the wandit project id, call `Sandbox.getOrCreate`, and restart the dev servers in `onResume`. Snapshots cost $0.08/GB-month. https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
3. Firecracker isolation, 64 GB disk, up to 15 ports, 24 h sessions on Pro, 10,000 concurrent sandboxes. https://vercel.com/docs/sandbox/pricing
4. The firewall brokers credentials at the proxy, so the Anthropic key never enters the VM. https://vercel.com/docs/sandbox/concepts/firewall
5. Paris region (`cdg1`) for EU users. https://vercel.com/docs/sandbox/concepts/regions
6. Managed images with Node 22/24/26 and pnpm, rebuilt nightly with coding agents. https://vercel.com/docs/sandbox/concepts/images
7. Active-CPU billing fits an idle-heavy builder.

Costs of this choice:

- Preview URLs are public. Front them with the wandit proxy (section 6.3) or add app-level auth.
- No memory snapshot. Dev servers restart on each resume; budget a few seconds plus Metro cache warmup. Use `onResume` and keep `node_modules` in the snapshot.
- Vendor coupling to Vercel for compute while hosting stays on Cloudflare. The harness abstraction limits the blast radius.
- Exposed-port traffic costs $0.15/GB.

Pilot plan: Pro plan, region `cdg1`, image `vercel/sandbox/node:22` or a custom VCR image with Claude Code, Expo, and pnpm store pre-warmed, 2 vCPU, `timeout` 30 min extended on activity, `keepLastSnapshots: { count: 1 }`, `networkPolicy` allowlist for npm, GitHub, Expo, Supabase, Anthropic via brokering.

### Rank 2: E2B (fallback)

Reasons: most mature sandbox SDK, Firecracker, pause keeps memory so dev servers survive a resume, indefinite pause retention, EU cluster on Pro, egress allow/deny lists, header-token URL protection. Costs: $150/month Pro is required for sessions over 1 hour; no harness adapter, so a custom sandbox adapter is needed; header token needs the wandit proxy for iframes; concurrency above 100 costs extra.

### Rank 3: Daytona (low-cost EU alternative)

Reasons: same compute rates as E2B with no monthly fee, `eu` target, signed preview URLs that work in an iframe, 15-minute auto-stop with cheap stopped state, archive after 7 days. Costs: container isolation (Sysbox) by default, 4 vCPU / 8 GiB / 10 GiB caps, egress locked on low tiers, custom harness adapter needed, reports that the code went closed source (UNVERIFIED).

### Later cost lever: Fly Machines or Sprites

Cheapest raw compute with EU regions and full control. Use only after the product proves demand, because routing, auth, pooling, and egress filtering are your work. https://fly.io/docs/blueprints/per-user-dev-environments/

### Not recommended as primary

- Cloudflare Sandbox SDK: disk erased on sleep, 10-minute sleep, no region pin, 0.x SDK. Keep for the preview proxy and publishing, not for the workspace VM.
- Modal: strong platform, but 2-3x the compute price for sandboxes, EU multipliers, experimental memory snapshots, young JS SDK.
- CodeSandbox: capable, but the docs blocked automated fetches, the credit model and 7-day hibernation window add friction, and the vendor changed hands.
- WebContainers: cannot run Claude Code; Chromium-only; no server-side preview for phones; license price unknown.
- Runloop: $250/month for suspend; suspend drops memory; higher hourly price; no EU documented.
- Northflank: cheapest, but service-shaped API and an old JS client.
- AWS MicroVMs: header-only auth, 8-hour suspend cap, endpoint bandwidth cap.
- Self-hosting: later, if spend justifies it.

## 8. Risks

1. AI SDK harness is new (announced 2026-06-12). Breaking changes are likely; pin versions and wrap the adapter behind a wandit interface.
2. Only Vercel has a harness sandbox adapter. Any fallback needs a custom adapter against an interface that is not documented in the fetched pages.
3. Vercel preview URLs are public. A proxy with session checks is mandatory before user data appears in previews.
4. Vercel snapshots keep the filesystem only. Dev-server restarts add seconds on every resume.
5. Exposed-port traffic and egress on Vercel cost $0.15/GB; Vite HMR and Metro bundle traffic add up.
6. EU pricing on Vercel `cdg1` was not captured (the regional table did not render). Confirm before committing.
7. Concurrency caps: E2B 100 on Pro; Daytona 100 vCPU on Tier 2; Blaxel 10 on the free tier. Plan quota requests early.
8. Simulator or emulator streaming is impossible inside every sandbox in this report. That feature needs a separate vendor.
9. Sandbox disk caps (Daytona 10 GiB, Cloudflare 20 GB) can block Expo + Vite + pnpm store on one project.
10. Vendor churn: CodeSandbox moved to Together AI; Daytona reportedly closed its source; Sprites is eight months old.

## 9. Unverified claims

- E2B default sandbox timeout value; E2B paused-state storage price; E2B Pro+ and Pro++ add-on prices; E2B default template contents.
- Vercel `cdg1` regional CPU and memory rates.
- Daytona: which runners use Firecracker; the June 2026 closed-source report.
- Modal: observed 1-5 s cold starts (third party); gVisor overhead for Vite and Metro file watchers.
- Cloudflare Sandbox SDK egress controls.
- Fly: no official TypeScript SDK for Machines; Sprites prices, isolation, regions, and preview-URL auth (third-party or missing pages).
- All CodeSandbox numbers (docs blocked by CAPTCHA): VM tiers, credit price, concurrency, hibernation windows, host tokens.
- WebContainers Node version and commercial license price.
- Northflank preview URL auth, egress controls, and JS client freshness.
- Runloop regions.
- AWS MicroVMs region list.
- Self-hosted bare-metal costs.
- The AI SDK harness sandbox interface shape for third-party adapters.

## 10. Method

- Loaded WebSearch and WebFetch. Fetched official docs and pricing pages for each provider. Used search snippets only where a site blocked fetches (CodeSandbox) or where the docs did not exist (Sprites).
- Read `apps/edge/wrangler.jsonc`, `apps/server/package.json`, `apps/web/package.json`, `apps/native/package.json`, and the root `package.json` in the `v2-builder` worktree.
- No code was changed. No commits were made.

## 11. Open questions for Zack

1. Is an EU region a hard requirement for launch, or is `iad1` acceptable for the preview environment?
2. Which plan does the Vercel team already have? Pro is needed for 24 h sessions.
3. Do we accept that dev servers restart on each resume (Vercel), or do we need memory-preserving pause (E2B) from the start?
4. How many concurrent active projects are expected in month 1 and month 6? This decides quota requests.

## 12. Sources

Vercel:
- https://vercel.com/docs/sandbox
- https://vercel.com/docs/sandbox/pricing
- https://vercel.com/docs/sandbox/concepts
- https://vercel.com/docs/sandbox/concepts/persistent-sandboxes
- https://vercel.com/docs/sandbox/concepts/firewall
- https://vercel.com/docs/sandbox/concepts/regions
- https://vercel.com/docs/sandbox/concepts/images
- https://vercel.com/docs/sandbox/sdk-reference
- https://vercel.com/docs/sandbox/working-with-sandbox
- https://registry.npmjs.org/@vercel/sandbox
- https://ai-sdk.dev/providers/ai-sdk-harnesses
- https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk
- https://registry.npmjs.org/@ai-sdk/harness-claude-code

E2B:
- https://e2b.dev/
- https://e2b.dev/pricing
- https://docs.e2b.dev/billing.md
- https://docs.e2b.dev/faq/calculate-sandbox-price.md
- https://docs.e2b.dev/faq/eu-region.md
- https://docs.e2b.dev/sandbox.md
- https://docs.e2b.dev/sandbox/persistence
- https://docs.e2b.dev/sandbox/snapshots.md
- https://docs.e2b.dev/network/public-url
- https://docs.e2b.dev/network/restrict-public-access.md
- https://docs.e2b.dev/network/internet-access
- https://docs.e2b.dev/llms.txt
- https://registry.npmjs.org/e2b
- https://github.com/e2b-dev/infra

Daytona:
- https://www.daytona.io/pricing
- https://www.daytona.io/docs/en/sandboxes/
- https://www.daytona.io/docs/en/persistence/
- https://www.daytona.io/docs/en/isolation/
- https://www.daytona.io/docs/en/limits/
- https://www.daytona.io/docs/en/network-limits/
- https://www.daytona.io/docs/en/preview-and-authentication/
- https://www.daytona.io/docs/en/typescript-sdk/sandbox/
- https://registry.npmjs.org/@daytona/sdk
- https://registry.npmjs.org/@daytonaio/sdk

Modal:
- https://modal.com/pricing
- https://modal.com/docs/guide/sandbox
- https://modal.com/docs/guide/sandbox-networking
- https://modal.com/docs/guide/sandbox-snapshots
- https://modal.com/docs/guide/security
- https://modal.com/docs/guide/region-selection
- https://modal.com/docs/guide/resources
- https://modal.com/docs/guide/cold-start
- https://modal.com/docs/sdk/js/latest/Sandbox
- https://www.npmjs.com/package/modal

Cloudflare:
- https://developers.cloudflare.com/sandbox/
- https://developers.cloudflare.com/sandbox/concepts/sandboxes/
- https://developers.cloudflare.com/sandbox/concepts/preview-urls/
- https://developers.cloudflare.com/sandbox/concepts/backup-restore/
- https://developers.cloudflare.com/sandbox/configuration/sandbox-options/
- https://developers.cloudflare.com/sandbox/platform/limits/
- https://developers.cloudflare.com/sandbox/platform/pricing/
- https://developers.cloudflare.com/containers/
- https://developers.cloudflare.com/containers/platform/pricing/
- https://developers.cloudflare.com/containers/platform/limits/
- https://developers.cloudflare.com/containers/platform-details/architecture/
- https://registry.npmjs.org/@cloudflare/sandbox

Fly.io:
- https://fly.io/docs/about/pricing/
- https://fly.io/docs/machines/
- https://fly.io/docs/machines/api/machines-resource/
- https://fly.io/docs/reference/suspend-resume/
- https://fly.io/docs/machines/guides-examples/machine-sizing/
- https://fly.io/docs/machines/guides-examples/network-policies/
- https://fly.io/docs/machines/runtime-environment/
- https://fly.io/docs/blueprints/per-user-dev-environments/
- https://sprites.dev/api
- https://simonwillison.net/2026/Jan/9/sprites-dev/ (third party)
- https://rywalker.com/research/sprites (third party)

CodeSandbox (search snippets and README only):
- https://codesandbox.io/docs/sdk/create-resume
- https://codesandbox.io/docs/sdk/specs
- https://codesandbox.io/docs/sdk/pricing
- https://codesandbox.io/docs/sdk/persistence
- https://codesandbox.io/docs/sdk/hosts
- https://codesandbox.io/docs/sdk/sandbox-hosts
- https://codesandbox.io/blog/how-we-clone-a-running-vm-in-2-seconds
- https://raw.githubusercontent.com/codesandbox/codesandbox-sdk/main/README.md
- https://registry.npmjs.org/@codesandbox/sdk

WebContainers:
- https://webcontainers.io/guides/introduction
- https://webcontainers.io/guides/quickstart
- https://webcontainers.io/guides/browser-support
- https://webcontainers.io/guides/api-support
- https://webcontainers.io/enterprise
- https://blog.stackblitz.com/posts/announcing-native-package-manager-support/
- https://developer.stackblitz.com/platform/webcontainers/roadmap
- https://registry.npmjs.org/@webcontainer/api

Northflank:
- https://northflank.com/pricing
- https://northflank.com/docs/v1/application/sandboxes/sandboxes-on-northflank
- https://northflank.com/docs/v1/application/sandboxes/deploy-sandboxes-on-northflank
- https://registry.npmjs.org/@northflank/js-client

Blaxel:
- https://blaxel.ai/pricing
- https://docs.blaxel.ai/Sandboxes/Overview
- https://docs.blaxel.ai/Sandboxes/Preview-url
- https://docs.blaxel.ai/Sandboxes/Ports.md
- https://docs.blaxel.ai/Sandboxes/Expiration.md
- https://docs.blaxel.ai/Infrastructure/Regions
- https://docs.blaxel.ai/llms.txt
- https://registry.npmjs.org/@blaxel/core

Runloop:
- https://www.runloop.ai/pricing
- https://docs.runloop.ai/docs/devboxes/overview
- https://docs.runloop.ai/docs/devboxes/tunnels
- https://docs.runloop.ai/docs/devboxes/configuration/sizes
- https://docs.runloop.ai/docs/devboxes/lifecycle
- https://docs.runloop.ai/docs/devboxes/start-stop
- https://docs.runloop.ai/llms.txt
- https://registry.npmjs.org/@runloop/api-client

AWS:
- https://docs.aws.amazon.com/lambda/latest/dg/lambda-microvms-guide.html
- https://docs.aws.amazon.com/lambda/latest/dg/microvms-networking.html
- https://aws.amazon.com/lambda/pricing/
- https://www.infoq.com/news/2026/06/aws-lambda-microvms/ (third party)

Firecracker and gVisor:
- https://firecracker-microvm.github.io/
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md
- https://gvisor.dev/docs/
- https://gvisor.dev/docs/user_guide/checkpoint_restore/

Toolchain:
- https://code.claude.com/docs/en/setup
- https://docs.expo.dev/more/expo-cli/
- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/get-started/start-developing/
- https://support.bolt.new/building/intro-bolt
