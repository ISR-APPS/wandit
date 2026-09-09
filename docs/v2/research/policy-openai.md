# OpenAI policy on bring-your-own ChatGPT subscription in third-party Codex products

Date of research: 2026-09-05
Author: research agent (Claude Fable 5.1)
Method: primary sources first (OpenAI Terms, Help Center, developer docs, posts by OpenAI staff). Secondary sources only for dates and links. Each finding has a status: CONFIRMED, SECONDARY, UNVERIFIED, or REFUTED.

Note on access: openai.com and help.openai.com return HTTP 403 to direct fetches. The text below comes from the same pages through a reader proxy (r.jina.ai). The Help Center article "Codex CLI and Sign in with ChatGPT" (11381614) returned 403 and could not be read.

## 1. Summary

1. There are two different things called "Sign in with ChatGPT".
   - (A) An identity-provider login for partner websites. Beta, started 2026-07-31. It shares only name, email, and profile picture. It gives no model or Codex access.
   - (B) The OAuth login inside Codex (CLI, IDE extension, app-server). This login charges usage to the user's ChatGPT plan. This is the one that matters for a "bring your own subscription" product.
2. OpenAI permits (B) in third-party clients. The Codex lead, Tibo Sottiaux, wrote on 2026-08-21 that users are "completely fine" when they use their subscription through Sign in with ChatGPT in "official clients or ... one of the many OSS clients (Pi, OpenCode, ...)". Sam Altman wrote on 2026-05-01 that users can sign in to OpenClaw with a ChatGPT account. OpenAI docs invite developers to build "a deep integration inside your own product" on the Codex app-server.
3. OpenAI does not permit "sub2api": converting a subscription into API traffic "to then re-serve or share across many users". OpenAI says its fraud-prevention systems flag this pattern. The Terms of Use also forbid credential sharing and rate-limit circumvention.
4. All named third-party tools (T3 Code, Conductor, Zed, Warp, Cline, OpenClaw, JetBrains, Cursor extension) run the Codex harness on a machine that the user controls, with the user's own login. No OpenAI text was found that permits or forbids a hosted multi-tenant web product that holds user ChatGPT tokens on the vendor's servers. That case is a gray zone.
5. Compared with Anthropic: OpenAI is more permissive for local desktop tools and self-hosted open-source clients. For hosted products, Anthropic has a written (narrow) path: host the unmodified Claude Code binary and let each user sign in. OpenAI has no written path and no written ban for that shape.
6. No OpenAI text was found on whether a third-party product may charge money while the user brings their own subscription. UNVERIFIED.

## 2. Question 1: Sign in with ChatGPT in a third-party product

### 2.1 The identity-provider "Sign in with ChatGPT" (partner sites)

Source: OpenAI Help Center, "Sign in with ChatGPT", https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt (read 2026-09-05). Status: CONFIRMED.

Quotes:
- "Sign in with ChatGPT is an identity-provider sign-in option that lets you use identity information from your ChatGPT account to create, link, or access an account with a supported external application."
- "Sign in with ChatGPT is available globally to authenticated ChatGPT users, including users in Enterprise organizations."
- "Initial participating partners include Airtable, GitLab, HubSpot, Notion, Supabase, and Vercel."
- "the external application receives only your name, email address, and profile picture, if you have one."

Facts:
- Launch: rollout started 2026-07-31 as a beta (RuntimeWire, 2026-07-31; TechTimes, 2026-08-03). Status: SECONDARY.
- The Help Center page does not say how a developer applies. No public application form or waitlist page was found. Status: UNVERIFIED.
- This login gives identity only. It does not give Codex or model access. It is not the mechanism that lets a product use the user's Codex quota.
- History: TechCrunch reported on 2025-05-27 that OpenAI was gauging developer interest with a form. Status: SECONDARY.

### 2.2 The Codex "Sign in with ChatGPT" (usage on the user's plan)

Sources:
- OpenAI Codex docs, Authentication: https://developers.openai.com/codex/auth (redirects to https://learn.chatgpt.com/docs/auth), read 2026-09-05. CONFIRMED.
- OpenAI Codex docs, Pricing: https://developers.openai.com/codex/pricing (learn.chatgpt.com/docs/pricing), read 2026-09-05. CONFIRMED.
- OpenAI Help Center, "Using Codex with your ChatGPT plan", https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan, "Updated: 6 days ago" as of 2026-09-05. CONFIRMED.

Quotes:
- Pricing page: "ChatGPT Work and Codex are included in your ChatGPT Free, Go, Plus, Pro, Business, Edu, or Enterprise plan".
- Help Center: "Codex is included across ChatGPT plans, including Free and Go. Usage limits vary by plan."
- Help Center: "Codex, ChatGPT Work, ChatGPT for Excel, and Workspace Agents use a shared allowance and credit pool when those features are available on your plan."
- Help Center: "Yes, the Codex VS Code extension is compatible with most VS Code forks. For other IDEs, you can also run the Codex CLI in the IDE's terminal."
- Auth docs: ChatGPT sign-in is a browser flow in "the ChatGPT desktop app, Codex CLI, and IDE extension". Headless options: "codex login --device-auth" (beta), copy "~/.codex/auth.json" to a remote machine, or SSH-forward "localhost:1455". The docs say to treat auth.json "like a password: it contains access tokens."
- Auth docs on API keys: "OpenAI bills API key usage through your OpenAI Platform account at standard API rates."

Eligibility: all ChatGPT plans, Free to Enterprise. The 2025 exclusion of Team/Enterprise/Edu (TechCrunch, 2025) no longer applies. CONFIRMED by the pricing page.

Rate limits (pricing page, read 2026-09-05): usage is measured in rolling five-hour windows plus a weekly limit. Message ranges per five hours: Plus 5-2,000; Pro 5x 25-10,000; Pro 20x 100-40,000; Business 5-2,000 (ranges depend on model). Tibo Sottiaux, 2026-08-25 (X post 2092058556707344708, CONFIRMED via fxtwitter API): "Tomorrow we will bring back the 5h limit for Plus accounts across ChatGPT Work and Codex." and "We are for the upcoming months keeping the 5h limit not enabled for Pro $100 and Pro $200 subscriptions." No separate limit for third-party clients was found; the same included usage applies.

Business/Enterprise only: "Codex access tokens are ChatGPT workspace credentials scoped to Codex permissions. They authenticate trusted non-interactive local workflows, including Codex CLI and app-server-based automation, with a ChatGPT workspace identity." (https://developers.openai.com/codex/enterprise/access-tokens, read 2026-09-05, CONFIRMED).

### 2.3 What OpenAI says about third-party clients

Primary statement 1. Tibo Sottiaux (OpenAI, Codex lead), X post 2090675027670978569, 2026-08-21 05:39 UTC, quoted in his post 2090766694897619318. Read through the fxtwitter API on 2026-09-05. Status: CONFIRMED.

Full text:
> "We've investigated a few messages about codex usage limits being different. That's not something we change without engaging the community and being transparent.
>
> What we did see is that when talking to affected users many were using sub2api. Converting a subscription into api traffic to then re-serve or share across many users is not something we support and this type of usage gets flagged by our fraud-prevention systems.
>
> You are completely fine if you use your subscription through Sign in With ChatGPT, either through the official clients or through one of the many OSS clients (Pi, OpenCode, ...) that support signing in with your account and using your included usage."

Primary statement 2. Tibo Sottiaux, X post 2058071172361998482, 2026-05-23. CONFIRMED.
> "A little secret. About 5% of our production traffic is on the Pi harness, about another 5% is on OpenCode. Reminder you can use your ChatGPT account in a flourishing set of other tools. We'll continue to make Codex awesome, but you have options."

Primary statement 3. Sam Altman, X post 2050357911915028689, 2026-05-01. CONFIRMED.
> "you can sign in to openclaw with your chatgpt account now and use your subscription there! happy lobstering."

Primary statement 4. OpenAI Codex docs, App Server, https://developers.openai.com/codex/app-server (learn.chatgpt.com/docs/app-server), read 2026-09-05. CONFIRMED.
> "Codex app-server is the interface Codex uses to power rich clients (for example, the Codex VS Code extension). Use it when you want a deep integration inside your own product: authentication, conversation history, approvals, and streamed agent events. The app-server implementation is open source in the Codex GitHub repository"
> "Important: Use clientInfo.name to identify your client for the OpenAI Compliance Logs Platform. If you are developing a new Codex integration intended for enterprise use, please contact OpenAI to get it added to a known clients list."

Primary statement 5. OpenAI Codex docs, Codex SDK, https://learn.chatgpt.com/docs/codex-sdk, read 2026-09-05. CONFIRMED.
> "Integrate Codex within your own application"
> "Use the Codex SDK to automate coding tasks, including jobs in CI. Use the Codex app server to build custom clients that handle authentication, conversation history, approvals, and streamed agent events."

Primary statement 6. OpenAI blog, "Unlocking the Codex harness: how we built the App Server", https://openai.com/index/unlocking-the-codex-harness/ (read via proxy 2026-09-05; page date not shown in the proxy text). CONFIRMED.
> "Internal teams and external partners wanted the ability to embed the same harness in their own products in order to accelerate their users' software development workflows."
> "You get both the full functionality of the agent loop and other supporting features like Sign in with ChatGPT, model discovery, and configuration management."
> "If this sparked ideas for integrating Codex into your own workflows, it's worth giving App Server a try."

Primary statement 7. OpenAI, "Codex for Open Source" program, https://developers.openai.com/community/codex-for-oss, read 2026-09-05. CONFIRMED.
> "Developers should code in the tools they prefer, whether that's Codex, OpenCode, Cline, pi, OpenClaw, or something else, and this program supports that work."

What is missing:
- No OpenAI text says that a commercial (paid) third-party product may or may not use Sign in with ChatGPT. UNVERIFIED.
- No OpenAI text says that a product may charge money while the user brings their own subscription. UNVERIFIED.
- No OpenAI text addresses a hosted web product that stores the user's ChatGPT OAuth tokens on the vendor's servers. UNVERIFIED. The nearest rule is the sub2api statement (re-serve or share across many users is not supported) and the Terms clause on credential sharing (section 3).
- The GitHub issue openai/codex#10974 ("Sign in with ChatGPT for third-party apps") returned 404 through both WebFetch and the gh CLI. UNVERIFIED.

### 2.4 How third-party tools integrate Codex today

All of the tools below run the Codex harness on a machine the user controls, and the user completes the ChatGPT login. None logs in on a vendor server.

| Tool | Shape | How it runs Codex | Login | Status |
|---|---|---|---|---|
| T3 Code | Open-source desktop app (plus remote web/mobile view of the same desktop instance) | Runs `codex app-server` per session over JSON-RPC/stdio on the user's machine | User runs `codex login` first; README: "install Codex CLI and run codex login" | CONFIRMED (README, read 2026-09-05); Theo (X, 2026): "We built around the Codex App Server so you can use the same harness, plugins, and subscription" SECONDARY |
| Conductor (conductor.build) | Native macOS app | "the bundled Codex binary or a configured system Codex binary" on the Mac | "Codex CLI sign-in outside Conductor or from API-key based access" | CONFIRMED (docs, read 2026-09-05) |
| Zed | Desktop editor | ACP adapter (codex-acp, now under agentclientprotocol/codex-acp) around the Codex app-server, as a local external-agent process | ChatGPT login in the agent panel | CONFIRMED (Zed docs/blog 2026-05-15). Zed blog: "We're grateful that OpenAI continues to support subscription-based access for third-party tools" |
| Warp | Desktop terminal | User installs Codex CLI locally | "Select Sign in with ChatGPT and authenticate with your ChatGPT account (recommended)"; "Your Codex usage is included in your ChatGPT plan" | CONFIRMED (Warp docs, read 2026-09-05) |
| Cline | VS Code extension | Extension calls OpenAI with OAuth tokens | "Your OpenAI credentials never leave OpenAI's servers; Cline only receives the access tokens needed to make API calls on your behalf." (blog 2026-01-22) | CONFIRMED (Cline blog) |
| OpenClaw | Self-hosted agent gateway (user's own machine or server) | Own PKCE/device-code OAuth flow; stores tokens in its own store | `openclaw models auth login --provider openai-codex` | CONFIRMED (docs.openclaw.ai). OpenClaw docs claim "OpenAI Codex OAuth is explicitly supported for use outside the Codex CLI" - that is OpenClaw's statement, SECONDARY; Sam Altman's post confirms the outcome |
| JetBrains IDEs | Desktop IDE, official partner | Native integration on the user's machine (migrating to ACP) | Sign in with "JetBrains AI subscription", "ChatGPT account", or "OpenAI API key"; "This free offer does not apply when using a ChatGPT account or an OpenAI API key" | CONFIRMED (JetBrains blog 2026-01-22) |
| Cursor | Desktop IDE | Official Codex IDE extension inside Cursor | "Select Sign in with ChatGPT to use an eligible ChatGPT subscription, or select Use API Key" | CONFIRMED (OpenAI Help Center 20001506). Note: OpenAI "is planning to wind down our contract providing OpenAI models to Cursor" with "a transition period of November 12, 2026". That concerns Cursor's own model access, not the Codex extension |

Local versus hosted: every example is local (desktop) or self-hosted by the user. The OpenAI auth docs do describe headless use (device auth, copying auth.json, SSH forwarding) for the user's own remote machines. No official example of a hosted multi-tenant web product that holds many users' ChatGPT tokens was found.

## 3. Question 2: Terms clauses and enforcement history

### 3.1 Terms of Use (consumer)

Source: https://openai.com/policies/terms-of-use/ (read via proxy 2026-09-05). The proxy text shows no "Effective" date line. Status: CONFIRMED for the quoted text; date UNVERIFIED.

Quotes:
- "You may not share your account credentials or make your account available to anyone else and are responsible for all activities that occur under your account."
- "What you cannot do. You may not use our Services for any illegal, harmful, or abusive activity. For example, you may not:"
  - "Modify, copy, lease, sell or distribute any of our Services."
  - "Automatically or programmatically extract data or Output (defined below)."
  - "Interfere with or disrupt our Services, including circumvent any rate limits or restrictions or bypass any protective measures or safety mitigations we put on our Services."
  - "Use Output to develop models that compete with OpenAI."
- "Third party Services. Our services may include third party software, products, or services, ('Third Party Services') ... Third Party Services and Third Party Output are subject to their own terms, and we are not responsible for them."

Findings:
- The Terms contain no clause that names Codex, Sign in with ChatGPT, third-party clients, or harnesses.
- The phrase "Reselling access or using ChatGPT to power third-party services", quoted by some secondary articles as a Terms clause, does not appear in the current Terms text. Status: REFUTED as a verbatim Terms quote.
- Service Terms (https://openai.com/policies/service-terms/, read via proxy 2026-09-05): the only Codex sentence is about output licenses: "Output generated by code generation features of our Services, including OpenAI Codex, may be subject to third party licenses". CONFIRMED.
- Usage Policies (https://openai.com/policies/usage-policies/, updated 2025-10-29): list "circumventing our safeguards" as prohibited; nothing on third-party clients. CONFIRMED.

### 3.2 The operative rule (staff statement)

The only explicit OpenAI rule for this topic is Tibo Sottiaux's 2026-08-21 post (section 2.3): re-serving or sharing a subscription as API traffic across many users is "not something we support" and "gets flagged by our fraud-prevention systems"; use through Sign in with ChatGPT in official or OSS clients is "completely fine". CONFIRMED.

### 3.3 Enforcement history 2025-2026

- 2026-08-21: OpenAI confirms that fraud-prevention systems flag sub2api-style subscription re-serving. CONFIRMED (primary).
- May 2026: several posts on community.openai.com report Codex/ChatGPT Pro accounts suspended without explanation (for example, thread 1381906, 2026-05-27). The users did not name a third-party tool; OpenAI Support only asked for a ticket number. No OpenAI statement links these bans to third-party clients. SECONDARY.
- No cease-and-desist, public ban, or takedown against a hosted Codex OAuth proxy or relay service was found. UNVERIFIED (absence of evidence).
- No OpenAI warning against OpenClaw, OpenCode, Pi, Cline, Zed, T3 Code, or Conductor was found. On the contrary, staff posts endorse them (section 2.3).

## 4. Question 3: OpenAI versus Anthropic

### 4.1 Anthropic current rules (for comparison)

Source: Claude Code docs, "Legal and compliance", https://code.claude.com/docs/en/legal-and-compliance, read 2026-09-05. CONFIRMED.

Quotes:
- "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."
- "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens - sign-in to a Claude account must complete through Anthropic's own flow."
- Hosting exception: "Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure) requires agreeing to our Commercial Terms of Service and complying with the conditions below: The Claude Code binary must not be modified. ... Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential"
- "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code as described under Can customers offer Claude Code in their products? above."
- "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."

Timeline (SECONDARY unless noted):
- 2026-01: Anthropic blocked subscription OAuth tokens outside official apps, then reversed (The Register, DEV).
- 2026-02-19: Anthropic docs clarified that OAuth tokens from Free/Pro/Max accounts "in any other product, tool, or service" are not permitted (GIGAZINE, The Register).
- 2026-04-03: Boris Cherny (Anthropic), X post 2040206440556826908, CONFIRMED via fxtwitter: "Starting tomorrow at 12pm PT, Claude subscriptions will no longer cover usage on third-party tools like OpenClaw. You can still use these tools with your Claude login via extra usage bundles (now available at a discount), or with a Claude API key."
- 2026-05-13: Anthropic announced a separate Agent SDK monthly credit ($20 Pro, $100 Max 5x, $200 Max 20x) from 2026-06-15 for "third-party apps that authenticate with your Claude subscription through the Agent SDK" (Claude Help Center 15036540, CONFIRMED).
- 2026-06-15: paused. Help Center 15036540: "We're pausing the changes to Claude Agent SDK usage described below. For now, nothing has changed: Claude Agent SDK, claude -p, and third-party app usage still draw from your subscription's usage limits." CONFIRMED.
- OpenClaw docs state: "Anthropic staff told us OpenClaw-style Claude CLI usage is allowed again." SECONDARY.

### 4.2 Comparison by product shape

| Product shape | OpenAI | Anthropic |
|---|---|---|
| Local desktop tool or self-hosted OSS client; user logs in with own account on own machine | Permitted. Staff say "completely fine" (2026-08-21). Docs invite app-server integration. | Permitted in practice today (subscription usage still covers third-party apps after the 2026-06-15 pause), but the legal page frames OAuth as "exclusively" for native Anthropic apps and has changed four times in 2026. Higher policy risk. |
| Hosted product that runs the vendor's unmodified CLI per user, and each user signs in through the vendor's own flow | No written rule. Not the sub2api pattern if there is no pooling or re-serving. Gray zone. | Written path exists: host the unmodified Claude Code binary under Commercial Terms; each end user signs in; the platform must not pay for, resell, or intermediate usage. |
| Hosted product that collects, stores, or proxies user session tokens on its own servers | Not addressed in writing. Credential-sharing and rate-limit clauses apply. If tokens are pooled or re-served, it is flagged as sub2api. | Explicitly forbidden: "developers may not collect, store, or intermediate Claude.ai credentials or session tokens". |
| Pooling or reselling one subscription to many users | Explicitly not supported; flagged by fraud prevention. | Explicitly forbidden. |
| Product charges money while user brings own subscription | Not addressed. UNVERIFIED. | Product may charge for itself but "may not pay for, resell, or intermediate Claude usage on their end users' behalf". |

Verdict: OpenAI is more permissive than Anthropic for local desktop tools and self-hosted open-source clients, and its position has been stable and public through 2026. For hosted cloud products, neither vendor gives a clear green light. Anthropic gives a narrow written path (unmodified binary, per-user login, no intermediation). OpenAI gives no written path but has only drawn one explicit red line (re-serving or sharing across many users).

## 5. Sources

Primary (OpenAI):
- https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt (read 2026-09-05)
- https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan (updated ~2026-08-30)
- https://help.openai.com/en/articles/20001506-using-openai-models-in-cursor
- https://developers.openai.com/codex/auth -> https://learn.chatgpt.com/docs/auth
- https://developers.openai.com/codex/app-server -> https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/codex-sdk
- https://developers.openai.com/codex/pricing -> https://learn.chatgpt.com/docs/pricing
- https://developers.openai.com/codex/enterprise/access-tokens
- https://developers.openai.com/community/codex-for-oss
- https://openai.com/index/unlocking-the-codex-harness/
- https://openai.com/policies/terms-of-use/ ; https://openai.com/policies/service-terms/ ; https://openai.com/policies/usage-policies/
- https://x.com/thsottiaux/status/2090675027670978569 (2026-08-21) ; https://x.com/thsottiaux/status/2090766694897619318 (2026-08-21) ; https://x.com/thsottiaux/status/2058071172361998482 (2026-05-23) ; https://x.com/thsottiaux/status/2092058556707344708 (2026-08-25)
- https://x.com/sama/status/2050357911915028689 (2026-05-01)

Primary (Anthropic):
- https://code.claude.com/docs/en/legal-and-compliance
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- https://x.com/bcherny/status/2040206440556826908 (2026-04-03)

Primary (third-party tool vendors):
- https://raw.githubusercontent.com/pingdotgg/t3code/main/README.md
- https://www.conductor.build/docs/reference/harnesses/codex
- https://zed.dev/blog/chatgpt-subscription-in-zed (2026-05-15) ; https://zed.dev/docs/ai/external-agents
- https://docs.warp.dev/guides/external-tools/how-to-set-up-codex-cli/
- https://cline.bot/blog/introducing-openai-codex-oauth (2026-01-22)
- https://docs.openclaw.ai/providers/openai ; https://docs.openclaw.ai/concepts/oauth
- https://blog.jetbrains.com/ai/2026/01/codex-in-jetbrains-ides/ (2026-01-22)

Secondary (dates and links only):
- TechCrunch 2025-05-27; RuntimeWire 2026-07-31; TechTimes 2026-08-03; Manifest blog 2026-07-01; explainx.ai 2026-08-21; MindStudio 2026-05-09; VentureBeat 2026-05-13; The Register 2026-02-20 and 2026-04-06; GIGAZINE 2026-02-20; community.openai.com thread 1381906 (2026-05-27).
