# Anthropic policy: Claude subscriptions, Claude Code, and the Agent SDK in third-party products

Research date: 2026-09-05
Scope: Anthropic position on three questions for the Wandit v2 builder.
Method: primary sources fetched on 2026-09-05 (Anthropic terms, Claude Code docs, Agent SDK docs, Claude Help Center). Secondary sources (press, GitHub) give dates only. Status marks: CONFIRMED = quoted from a primary source. SECONDARY = quoted from a non-Anthropic source. UNVERIFIED = not found in any source. REFUTED = a source shows the claim is wrong.

## 1. Short answers

1. A third-party product may NOT offer "log in with your claude.ai / Pro / Max account" and route requests through the user's subscription. Anthropic keeps this ban. It has one narrow exception: the end user signs in to the unmodified Claude Code binary through Anthropic's own login flow, and the product never touches the token. The Agent SDK docs add a second door: "unless previously approved" by Anthropic.
2. A company MAY run the Claude Agent SDK inside its own hosted product with its own API key to serve end users. The Commercial Terms govern this. A company may NOT pay for Claude usage on behalf of end users when it preinstalls or runs the Claude Code CLI binary as a product feature. Each end user must then authenticate with their own credential.
3. The "Claude Code" name is NOT allowed in the product UI as a product, feature, or agent name. Plain-text factual statements ("runs Claude Code") are allowed for products that ship the binary. Agent SDK products must use "Claude Agent", "Claude", or "{YourAgentName} Powered by Claude".

## 2. Question 1: end user logs in with their own claude.ai subscription

### 2.1 Current rule (Claude Code legal page)

Source: https://code.claude.com/docs/en/legal-and-compliance, fetched 2026-09-05. Status: CONFIRMED.

Section "Authentication and credential use":

> "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."

> "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow."

The exception:

> "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code as described under Can customers offer Claude Code in their products? above."

Enforcement:

> "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."

Usage limits:

> "Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."

### 2.2 Current rule (Agent SDK docs)

Source: https://code.claude.com/docs/en/agent-sdk/overview and https://code.claude.com/docs/en/agent-sdk/quickstart, fetched 2026-09-05. Status: CONFIRMED.

> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."

### 2.3 Consumer Terms of Service

Source: https://www.anthropic.com/legal/consumer-terms, "Effective October 8, 2025", fetched 2026-09-05. Status: CONFIRMED.

> "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else."

Prohibited use:

> "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."

> "To develop any products or services that compete with our Services, including to develop or train any artificial intelligence or machine learning algorithms or models or resell the Services."

The Consumer Terms do not name OAuth tokens, Claude Code, or third-party tools. The Claude Code legal page carries the specific rule.

### 2.4 Usage Policy

Source: https://www.anthropic.com/legal/aup, "Effective September 15, 2025", fetched 2026-09-05. Status: CONFIRMED.

The Usage Policy has no clause on OAuth tokens or third-party tools. Related text:

> "Circumvent a ban through the use of a different account, such as the creation of a new account, use of an existing account, or providing access to a person or entity that was previously banned"

> "Access or facilitate account or API access to Claude to persons, entities, or users in violation of our Supported Regions Policy"

### 2.5 Help Center: "Logging in to your Claude account"

Source: https://support.claude.com/en/articles/13189465-logging-in-to-your-claude-account, updated May 19, 2026, fetched 2026-09-05. Status: CONFIRMED.

Subscriptions are "designed to support ordinary use of native Anthropic applications, including the Claude web, desktop, and mobile applications and Claude Code."

> "The preferred way to access Anthropic services using third-party software, tools, or services ('third-party tools'), including open-source projects, is through API key authentication through Claude Console or a supported cloud provider."

Anthropic "may at its discretion allow paid subscribers who have enabled usage credits to use certain third-party tools" and reserves the right to charge usage credits instead of subscription limits.

> "Use of third-party tools that misrepresent their identity to Anthropic's servers, attempt to route third-party traffic against subscription limits, or otherwise violate applicable terms or policies is prohibited."

### 2.6 Help Center: "Use the Claude Agent SDK with your Claude plan"

Source: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan, updated June 15, 2026, fetched 2026-09-05. Status: CONFIRMED.

Top notice:

> "We're pausing the changes to Claude Agent SDK usage described below. For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits."

The paused plan covered "third-party apps that authenticate with your Claude subscription through the Agent SDK." Credits "belong to individual accounts. They can't be shared or pooled across teammates."

This article shows that Anthropic knows about third-party apps that use a subscription through the Agent SDK. It bills them from the subscriber's own limits. It does not say that any developer may offer that login. The Agent SDK docs still say "unless previously approved."

### 2.7 History, 2025 to 2026

| Date | Event | Status |
|---|---|---|
| 2025-11-20 | Error text "This credential is only authorized for use with Claude Code and cannot be used for other API requests." appears in anthropics/claude-code issue #12021. | SECONDARY (GitHub) |
| 2026-01-09 | Server-side checks reject subscription OAuth tokens sent from non-Claude-Code clients. OpenCode issue #7456 filed the same day. Reports name OpenCode, Cline, Roo Code, OpenClaw. | SECONDARY (GitHub, press) |
| 2026-02-18 | Anthropic edits the Claude Code legal page. Press quotes the page: "Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service — including the Agent SDK — is not permitted". Thariq Shihipar (Anthropic): "Apologies, this was a docs clean up we rolled out that caused some confusion. Nothing is changing about how you can use the Agent SDK and MAX subscriptions!" Anthropic PR: "Nothing changes around how customers have been using their account and Anthropic will not be canceling accounts. The update was a clarification of existing language in our docs to make it consistent across pages." | SECONDARY (The New Stack, 2026-02-18) |
| 2026-02-20 | Thariq Shihipar (Anthropic): "Third-party harnesses using Claude subscriptions create problems for users" and "they generate unusual traffic patterns without any of the usual telemetry". Tools named: OpenCode, Cline, Cursor, Pi/OpenClaw. | SECONDARY (The Register, 2026-02-20) |
| 2026-03-19 | OpenCode merges PR #18186 titled "anthropic legal requests". It removes the Claude Pro/Max OAuth login plugin, the Claude Code beta header, and Anthropic system prompt. | SECONDARY (GitHub, confirmed by direct fetch) |
| 2026-04-03 | Boris Cherny (Head of Claude Code) on X: "Starting tomorrow at 12pm PT, Claude subscriptions will no longer cover usage on third-party tools like OpenClaw. You can still use these tools with your Claude login via extra usage bundles (now available at a discount), or with a Claude API key." Also: "our subscriptions weren't built for the usage patterns of these third-party tools." Customer email: the policy "applies to all third-party harnesses and will be rolled out to more shortly." | SECONDARY (VentureBeat 2026-04-03, TechCrunch 2026-04-04) |
| 2026-04-04 | Subscription limits stop covering third-party harnesses. Usage moves to extra usage credits or API keys. One-time credit equal to one month's plan. | SECONDARY (press) |
| 2026-05-13/14 | Anthropic announces a monthly "Agent SDK credit" from June 15 for Pro/Max/Team/Enterprise. It covers the Agent SDK, `claude -p`, GitHub Actions, and "third-party apps that authenticate with your Claude subscription through the Agent SDK." Press names Conductor, Zed, Jean, T3 Code, OpenClaw as such apps. Lydia Hallie (Anthropic): "To add some clarity: you don't pay extra. It's the same subscription, same price per month." | CONFIRMED (Help Center) for the plan; SECONDARY (VentureBeat 2026-05-13) for names and quotes |
| 2026-05-19 | Help Center login article updated with the "certain third-party tools" discretion clause (2.5 above). | CONFIRMED |
| 2026-06-15 | Anthropic pauses the credit change: "For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits." | CONFIRMED (Help Center) |
| 2026-09-05 | Legal page and Agent SDK docs keep the ban on developers offering claude.ai login. Exception for the unmodified Claude Code binary stays. "Unless previously approved" stays. | CONFIRMED |

Conductor, T3 Code, and Kilo: press names Conductor and T3 Code as apps that use a subscription through the Agent SDK (VentureBeat, 2026-05-13). No Anthropic page names them. No source confirms a ban letter to Kilo. Status: UNVERIFIED for Kilo.

Claude Code changelog: no changelog entry about the OAuth block was found in the current CHANGELOG.md (latest version 2.1.261, fetched 2026-09-05). Status: UNVERIFIED.

Partner program: Anthropic has a "Claude Partner Network" (launched 2026-03-12, anthropic.com/news/claude-partner-network) for go-to-market partners. No source shows a public program that grants "offer claude.ai login" rights. The docs say "unless previously approved" and "contact sales". Status: UNVERIFIED that a formal program exists.

### 2.8 How named third-party apps do it today

- OpenClaw docs (docs.openclaw.ai/providers/anthropic): two routes. (a) API key. (b) "Claude CLI Integration": reuse the existing Claude Code login on the same host, or `claude setup-token` (token prefix `sk-ant-oat01-`). "Claude Code owns its existing login and subscription; OpenClaw does not persist or refresh that login." Status: SECONDARY.
- Zed (zed.dev/acp/agent/claude-agent): "Anthropic's Claude integrated through Zed's SDK adapter". Product name in UI: "Claude Agent". First use: "you'll be prompted to add your Anthropic API key." Status: SECONDARY.
- Claude Code docs, `claude setup-token`: "This token authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan." Status: CONFIRMED. Note: a product that collects this token from users breaks the rule "developers may not collect, store, or intermediate Claude.ai credentials or session tokens".

### 2.9 Conclusion for question 1

- Forbidden: the product shows "Sign in with Claude", receives an OAuth token, and calls the API or the Agent SDK with it. Forbidden: the product asks the user to paste a `setup-token` or `.credentials.json` token.
- Tolerated by the letter of the legal page: the product hosts the unmodified Claude Code binary. The user runs `/login` inside that binary. Anthropic's own browser flow completes sign-in. The product never sees the token. Anthropic then bills the user's own subscription. The Help Center says such usage "still draw[s] from your subscription's usage limits" (June 15, 2026).
- Gray: the Agent SDK note says third-party developers may not offer claude.ai login "unless previously approved". The legal page exception names "the unmodified Claude Code binary", not the Agent SDK. The Agent SDK spawns the same `claude` binary, but no Anthropic page says the exception covers Agent SDK login. Treat this as approval-needed. Contact sales for written approval before you ship it.

## 3. Question 2: company runs Claude Code CLI or Agent SDK with its own API key

### 3.1 "Claude Code in products" clause

Source: https://code.claude.com/docs/en/legal-and-compliance, section "Can customers offer Claude Code in their products?", fetched 2026-09-05. Status: CONFIRMED.

> "Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure) requires agreeing to our Commercial Terms of Service and complying with the conditions below:"

> "The Claude Code binary must not be modified. Claude Code must be installed and run as published by Anthropic, and customers may not remove, disable, or restrict any authentication method built into it (including methods that permit signing in with a Claude account or the user's own API key)."

> "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential (Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry). That usage is billed directly to the end user under their own agreement with Anthropic or, for third-party inference providers, with the applicable provider."

The same page adds the API key carve-out:

> "This does not restrict how customers provision and manage their own API keys or third-party inference provider credentials — for example, configuring an API key in a development environment, secrets manager, or machine image for use by the customer's own authorized users — provided the resulting usage is billed to the key owner under their agreement with Anthropic (or the applicable provider) and is not resold or intermediated as described above."

Reading: the carve-out covers a company key used by "the customer's own authorized users" (employees, internal agents). It does not cover a company key that serves paying end users through the Claude Code binary. That is "intermediate Claude usage on their end users' behalf".

### 3.2 Agent SDK clause

Source: https://code.claude.com/docs/en/agent-sdk/overview, section "License and terms", fetched 2026-09-05. Status: CONFIRMED.

> "Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users, except to the extent a specific component or dependency is covered by a different license as indicated in that component's LICENSE file."

The Agent SDK hosting page (https://code.claude.com/docs/en/agent-sdk/hosting, fetched 2026-09-05) describes multi-tenant hosting with a company key:

> "Anthropic API: the subprocess reads ANTHROPIC_API_KEY from its environment. Supply it from your secret manager, or set ANTHROPIC_BASE_URL to route model calls through a proxy that injects the key outside the container."

> "The Agent SDK spawns and supervises a `claude` CLI subprocess that owns a shell, a working directory, and session files on disk."

> "Both the TypeScript and Python SDKs bundle a native Claude Code binary for most installs".

Commercial Terms (https://www.anthropic.com/legal/commercial-terms, "Effective June 17, 2025", fetched 2026-09-05), Section D.4:

> "Customer may not and must not attempt to (a) access the Services to build a competing product or service, including to train competing AI models or resell the Services except as expressly approved by Anthropic"

Reading: the Agent SDK path with a company API key to serve end users is the documented, permitted path. Anthropic's own hosting page shows it as a multi-tenant product pattern.

### 3.3 Which clause applies to "Claude Code CLI in a cloud sandbox, driven by the AI SDK harness adapter"

Facts:

- The Vercel AI SDK harness adapter docs (https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code, fetched 2026-09-05): "The adapter bootstraps the Claude Code bridge dependencies inside the sandbox when the first session starts." The bridge imports `@anthropic-ai/claude-agent-sdk`. Auth env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`. `auth` option: `auto`, `direct`, `ai-gateway`. No mention of OAuth, `CLAUDE_CODE_OAUTH_TOKEN`, or subscriptions. Packages: `@ai-sdk/harness`, `@ai-sdk/harness-claude-code`, `@ai-sdk/sandbox-vercel`. Status: SECONDARY (Vercel docs).
- Vercel changelog "Program Claude Code, Codex, Pi and other agent harnesses with AI SDK" is dated June 12, 2026. Status: SECONDARY.

Which clause applies:

- If the sandbox runs the `@ai-sdk/harness-claude-code` bridge, the bridge runs the Claude Agent SDK. The Agent SDK clause (3.2) applies. A company API key is the documented auth path. This is permitted under the Commercial Terms.
- If the product installs the standalone Claude Code CLI (`@anthropic-ai/claude-code` or the native binary) and runs it as a product feature, the "Claude Code in products" clause (3.1) reads on it. "Preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes...)". Then the company may NOT pay on behalf of end users. Each end user must bring their own credential.
- The Agent SDK itself bundles and spawns the same `claude` binary. Anthropic does not say on any page whether that makes the Agent SDK path subject to the "each end user must authenticate" rule. The Agent SDK clause and the hosting page say the opposite: Commercial Terms, company key, multi-tenant. Read together: the "Claude Code in products" clause targets the Claude Code product surface (the interactive CLI/binary exposed to users). The Agent SDK clause targets the library path.
- Is the AI SDK harness path documented by Anthropic? No. No Anthropic page names the Vercel AI SDK harness adapter. Status: UNVERIFIED.

Practical rule: keep the user-facing product on the Agent SDK path, with the company API key injected outside the sandbox through `ANTHROPIC_BASE_URL` or a secrets manager, per the hosting page. Do not ship a user-facing interactive Claude Code CLI on the company key. If the product must install the CLI binary as a feature (for example, users open a terminal with `claude`), then either each user signs in with their own credential inside the unmodified binary, or you get a written "mutually agreed otherwise" deal from Anthropic sales.

## 4. Question 3: "Claude Code" name in the product UI

### 4.1 Rule for products that ship the Claude Code binary

Source: https://code.claude.com/docs/en/legal-and-compliance, fetched 2026-09-05. Status: CONFIRMED.

> "Using the Claude Code name and logo. You can accurately say, in plain text, that your product has Claude Code preinstalled or that it runs Claude Code. But you can't use the Claude Code or Anthropic names or logos as part of your own product, feature, or company name, in your own logo, or in a way that suggests Anthropic built, endorses, or is partnered with your product. Any other use of Anthropic's names or logos is governed by our Trademark Guidelines and requires our written permission."

### 4.2 Rule for products built on the Agent SDK

Source: https://code.claude.com/docs/en/agent-sdk/overview, section "Branding guidelines", fetched 2026-09-05. Status: CONFIRMED.

> "For partners integrating the Claude Agent SDK, use of Claude branding is optional. When referencing Claude in your product:"

Allowed:

> "'Claude Agent', preferred for dropdown menus"
> "'Claude', when within a menu already labeled 'Agents'"
> "'{YourAgentName} Powered by Claude', if you have an existing agent name"

Not permitted:

> "'Claude Code' or 'Claude Code Agent'"
> "Claude Code-branded ASCII art or visual elements that mimic Claude Code"

> "Your product should maintain its own branding and not appear to be Claude Code or any Anthropic product. For questions about branding compliance, contact the Anthropic sales team."

### 4.3 Trademark Guidelines

Source: https://www.anthropic.com/legal/trademark-guidelines, effective August 1, 2024, fetched 2026-09-05. Status: CONFIRMED.

Trademarks may not be used "in a manner that implies Anthropic's sponsorship or endorsement" without authorization. Contact: marketing@anthropic.com.

### 4.4 Conclusion for question 3

- Agent SDK path (recommended for Wandit): do NOT show "Claude Code" in the UI. Use "Claude Agent" in a model/agent dropdown, or "Wandit Agent, Powered by Claude". Do not copy Claude Code ASCII art or the Claude Code look.
- Binary-in-sandbox path: "Runs Claude Code" in plain text is allowed. "Wandit Claude Code" or a feature named "Claude Code" is not allowed.

## 5. Implication for Wandit

1. Do not build "log in with your Claude Pro/Max account" as an auth option for the Wandit builder. Anthropic bans it on the legal page and in the Agent SDK docs. Anthropic enforced it in January 2026, March 2026 (legal letters), and April 2026 (billing cut-off). The June 2026 pause did not lift the ban on developers offering claude.ai login. It only left subscription billing unchanged for apps that already authenticate "through the Agent SDK".
2. If Zack wants a "bring your own subscription" option later, the only path the letter of the terms allows is: unmodified Claude Code binary in the sandbox, user runs `/login` through Anthropic's browser flow, Wandit never stores the token. Get written approval from Anthropic sales first ("unless previously approved").
3. The safe default: Agent SDK (via the AI SDK harness bridge) with the Wandit API key. This is permitted under the Commercial Terms "including when you use it to power products and services that you make available to your own customers and end users." Inject the key outside the sandbox. Bill users through Wandit, not through Anthropic.
4. Do not install the standalone Claude Code CLI as a user-facing feature on the Wandit key. That triggers "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf."
5. UI naming: use "Claude Agent" or "Powered by Claude". Never "Claude Code".
6. Watch items: the Agent SDK credit plan is paused, not cancelled. Anthropic said it "will share an update before anything takes effect". A future change can move Agent SDK usage off subscriptions again. This does not affect the API-key path.

## 6. Source list

Primary (Anthropic):
- Claude Code legal and compliance: https://code.claude.com/docs/en/legal-and-compliance (fetched 2026-09-05)
- Agent SDK overview: https://code.claude.com/docs/en/agent-sdk/overview (fetched 2026-09-05)
- Agent SDK quickstart: https://code.claude.com/docs/en/agent-sdk/quickstart (fetched 2026-09-05)
- Agent SDK hosting: https://code.claude.com/docs/en/agent-sdk/hosting (fetched 2026-09-05)
- Claude Code authentication: https://code.claude.com/docs/en/authentication (fetched 2026-09-05)
- Consumer Terms: https://www.anthropic.com/legal/consumer-terms (effective 2025-10-08)
- Commercial Terms: https://www.anthropic.com/legal/commercial-terms (effective 2025-06-17)
- Usage Policy: https://www.anthropic.com/legal/aup (effective 2025-09-15)
- Trademark Guidelines: https://www.anthropic.com/legal/trademark-guidelines (effective 2024-08-01)
- Help Center, Logging in to your Claude account: https://support.claude.com/en/articles/13189465-logging-in-to-your-claude-account (updated 2026-05-19)
- Help Center, Use the Claude Agent SDK with your Claude plan: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan (updated 2026-06-15)
- Claude Code CHANGELOG: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (v2.1.261, no OAuth-ban entry found)

Secondary:
- The New Stack, 2026-02-18: https://thenewstack.io/anthropic-agent-sdk-confusion/
- The Register, 2026-02-20: https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/
- OpenCode PR #18186, 2026-03-19: https://github.com/anomalyco/opencode/pull/18186
- OpenCode issue #7456, 2026-01-09: https://github.com/anomalyco/opencode/issues/7456
- anthropics/claude-code issue #12021, 2025-11-20: https://github.com/anthropics/claude-code/issues/12021
- Boris Cherny on X, 2026-04-03: https://x.com/bcherny/status/2040206440556826908
- VentureBeat, 2026-04-03: https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and
- TechCrunch, 2026-04-04: https://techcrunch.com/2026/04/04/anthropic-says-claude-code-subscribers-will-need-to-pay-extra-for-openclaw-support/
- VentureBeat, 2026-05-13: https://venturebeat.com/technology/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch
- The New Stack, 2026-06-16: https://thenewstack.io/anthropic-pauses-claude-agent-sdk-subscription-change/
- Zed blog, 2026-05-14: https://zed.dev/blog/anthropic-subscription-changes
- Zed Claude Agent page: https://zed.dev/acp/agent/claude-agent
- OpenClaw Anthropic provider docs: https://docs.openclaw.ai/providers/anthropic
- Vercel AI SDK harness, Claude Code: https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code
- Vercel changelog, 2026-06-12: https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk
