# V2 unit economics: prices, competitor pricing, cost per message, credit mapping

Report id: `unit-economics`
Worktree: `.claude/worktrees/v2-builder` (branch `feat/v2-builder`, same as `dev` at `1b2a9a1e`).
Date: 2026-09-03.

All prices are list prices in USD. I fetched each price page on 2026-09-03 unless a note says otherwise. Items I could not confirm from a primary source carry the tag **UNVERIFIED**. Repo paths are relative to the worktree root. Line numbers come from the worktree at the date above.

Method note: the session web-search budget was exhausted before this task started. I used direct fetches of official pages, doc indexes (`llms.txt`), the Hacker News Algolia API, and one Brave search result page. Secondary sources (Sacra, Brave snippets, HN summaries) are marked as such.

---

## 0. Short summary

- Anthropic list prices (2026-09-03): Sonnet 5 $2 / $10 per MTok (cache read $0.20, 5-min write $2.50); Opus 5 $5 / $25 (read $0.50, write $6.25); Fable 5.1 $10 / $50 (read $0.25, write $12.50); Haiku 4.5 $1 / $5. Batch API is 50 percent off. Claude 4.7+ models use a tokenizer that produces about 30 percent more tokens.
- Anthropic's own Claude Code numbers: about $13 per developer per active day, $150-250 per developer per month, 90 percent of users under $30 per active day. Third-party session reports range from $0.33 per small task to $15-30 for long autonomous sessions.
- The Claude Agent SDK reports `total_cost_usd` and `modelUsage` on the `result` message. Anthropic says these are client-side estimates, not billing data. Bill from token counts times your own price table, and reconcile with the Usage and Cost API.
- Sandbox compute at 2 vCPU / 4 GB: E2B $0.166/h, Daytona $0.166/h, Vercel Sandbox $0.085/h memory plus $0.128 per active vCPU-hour (about $0.11-0.15/h at realistic CPU use), Cloudflare Containers standard-3 (2 vCPU / 8 GiB) about $0.09-0.22/h, Modal sandbox $0.24/h (times 1.15-1.75 for region pinning). Anthropic Managed Agents charges $0.08 per running session-hour for comparison.
- Supabase: Pro $25/month includes $10 of compute (one Micro). Every extra project costs a Micro at $0.01344/h (about $10/month). Free plan allows 2 active projects and pauses a project after 1 week of inactivity. Team $599/month. Branching $0.01344 per branch-hour. Egress $0.09/GB beyond 250 GB.
- Appetize.io: Starter $59/month with 500 minutes, then $0.06/min. Premium $319/month, 16 devices. Free: 30 minutes/month, 3-minute sessions.
- Cloudflare Workers for Platforms: $25/month, 20M requests and 60M CPU-ms included, $0.30 per extra million requests, $0.02 per extra million CPU-ms, 1,000 scripts included then $0.02 per script. No egress charge on Workers or static assets.
- Competitors: Lovable Pro $25 for 100 credits ($0.25 per credit at the base tier, $0.225 at the top tier), 0.5-2 credits per build message, 1 credit per plan message. Bolt Pro $25 for 10M tokens ($2.50 per million tokens). v0 sells dollar credits at pass-through model prices (v0 Pro $2 / $10 per MTok). Replit Core $20 with $20 of credits, effort-based checkpoint prices from about $0.06 to several dollars. Base44 Starter $16 for 100 message credits ($0.16 per message). Rork Pro $20 for 100 credits ($0.20 per credit).
- Known margins: Lovable was at about 35 percent gross margin in May 2025 ($5.7M revenue, $3.7M model costs) with a 65 percent target for 2026 (leaked deck reported by The Information and Sifted, secondary via Brave snippet). Replit's gross margin "fluctuated between 36% and negative 14% in 2025" (Sacra estimate).
- Worked example (Sonnet 5, harness in a sandbox, prompt caching on): a simple edit costs about $0.14, a typical feature message about $0.40, a large build message about $1.40. Sandbox time is 3-6 percent of the total. On Opus 5 multiply the token part by 2.5. On Fable 5.1 multiply by about 3.5.
- Credit mapping: keep 1 credit = $0.04 of provider cost (`AI_USD_PER_CREDIT`). Typical V2 message = about 10 credits on Sonnet 5, 4 credits for a simple edit, 35 credits for a large build. The current Pro base tier (175 credits, $7 of cost, $25 price) buys about 17 typical V2 messages per month. Lovable sells about 100 messages for the same $25. This gap is the main pricing decision for V2.
- Top non-price risk: Anthropic's Claude Code terms say a product that runs Claude Code in hosted sandboxes "may not pay for, resell, or intermediate Claude usage on their end users' behalf". The Agent SDK terms allow powering products under the Commercial Terms with your own API key. The AI SDK harness installs the Claude Code CLI inside the sandbox. Which clause applies to wandit V2 is **UNVERIFIED**. Confirm with Anthropic sales before launch.

---

## 1. Anthropic model prices

Source: https://platform.claude.com/docs/en/about-claude/pricing (fetched 2026-09-03).

| Model | Input $/MTok | 5-min cache write | 1-hour cache write | Cache read | Output $/MTok | Batch input / output |
|---|---|---|---|---|---|---|
| Claude Fable 5.1 | $10 | $12.50 | $20 | $0.25 | $50 | $5 / $25 |
| Claude Fable 5 | $10 | $12.50 | $20 | $1 | $50 | $5 / $25 |
| Claude Opus 5 | $5 | $6.25 | $10 | $0.50 | $25 | $2.50 / $12.50 |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | $5 | $6.25 | $10 | $0.50 | $25 | $2.50 / $12.50 |
| Claude Sonnet 5 | $2 | $2.50 | $4 | $0.20 | $10 | $1 / $5 |
| Claude Sonnet 4.6 / 4.5 | $3 | $3.75 | $6 | $0.30 | $15 | $1.50 / $7.50 |
| Claude Haiku 4.5 | $1 | $1.25 | $2 | $0.10 | $5 | $0.50 / $2.50 |

Rules that change the bill:

- Cache multipliers: 5-minute write 1.25x input, 1-hour write 2x input, read 0.1x input (0.025x on Fable 5.1 and Mythos 5.1). Multipliers stack with batch and data residency.
- Sonnet 5: "The $2/$10 ... introductory pricing through August 31, 2026, is now the standard price. The previously scheduled increase to $3/$15 ... will not occur."
- Tokenizer: "Claude 4.7 and later models ... produces approximately 30% more tokens for the same text." Sonnet 4.6 and earlier use the older tokenizer. Sonnet 5 and Opus 5 are on the newer tokenizer, so per-token prices understate cost by about 30 percent when you compare with Sonnet 4.6 estimates.
- Long context: 4.6 and later models bill the full 1M window at standard rates. No long-context surcharge.
- Data residency: `inference_geo: "us"` costs 1.1x on all token classes. Global routing is standard price.
- Batch API: 50 percent off input and output. Not useful for an interactive builder; possible for background jobs (SEO text, summaries).
- Fast mode (Opus 5 / Opus 4.8): $10 / $50 per MTok. Not for Batch.
- Tool overhead: tool-use system prompt 286 tokens (Opus 5) or 354 tokens (Sonnet 5) per request; bash tool 325 extra input tokens on Opus 5; text editor 700 tokens. Web search $10 per 1,000 searches. Web fetch free beyond tokens.
- Code execution tool: 1,550 free container-hours per month per organization, then $0.05 per container-hour, 5-minute minimum per execution.
- Managed Agents: tokens at list plus $0.08 per running session-hour. Worked example on the page: a one-hour Opus 5 session with 50K input and 15K output tokens costs $0.705, or $0.525 when 40K of the input is cache reads.

---

## 2. Claude Code cost per task and per session

### 2.1 Anthropic's own numbers

Source: https://code.claude.com/docs/en/costs (fetched 2026-09-03).

- "Across enterprise deployments, the average cost is around $13 per developer per active day and $150-250 per developer per month, with costs remaining below $30 per active day for 90% of users."
- Background usage: "typically under $0.04 per session" for summarization and status calls.
- Cache TTL: "on an API key or cloud provider, it's five minutes by default." The first message after a break longer than the TTL "misses the cache and reprocesses your full context."
- Extended thinking is on by default. "Thinking tokens are billed as output tokens, and the default budget can be tens of thousands of tokens per request depending on the model." Lower `effort` to reduce it. "Disabling thinking is not available on Fable models."
- Agent teams "use approximately 7x more tokens than standard sessions when teammates run in plan mode."
- The `/usage` example shows one session: "claude-sonnet-4-6: 1.2k input, 5.3k output, 940.0k cache read, 50.0k cache write ($0.55)". This shape (cache reads dominate token volume, output dominates cost) is the shape to plan for.

Rate-limit planning table from the same page (tokens per minute per user by team size): 200k-300k TPM for 1-5 users down to 10k-15k TPM for 500+ users. For a builder with many concurrent end users, plan the organization TPM early.

### 2.2 Public user reports

- HN "CodeBurn" (2026-04-13, 112 points, https://github.com/AgentSeal/codeburn): author spent "~$1400/week on Claude Code" and found "56% of spend was on conversation turns with no tool usage". Source: HN Algolia API, objectID 47759035.
- HN "58% cost reduction by replacing file reads with dependency graph" (2026-03-02): "Cost per task: $0.78 -> $0.33". Source: HN Algolia API, objectID 47222316. Small tasks.
- HN "Newer Claude models use more tokens but cost less per task solved" (2026-06-28, objectID 48707468). Title only; body not fetched.
- Brave search snippets (secondary, **UNVERIFIED**): a "TokenCost" page reports simple bug fix about $2-5, complex feature $5-15, autonomous agent sessions $15-30+; "Viberank" (June 2026) notes that almost every page quotes Anthropic's $150-250 per month figure; heavy API users report $200-600 per month.
- Twill.ai (YC S25, HN 2026-04-10) prices "1 credit = $1 of AI compute at cost" with 10 free credits per month. A data point for a USD-anchored credit in the same market.

### 2.3 How the Claude Agent SDK reports cost

Source: https://code.claude.com/docs/en/agent-sdk/cost-tracking (fetched 2026-09-03).

- "The `total_cost_usd` and `costUSD` fields are client-side estimates, not authoritative billing data. The SDK computes them locally from a price table bundled at build time, unless a `modelPricing` table is in effect." "Do not bill end users or trigger financial decisions from these fields."
- The `result` message carries `total_cost_usd`, cumulative `usage`, and `modelUsage` (TypeScript) / `model_usage` (Python). Per model: `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `costUSD`, `costBasis` (`list`, `managed`, `unknown`).
- Subagents: `usage` excludes subagent tokens. `total_cost_usd` and `modelUsage` include them. Use `modelUsage` for whole-tree accounting.
- Per-step assistant messages: parallel tool calls share one message `id`; deduplicate by id. Per-step `output_tokens` is a placeholder; read output tokens from the result.
- Streaming input mode: each turn emits its own `result`; `total_cost_usd` and `modelUsage` are running totals for the call; `/clear` resets them and changes `session_id`.
- Crash: an `error_during_execution` result "may carry zeroed" cost fields; recover from the previous turn's result.
- Budget: `maxBudgetUsd` (TS) / `max_budget_usd` (Python) is compared against `total_cost_usd`; at the cap the SDK refuses new subagents, stops background subagents, and ends with `error_max_budget_usd`. Depth cap `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3), concurrency cap `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (default 20). Source: https://code.claude.com/docs/en/agent-sdk/subagents.
- "Claude Opus 5 delegates to subagents more readily than earlier models, so the depth, concurrency, and spend limits matter most on queries that run Opus 5."
- Cache TTL: `ENABLE_PROMPT_CACHING_1H=1`, or `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` for the main conversation and `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` for the rest.
- Data residency: when `usage.inference_geo` is `"us"` the SDK multiplies list price by 1.1 (TS SDK v0.3.239+, Python v0.2.144+).

What the AI SDK harness exposes: `finish` carries `totalUsage` and `result.usage` on `generate()`; the Claude Code bridge reads `msg.usage` and `msg.total_cost_usd` but the adapter performs "no mapping to `total_cost_usd`, `usage`, or `modelUsage`" to the host. Whether `total_cost_usd` reaches `harnessMetadata['claude-code']` is **UNVERIFIED**. See `docs/v2/research/ai-sdk-harness.md:193-197` and `:326-333`. Plan to price token counts yourself.

Authoritative billing: Usage and Cost Admin API (https://platform.claude.com/docs/en/manage-claude/usage-cost-api) and the Claude Code Analytics API (https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api), which returns per-user per-day `tokens.input/output/cache_read/cache_creation` and `estimated_cost.amount` in cents per model. The Analytics API only covers Claude Code on the Claude API, with 1-hour delay.

---

## 3. Sandbox prices at 2 vCPU / 4 GB

All rates are on-demand list prices, default region, converted to per hour. "Realistic" assumes the CPU is busy 10-25 percent of wall time (a Vite dev server, a Metro bundler, and a harness that mostly waits on the model). See `docs/v2/research/sandboxes.md` section 6.5 for a full per-vendor comparison.

| Vendor | Unit prices | 2 vCPU / 4 GB per hour | Per minute | Fixed fee | Source |
|---|---|---|---|---|---|
| E2B | vCPU $0.000014/s ($0.0504/h); RAM $0.0000045/GiB/s ($0.0162/GiB/h); per second while running | $0.1008 + $0.0648 = **$0.166** | $0.00276 | Hobby $0 (1-hour sessions, 20 concurrent, $100 one-time credit); Pro $150/month (24-hour sessions, 100 concurrent, up to 1,100 with add-ons) | https://e2b.dev/pricing |
| Vercel Sandbox (iad1) | Active CPU $0.128 per vCPU-hour (I/O wait not billed); provisioned memory $0.0212/GB-hour, 1-minute minimum; creations $0.60 per million; network out and exposed-port traffic $0.15/GB, downloads free; snapshots $0.08/GB-month | Memory $0.085 + CPU $0.026 (10 percent) to $0.064 (25 percent) = **$0.11-0.15**; $0.34 at 100 percent CPU | $0.0018-0.0025 | Pro $20/month (includes $20 credit); Hobby free within 5 CPU-hours and 420 GB-hours per month; Pro max session 24 h, 10,000 concurrent | https://vercel.com/docs/sandbox/pricing (last updated 2026-08-21) |
| Daytona | vCPU $0.0504/h; RAM $0.0162/GiB/h; disk $0.000108/GiB/h after 5 GiB free; per second | $0.1008 + $0.0648 = **$0.166** | $0.00276 | None; $200 trial credit; tier caps on total vCPU (see sandboxes.md section 3) | https://www.daytona.io/pricing |
| Modal (Sandbox rate) | CPU $0.00003942 per physical core-second (1 core = 2 vCPU) = $0.142/core-h; memory $0.00000667/GiB-s = $0.024/GiB-h; region pinning 1.15-1.75x | $0.142 + $0.096 = **$0.238** (about $0.27-0.42 pinned to EU) | $0.0040 | Starter $0 with $30/month credit, 100 containers; Team $250/month, $100/month credit, 5,000 containers | https://modal.com/pricing |
| Modal (standard function rate, for reference) | CPU $0.0000131/core-s; memory $0.00000222/GiB-s | $0.047 + $0.032 = $0.079 | | | same |
| Cloudflare Containers | vCPU $0.000020/s ($0.072/vCPU-h) on actual use; memory $0.0000025/GiB-s ($0.009/GiB-h) provisioned; disk $0.00000007/GB-s; egress $0.025/GB NA/EU; billed per 10 ms; no exact 2 vCPU / 4 GiB type (standard-1 is 0.5 vCPU / 4 GiB, standard-3 is 2 vCPU / 8 GiB) | standard-3: memory $0.072 + disk $0.004 + CPU $0.014 (10 percent) to $0.144 (100 percent) = **$0.09-0.22** | $0.0015-0.0037 | Workers Paid $5/month includes 375 vCPU-min, 25 GiB-h, 200 GB-h, 1 TB egress | https://developers.cloudflare.com/containers/platform/pricing/ |
| Anthropic Managed Agents (reference) | $0.08 per session-hour while `running`; idle not billed | $0.08 | $0.0013 | None | https://platform.claude.com/docs/en/about-claude/pricing |
| Anthropic code execution tool (reference) | $0.05 per container-hour beyond 1,550 free hours/month; 5-minute minimum | $0.05 | | | same |

Reading: compute is cheap next to tokens. One hour of sandbox on any vendor costs $0.09-0.24. One hour of active building on Sonnet 5 costs $2-4 in tokens (section 6). The sandbox choice should follow isolation, cold start, preview URL, and region needs, not per-hour price. The vendor fixed fees (E2B Pro $150, Modal Team $250) matter more than the hourly rate at small scale.

---

## 4. Backend, preview, and hosting prices

### 4.1 Supabase

Source: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/compute-and-disk (fetched 2026-09-03).

- Free: "Limit of 2 active projects". "Free projects are paused after 1 week of inactivity". Nano compute (shared CPU, up to 0.5 GB RAM) at $0.
- Pro: $25/month. "Includes $10/month in compute credits, which covers one Micro instance". Every additional project runs at least a Micro instance (2-core shared, 1 GB) at $0.01344/hour, about $10/month. "In paid organizations, Nano Compute are billed at the same price as Micro Compute." "You cannot launch Nano instances on paid plans."
- Team: $599/month.
- Compute ladder (hourly / monthly): Micro $0.01344 / ~$10; Small $0.0206 / ~$15; Medium $0.0822 / ~$60; Large $0.1517 / ~$110; XL $0.2877 / ~$210.
- Branching: $0.01344 per branch per hour (same as Micro).
- Overages on Pro: database $0.125/GB beyond 8 GB; egress $0.09/GB beyond 250 GB; file storage $0.0213/GB beyond 100 GB; MAU $0.00325 beyond 100,000.

Implication: one Supabase project per user project costs about $10/month whether the user does anything or not. At the $0.04 anchor that is 250 credits/month of cost, more than the Pro base tier. One project per user app cannot be a per-credit charge. It must be a plan entitlement with a count limit, an add-on, or a multi-tenant design (one Supabase project per wandit shard, schemas per user app). Lovable Cloud grants 20 credits per month for hosting plus backend, which at $0.25/credit is $5, and states "For most users with smaller or new apps, hosting does not cost anything". That number only works with a shared backend.

### 4.2 Appetize.io (mobile preview streaming)

Source: https://appetize.io/pricing via r.jina.ai (fetched 2026-09-03).

- Free: $0, 2 active devices, 30 minutes/month, 3-minute session limit.
- Starter: $59/month ($708/year with 30 percent annual discount), 3 active devices, 500 minutes included, then $0.06/minute, unlimited session length.
- Premium: $319/month ($3,828/year), 16 active devices, 500 minutes included, then $0.06/minute.
- Enterprise: "Per User or Metered billing", custom.

Implication: a 10-minute mobile preview costs $0.60 at the overage rate, which is 15 credits at $0.04, more than a typical AI message. Meter preview minutes as their own line, or cap them per plan. "Active devices" is a concurrency cap: 3 on Starter means 3 users can stream at once.

### 4.3 Cloudflare Workers for Platforms and bandwidth

Sources: https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/ and https://developers.cloudflare.com/workers/platform/pricing/ (fetched 2026-09-03).

- Workers for Platforms: $25/month. 20 million requests and 60 million CPU-ms included. $0.30 per additional million requests. $0.02 per additional million CPU-ms. 1,000 scripts included, then $0.02 per script per month. No duration charge.
- Workers: "There are no additional charges for data transfer (egress) or throughput (bandwidth)." "Requests to static assets are free and unlimited."
- Cloudflare Containers egress: $0.025/GB in North America and Europe after 1 TB included on Workers Paid.

Comparison bandwidth prices: Vercel Sandbox exposed-port traffic $0.15/GB; Supabase egress $0.09/GB beyond 250 GB; Replit static deployments $0.05/GiB outbound.

Implication: publishing user apps on Cloudflare (Workers for Platforms plus static assets) has near-zero marginal cost per app. 10,000 published apps cost $25 plus $0.02 x 9,000 = $205/month in script fees. Keep the preview iframe on the sandbox only while the agent works, then move the preview to a Cloudflare deploy to avoid the sandbox egress price.

---

## 5. How competitors price

| Product | Free | Paid tiers | Unit | What a unit buys | Daily limit | Source |
|---|---|---|---|---|---|---|
| Lovable | 5 build credits/day, up to 30/month; 20 Cloud credits/month; 4 AI credits/month | Pro $25 for 100 credits, then 200/$50, 400/$100, 800/$200, 1,200/$294, 2,000/$480, 3,000/$705, 4,000/$920, 5,000/$1,125, 7,500/$1,688, 10,000/$2,250. Business is exactly 2x Pro. Annual = 10x monthly. | Credit ($0.25 at the base tier, $0.225 at the top; top-ups $0.30 Pro, $0.60 Business per credit, packs of 50) | Plan Mode: 1 credit per message. Build Mode: variable, "Make the button gray" 0.50, "Remove footer" 0.90, "Add authentication" 1.20, "Build a landing page with images" 1.70-2.00. Cloud usage (database, storage, network, compute, realtime) and AI gateway calls also debit credits; "AI gateway usage rates are based on the underlying provider model costs". | 5 daily build credits on all plans (Free capped at 30/month) | https://docs.lovable.dev/introduction/subscription-plans ; https://docs.lovable.dev/introduction/credits-and-usage ; https://docs.lovable.dev/user-guides/messaging-limits ; https://docs.lovable.dev/features/project-usage |
| Bolt.new | 1M tokens/month, 300K tokens/day | Pro from $25/month "Start at 10M tokens per month"; Teams $30 per member per month; higher Pro tiers exist ("Pro 20", "Pro 50" named in support docs; ladder amounts **UNVERIFIED**) | Token ($2.50 per million at the base tier) | "most token usage is related to syncing your project's file system to the AI: the larger the project, the more tokens used per message." Rollover for 2 months. Reloads only on the highest monthly Pro or annual Pro; reload tokens never expire. | Free only | https://bolt.new/pricing ; https://support.bolt.new/account-and-subscription/tokens |
| v0 | $5 of credits/month, 7 messages/day | Plus $30/user/month with $30 of credits plus $2 free daily credits on login; Business $100/user/month with $30 of credits; Enterprise custom | Dollar credit at per-model token prices: v0 Mini $0.20 / $1.20; v0 Pro $2 / $10; v0 Max $5 / $25; v0 Max Fast $10 / $50 (input / output per MTok; cache read 0.1x, cache write 1.25x) | Tokens at list. v0 Pro equals Sonnet 5 list price; v0 Max equals Opus 5; Max Fast equals Opus fast mode. The plan fee is the margin. | 7 messages/day on Free; $2 daily on paid | https://v0.app/pricing |
| Replit | Starter: daily Agent credits up to a monthly cap, 1 published app | Core $20/month ($17 annual) with "$20 towards most powerful models"; Pro $100/month ($95 annual) with "$100 towards most powerful models", 10 parallel agents; credit packs $100, $300 ($10 off), $500 ($20 off), $1,000 ($50 off), expire after 6 months | Dollar credit; effort-based checkpoint | Was a flat $0.25 per checkpoint. Since mid-2025 "simple changes still result in a single checkpoint, typically costing less than $0.25"; complex tasks cost more. Sacra: "as little as $0.06 and more complex work costing multiple dollars". Modes: Free, Power, Max. Third-party APIs billed "at the provider's public API rate". Publishing: Autoscale $2/month plus $0.60 per million compute units plus $0.40 per million requests; Reserved VM 2 vCPU / 8 GB $50/month; static egress $0.05/GiB. | Daily cap on Starter | https://replit.com/pricing ; https://docs.replit.com/billing/ai-billing ; https://docs.replit.com/billing/managing-spend ; https://replit.com/blog/effort-based-pricing ; https://docs.replit.com/billing/deployment-pricing |
| Base44 | 25 message credits/month, 100 integration credits, 5 apps | Starter $16 (100 messages, 2,000 integration credits); Builder $40 (250, 10,000); Pro $80 (500, 20,000); Elite $160 (1,200, 50,000); annual 20 percent off | Message credit ($0.16 at Starter, $0.13 at Elite) | "Exact usage varies based on the action and the selected AI model." Top-ups available, price not shown. | None stated | https://base44.com/pricing |
| Rork | 35 design credits/month, max 5/day, Design mode only | Pro $20 for 100 credits; Max $200 for 1,000 credits (2.5K, 5K, 10K options) | Credit ($0.20) | Build mode messages; "Credits reset monthly from date of first purchase" | 5/day on Free | https://rork.com/pricing |

Revenue per message at the base tier: Lovable $0.25, Base44 $0.16, Rork $0.20, Replit under $0.25 on Core (a $20 fee buys $20 of checkpoints), Bolt about $0.25-0.60 if a message uses 100K-250K tokens, v0 pass-through plus the seat fee.

### 5.1 Known margins and cost complaints

- Lovable: "Lovable's 65% margin target on leaked pitch deck" (Sifted, 2025-12-03, https://sifted.eu/articles/lovable-margins-leaked-pitch-deck; page returned 403 to my fetch). A Brave search snippet summarizing the same reporting (The Information, via an X post dated 2025-12-03) states May 2025 gross margin of 35 percent on $5.7M revenue with $3.7M of AI model costs, a target of 65 percent by 2026, and a note that the coding assistants "exclude the cost of running AI models for free users from their cost of revenue". Secondary, **UNVERIFIED** against the original article. Sacra estimates Lovable at $500M annualized revenue in May 2026 and 8 million users in February 2026 (https://sacra.com/c/lovable/). Sacra also states "building a basic game might cost $1 in credits, while more complex applications can cost $50 or more."
- Lovable user complaints (Brave snippet of r/lovable, 2026, **UNVERIFIED**): posts titled "Lovable is getting more expensive", claims of "almost 200% increase in the last 2 months" (March 2026). Since Build Mode credit cost varies by task, users cannot predict spend per message.
- Replit: "Replit's gross margins have fluctuated between 36% and negative 14% in 2025, driven by the cost of accessing large language models" (Sacra, https://sacra.com/c/replit/). HN thread "Replit just changed their Pricing..." (2025-06-19, objectID 44322290) on the switch from $0.25 flat to effort-based.
- Bolt: HN "Ask HN: Startup launch destroyed by Bolt.new's AI. 10M tokens gone, no response" (2025-12-19, objectID 46321594). A Chrome extension exists because "Discussion Mode ... uses ~90% fewer tokens than Build Mode" (objectID 44294837). Brave snippets (**UNVERIFIED**): "A single edit could burn 250,000 tokens or more, even for a small change"; users report 4M-6M tokens for one database migration and 20M tokens on one authentication fix loop. Root cause per Bolt's own docs: the whole project is synced to the model each message.
- v0 avoids the argument by pricing in dollars at model list prices. The seat fee ($30 or $100) is the margin. Users see the same opacity as an API bill.

Reading for wandit: every credit-based competitor gets the same complaint, "one message cost more than I expected". Replit and Lovable both moved from flat per-message to variable pricing because flat pricing lost money on long agent runs. A USD-anchored credit with a visible per-message estimate before the run, and a hard per-message budget, is the model that survives this.

---

## 6. Worked example: cost of one V2 user message

### 6.1 Assumptions

- Harness: Claude Agent SDK through the AI SDK harness, running inside a 2 vCPU / 4 GB sandbox. Prompt caching on (the SDK does this automatically).
- Model: Claude Sonnet 5 at $2 input, $2.50 5-minute cache write, $0.20 cache read, $10 output per MTok. Adaptive thinking at `effort: medium`; thinking tokens are billed as output.
- Stable prefix (system prompt, tool definitions, CLAUDE.md, skills index): 18,000 tokens, cached after the first step of a session.
- Prior conversation history when the message arrives: 25,000 tokens (a mid-session message).
- Each API step reads the whole context from cache, adds 3,000 new tokens (tool results, file reads, user text) that are written to the cache, and produces 1,200 output tokens (text plus tool-call JSON plus thinking).
- Sandbox billed for 8 minutes per message on average: 3 minutes of agent work plus a share of the idle time before a 10-15 minute idle stop.

These are estimates. Measure them in the preview environment with `modelUsage` before you set prices.

### 6.2 Token cost per message (Sonnet 5)

| Message type | Steps | Cache reads | Cache writes | Output | Token cost |
|---|---|---|---|---|---|
| Simple edit ("make the button gray") | 4 | 190K tokens x $0.20 = $0.038 | 12K x $2.50 = $0.030 | 4.8K x $10 = $0.048 | **$0.12** |
| Typical feature ("add a lead form with validation") | 12 | 714K x $0.20 = $0.143 | 36K x $2.50 = $0.090 | 14.4K x $10 = $0.144 | **$0.38** |
| Large build ("build the landing page and the admin page") | 30 (4K new input and 1.5K output per step) | 3.03M x $0.20 = $0.606 | 120K x $2.50 = $0.300 | 45K x $10 = $0.450 | **$1.36** |

Cache-read arithmetic for the typical message: context at step k is 18K + 25K + 3K(k-1); the sum over 12 steps is 12 x 43K + 3K x 66 = 714K tokens.

Extra costs that appear per session, not per message:

- First step of a session writes the 18K prefix: 18K x $2.50 = $0.045.
- A cold cache (user paused more than 5 minutes) rewrites the whole context: 60K x $2.50 = $0.15 on the next message. With `ENABLE_PROMPT_CACHING_1H` the write rate doubles to $4/MTok (typical message writes cost $0.144 instead of $0.090) but the rewrite disappears for pauses under one hour. Turn 1-hour TTL on when users send more than one message per hour, which is the normal builder pattern.
- Compaction: one large request when context nears the limit; treat as one extra large step.

### 6.3 Same message on other models

| Model | Simple edit | Typical feature | Large build | Multiplier vs Sonnet 5 |
|---|---|---|---|---|
| Haiku 4.5 (older tokenizer, fewer tokens) | $0.06 | $0.19 | $0.68 | 0.5x |
| Sonnet 5 | $0.12 | $0.38 | $1.36 | 1x |
| Opus 5 | $0.29 | $0.95 | $3.39 | 2.5x |
| Fable 5.1 (cache read $0.25, write $12.50, output $50) | $0.44 | $1.35 | $4.51 | about 3.5x |

Fable 5.1 output dominates: 14.4K output tokens cost $0.72 alone on the typical message.

### 6.4 Sandbox cost per message

| Vendor | 8 minutes | Share of a $0.40 message |
|---|---|---|
| E2B or Daytona | $0.166 x 8/60 = $0.022 | 5.5 percent |
| Vercel Sandbox (1 active CPU-minute) | memory $0.0113 + CPU $0.0043 = $0.016 | 4 percent |
| Cloudflare Containers standard-3 | $0.0096 + $0.0024 = $0.012 | 3 percent |
| Modal sandbox (US) | $0.032 | 8 percent |

Add Vercel exposed-port egress if the preview iframe streams through the sandbox: a 5 MB page load x 20 reloads per message = 100 MB = $0.015. Serve static previews from Cloudflare when possible.

### 6.5 All-in cost per typical message

| Item | Sonnet 5 | Opus 5 |
|---|---|---|
| Harness tokens | $0.38 | $0.95 |
| Sandbox (E2B) | $0.02 | $0.02 |
| Amortized session overhead (prefix write, one cold rewrite per 5 messages) | $0.04 | $0.10 |
| **Total** | **$0.44** | **$1.07** |

Per active building hour (6 typical messages): Sonnet 5 about $2.65, Opus 5 about $6.40. Anthropic's Managed Agents example ($0.525-0.705 for an hour on Opus 5 with 50K input and 15K output) is lower because it assumes far fewer steps; a builder loop that reads files and runs builds does 10-30 steps per message.

Cross-check with Anthropic's Claude Code numbers: $13 per developer per active day at 30-40 messages per day gives $0.33-0.43 per message across the whole Sonnet/Opus mix. The estimate above agrees.

---

## 7. Suggested credit mapping for V2

### 7.1 Keep the anchor

The credit unit is 1 credit = $0.04 of provider cost (`packages/env/src/server.ts:118`, `AI_USD_PER_CREDIT` default 0.04; `apps/server/src/modules/metering/domain/model-pricing.ts:5`, `DEFAULT_USD_MICROS_PER_CREDIT = 40_000`; conversion in `usdMicrosToCentiCredits`, `model-pricing.ts:209-221`, round up, 1 cc minimum). Pricing v6 keeps it (`docs/features/pricing-v6-starter-plan.md`, decision D1). Keep it for V2. Every V2 cost shape (tokens, sandbox minutes, preview minutes, backend hours) converts to centi-credits through the same function, so margins stay visible per plan.

### 7.2 Credit cost per V2 action at the anchor

| Action | Provider cost | Credits (round up) |
|---|---|---|
| Simple edit, Sonnet 5 | $0.14 | 4 |
| Typical feature message, Sonnet 5 | $0.44 | 11 (call it 10 in copy) |
| Large build message, Sonnet 5 | $1.40 | 35 |
| Typical message, Opus 5 ("Max mode") | $1.07 | 27 |
| Sandbox minute (E2B) | $0.00276 | 0.07 (7 cc) |
| Sandbox hour | $0.166 | 4.2 |
| Mobile preview minute (Appetize overage) | $0.06 | 1.5 |
| Mobile preview 10 minutes | $0.60 | 15 |
| Supabase Micro project, one month | $10 | 250 |
| Supabase branch hour | $0.01344 | 0.34 |
| Published app on Workers for Platforms, one month (script fee only) | $0.02 | 0.5 |

### 7.3 What the current plans buy in V2 messages

Plan catalog from `docs/features/pricing-v6-starter-plan.md` section 2: Starter 50 credits / $8; Pro 175 / $25 up to 8,750 / $1,125; Business same tiers at 2x price.

| Plan | Credits | AI cost | Typical Sonnet messages | Simple edits | Gross margin on AI before sandbox |
|---|---|---|---|---|---|
| Starter $8 | 50 | $2.00 | 4-5 | 12 | 75 percent |
| Pro $25 | 175 | $7.00 | 16-17 | 50 | 72 percent |
| Pro $100 | 700 | $28.00 | 64 | 200 | 72 percent |
| Business $50 | 175 | $7.00 | 16-17 | 50 | 86 percent |

Lovable's Pro at $25 buys 100 credits, which is 50-200 Build Mode messages at 0.5-2 credits each, plus 5 free build credits every day. At Lovable's reported 35 percent 2025 margin and $0.25 revenue per credit, Lovable's cost per credit was about $0.16, and a typical 1-credit message cost them about the same as our simple-edit estimate. Lovable's loop is shorter than a Claude Code loop (their own docs quote 0.5-2 credits per message).

Decision to make: at 72 percent AI margin, wandit V2 sells about 17 typical messages for $25. To offer 50-100 messages for $25 like Lovable, either the cost per message must fall to $0.10-0.15 (Haiku 4.5 or Sonnet 5 at low effort with fewer steps, and shorter contexts) or the AI cost per tier must rise to $10-15 (40-60 percent AI margin, which is where Lovable and Replit sit). This is a founder decision. The data says the market clears at $0.16-0.25 revenue per message and 35-65 percent gross margin.

### 7.4 Rules to implement

1. Meter tokens, not `total_cost_usd`. Read `modelUsage` per model from the `result` message, price with a server-side table that mirrors section 1 (and 1.1x when `inference_geo` is `us`), and store the token counts as evidence rows. Reconcile daily with the Usage and Cost API. Anthropic says `total_cost_usd` is "not authoritative billing data".
2. Reserve, settle, reconcile per message. Reserve a floor (10 credits for a build message, 3 for chat/plan mode), settle from `modelUsage` at the end of each turn (streaming input mode emits one `result` per turn), and set `maxBudgetUsd` per turn to the user's remaining balance capped at a plan ceiling (for example $2 = 50 credits on Pro, $5 on higher tiers). The SDK ends the turn with `error_max_budget_usd`; settle what was spent.
3. Cap subagents. `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3` for the builder. Opus 5 "delegates to subagents more readily".
4. Default model Sonnet 5 at `effort: medium`. Offer Opus 5 as an explicit mode with a visible 2.5x multiplier. Do not offer Fable 5.1 to end users by default (3.5x, always-on thinking, 30-day retention requirement).
5. Turn on the 1-hour cache TTL for the main conversation (`CLAUDE_CODE_PROMPT_CACHE_TTL=1h`). Keep subagents at 5 minutes.
6. Bill sandbox time as a separate measured operation (`unit: "minute"`, see `docs/v2/research/inspect-auth-billing-credits.md` section 10.2) at the vendor rate through the same anchor. It rounds to 0.07 credits per minute. Either include it in the plan (record with `customerBillable: false`) or show it as "0.1 credit per minute". Stop the sandbox after 10 minutes idle and after a hard maximum per session.
7. Mobile preview minutes are the expensive line: 1.5 credits per minute at Appetize overage. Give each plan a minute allowance (Starter 0, Pro 30, Business 120) and meter beyond it at 2 credits per minute. Alternatively stream only the web preview of the Expo app in the iframe and reserve simulator streaming for a paid add-on.
8. Backends are entitlements, not credits: Starter 0 backends, Pro 1 active backend, Business 3, more as a $10/month add-on each. Pause a backend after 7 days of no traffic on lower plans (Supabase Free does exactly this). A shared-project design (one Supabase project per shard, schema per app) is the only way to include "a backend for every project" in a $25 plan.
9. Show an estimate before the run and a receipt after. Copy: "This message will use about 10 credits" from a small classifier (plan vs build, project size), then "Used 8.4 credits" from the settled event. Lovable and Bolt complaints all come from opaque per-message spend.
10. Free plan: keep the 7-credit signup grant ($0.28), which is two simple edits or a half of one typical build. Consider a daily grant (Lovable and Rork give 5 per day) only if the sandbox cold-start cost is bounded; a free daily build costs $0.14-0.44 in tokens plus a sandbox start.

---

## 8. Risks

1. Anthropic terms. "Can customers offer Claude Code in their products?" answer: "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential." (https://code.claude.com/docs/en/legal-and-compliance). The Agent SDK page says the SDK is governed by the Commercial Terms "including when you use it to power products and services that you make available to your own customers and end users" and that developers "should use API key authentication" (https://code.claude.com/docs/en/agent-sdk/overview). The AI SDK Claude Code harness installs the Claude Code CLI package inside the sandbox as the Agent SDK runtime. Which clause covers wandit V2 is **UNVERIFIED**. Confirm in writing with Anthropic sales before launch. Fallback: Managed Agents ($0.08 per session-hour plus tokens) or a non-Claude-Code harness on the Messages API.
2. Tokenizer inflation: Sonnet 5 and Opus 5 produce about 30 percent more tokens than Sonnet 4.6 for the same text. Estimates built on Sonnet 4.6 traces understate cost.
3. Output tokens dominate. Thinking is billed as output. A wrong `effort` default (Claude Code defaults to `xhigh`) can double the cost per message. Set `effort` explicitly per mode.
4. Cache misses. The 5-minute default TTL and any change to the prefix (tool list order, timestamps in the system prompt) rewrite the whole context at 1.25x input price. Freeze the prefix and verify `cacheReadInputTokens` is nonzero in the preview environment.
5. Subagent fan-out on Opus 5 multiplies spend; agent teams use about 7x tokens. Cap depth and concurrency.
6. `total_cost_usd` drift: the bundled price table can lag a price change or a new model id (`costBasis: "unknown"`). Own the price table.
7. Sandbox fixed fees: E2B Pro $150/month is required for sessions over one hour; Modal Team $250/month for more than 100 containers; Vercel Pro $20/month. Choose one vendor per environment to avoid paying two fixed fees.
8. Mobile preview cost per minute ($0.06) exceeds the AI cost per minute of building. Uncapped preview time will invert the margin.
9. Per-project backend cost ($10/month per Supabase project on paid plans) exceeds the Pro base tier's whole AI budget. Entitlements or multi-tenancy are required.
10. Rate limits: a builder with 200 concurrent users needs organization TPM in the millions (Anthropic's table: 15k-20k TPM per user at 100-500 users). Request higher limits before the migration.
11. Data residency: 1.1x on all tokens if `inference_geo: "us"` is required. Global routing is standard price.
12. Competitor margins are thin (Lovable 35 percent in May 2025, Replit between 36 percent and negative 14 percent in 2025). Price wars on "messages per dollar" are lost by the party with the longest agent loop.

---

## 9. Unverified items

- Lovable's 35 percent May 2025 gross margin, $5.7M revenue, $3.7M model costs, and 65 percent target: taken from a Brave search snippet summarizing The Information and Sifted; the Sifted page returned 403.
- Reddit complaints about Lovable price increases ("almost 200% increase") and Bolt token burn ("250,000 tokens" per edit, "20M tokens" on one auth fix): Brave snippets only.
- Third-party Claude Code session cost ranges (TokenCost: $2-5 simple, $5-15 complex, $15-30+ autonomous): Brave snippet only.
- Bolt Pro tier ladder above 10M tokens and reload prices: the pricing page renders them client-side; the support docs only name "Pro 20" and "Pro 50".
- Replit checkpoint minimum of $0.06: Sacra estimate; Replit's own pages say only "typically costing less than $0.25".
- Replit Starter daily credit amount in USD: not stated on the docs page.
- Base44 top-up prices and per-model multipliers: not stated.
- Whether `total_cost_usd` reaches the host through `harnessMetadata['claude-code']` in the AI SDK harness adapter (see `docs/v2/research/ai-sdk-harness.md:196`).
- Which Anthropic clause (Claude Code in products vs Agent SDK) applies to a hosted-sandbox builder that pays for tokens with its own key.
- Vercel Sandbox rates in `cdg1` (the regional table did not render).
- E2B paused-state storage price and Pro+ add-on prices (see `docs/v2/research/sandboxes.md` section 8).
- All step counts and token sizes in section 6 are estimates, not measurements.

---

## 10. Sources

Anthropic

- https://platform.claude.com/docs/en/about-claude/pricing
- https://code.claude.com/docs/en/costs
- https://code.claude.com/docs/en/agent-sdk/cost-tracking
- https://code.claude.com/docs/en/agent-sdk/subagents
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/legal-and-compliance
- https://platform.claude.com/docs/en/manage-claude/claude-code-analytics-api
- https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code

Sandboxes

- https://e2b.dev/pricing
- https://vercel.com/docs/sandbox/pricing
- https://www.daytona.io/pricing
- https://modal.com/pricing
- https://developers.cloudflare.com/containers/platform/pricing/

Backend, preview, hosting

- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/compute-and-disk
- https://appetize.io/pricing
- https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/

Competitors

- https://lovable.dev/pricing
- https://docs.lovable.dev/introduction/subscription-plans
- https://docs.lovable.dev/introduction/credits-and-usage
- https://docs.lovable.dev/user-guides/messaging-limits
- https://docs.lovable.dev/features/project-usage
- https://bolt.new/pricing
- https://support.bolt.new/account-and-subscription/tokens
- https://v0.app/pricing
- https://replit.com/pricing
- https://docs.replit.com/billing/ai-billing
- https://docs.replit.com/billing/managing-spend
- https://docs.replit.com/billing/deployment-pricing
- https://replit.com/blog/effort-based-pricing
- https://base44.com/pricing
- https://rork.com/pricing

Margins and complaints (secondary)

- https://sacra.com/c/lovable/
- https://sacra.com/c/replit/
- https://sifted.eu/articles/lovable-margins-leaked-pitch-deck (403 on fetch; title and date from the HN Algolia API)
- https://hn.algolia.com/api/v1/search?query=claude%20code%20cost%20per%20task&tags=story
- https://hn.algolia.com/api/v1/search?query=bolt.new%20tokens&tags=story
- https://hn.algolia.com/api/v1/search?query=replit%20effort-based%20pricing&tags=story
- https://github.com/AgentSeal/codeburn
- https://github.com/ryoppippi/ccusage
- Brave search result pages for "lovable gross margin inference costs", "claude code average cost per session ccusage real numbers", "bolt.new tokens per message burn complaints" (fetched 2026-09-03)

Repo

- `packages/env/src/server.ts:118`
- `apps/server/src/modules/metering/domain/model-pricing.ts:5`, `:209-221`
- `docs/features/pricing-v5-usd-anchor.md`
- `docs/features/pricing-v6-starter-plan.md`
- `docs/v2/research/sandboxes.md` (sections 3, 6.5, 8)
- `docs/v2/research/ai-sdk-harness.md:193-197`, `:326-333`, `:355-372`
- `docs/v2/research/inspect-auth-billing-credits.md` section 10
