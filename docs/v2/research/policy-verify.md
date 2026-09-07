# Verification of policy-anthropic.md and policy-openai.md

Date: 2026-09-05
Method: I fetched each cited source again. I compared the exact text on the page with the quote in the report. I marked a finding REFUTED only when the quote is not on the page, is older than the current text, or is misread. All fetches are dated 2026-09-05. Pages that returned HTTP 403 (openai.com, help.openai.com) were read through the r.jina.ai reader proxy. X posts were read through the fxtwitter API.

Result: 37 of 38 findings hold. One finding is partly refuted (the "beta" label on OpenAI's Sign in with ChatGPT). Small transcription differences are listed under each item.

## 1. Anthropic findings

### A1. Third-party developers may not offer Claude.ai login or route requests through Free/Pro/Max credentials, and may not collect or store Claude.ai tokens.
Source: https://code.claude.com/docs/en/legal-and-compliance
Status: HOLDS.
Exact text on the page: "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude account must complete through Anthropic's own flow."
Note: the page shows no "last updated" date.

### A2. An end user may still sign in to the unmodified Claude Code binary with their own subscription, even when a platform hosts Claude Code.
Source: same page. Status: HOLDS.
Exact text: "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code as described under Can customers offer Claude Code in their products? above."

### A3. Agent SDK products may not offer claude.ai login unless Anthropic approved it first.
Source: https://code.claude.com/docs/en/agent-sdk/overview. Status: HOLDS.
Exact text: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."
The Quickstart (https://code.claude.com/docs/en/agent-sdk/quickstart) has the same note with "Please use the API key authentication methods described in this document instead."

### A4. Consumer Terms forbid sharing account credentials and automated access without an API key or explicit permission.
Source: https://www.anthropic.com/legal/consumer-terms, "Effective October 8, 2025". Status: HOLDS.
Exact text: "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else." and "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."

### A5. The Usage Policy has no clause on OAuth tokens or third-party tools.
Source: https://www.anthropic.com/legal/aup, "Effective September 15, 2025". Status: HOLDS.
Check: the words "OAuth" and "token" do not appear. "third party" appears once, in "Infringe, misappropriate, or violate the intellectual property rights of a third party". "harness" and "subscription" do not appear.

### A6. Help Center: API keys are the preferred path; Anthropic may allow certain third-party tools at its discretion; routing third-party traffic against subscription limits is prohibited.
Source: https://support.claude.com/en/articles/13189465-logging-in-to-your-claude-account, "Updated: May 19, 2026". Status: HOLDS.
Exact text: "The preferred way to access Anthropic services using third-party software, tools, or services ("third-party tools"), including open-source projects, is through API key authentication through Claude Console or a supported cloud provider." / "Anthropic may at its discretion allow paid subscribers who have enabled usage credits to use certain third-party tools to access Anthropic services included in paid subscription plans, but reserves the right to draw use of such third-party tools from usage credits rather than subscription limits." / "Use of third-party tools that misrepresent their identity to Anthropic's servers, attempt to route third-party traffic against subscription limits, or otherwise violate applicable terms or policies is prohibited and such use may be enforced against."

### A7. Anthropic paused the Agent SDK credit change on 2026-06-15; third-party app usage still draws from subscription limits.
Source: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan. Status: HOLDS.
Exact text: "Update June 15: We're pausing the changes to Claude Agent SDK usage described below. For now, nothing has changed: Claude Agent SDK, claude -p, and third-party app usage still draw from your subscription's usage limits. The previously announced monthly credit, which would have been available to eligible claimants in connection with these changes, isn't available. We're working to update the plan to better support how users build with Claude subscriptions. When we have an update, we'll share it before anything takes effect."
Also on the page: "Third-party apps that authenticate with your Claude subscription through the Agent SDK" and "Per-user, not pooled. Credits belong to individual accounts. They can't be shared or pooled across teammates."
Small difference: the page date reads "June 16, 2026". The report says "updated June 15, 2026". The notice itself is titled "Update June 15".

### A8. Server-side enforcement blocked subscription OAuth tokens in third-party tools from 2026-01-09. (SECONDARY)
Sources: https://github.com/anomalyco/opencode/issues/7456 and https://github.com/anthropics/claude-code/issues/12021. Status: HOLDS as SECONDARY.
Check: issue #7456, "fix: Claude Code API credentials", opened January 9, 2026, quotes "This credential is only authorized for use with Claude Code and cannot be used for other API requests." Issue #12021, opened November 20, 2025, quotes the same message: API Error 400, "This credential is only authorized for use with Claude Code and cannot be used for other API requests."
Caution: the same error existed on 2025-11-20. The start date 2026-01-09 comes from press and GitHub reports, not from an Anthropic page. Keep it SECONDARY.

### A9. Anthropic staff said the February docs edit was a clarification, not a policy change; businesses on the Agent SDK should use API keys. (SECONDARY)
Source: https://thenewstack.io/anthropic-agent-sdk-confusion/ (2026-02-18, Frederic Lardinois). Status: HOLDS.
Exact text: Thariq Shihipar: "Apologies, this was a docs clean up we rolled out that's caused some confusion." / "Nothing is changing about how you can use the Agent SDK and MAX subscriptions!" / "if you're building a business on top of the Agent SDK, you should use an API key instead." Anthropic: "Nothing changes around how customers have been using their account and Anthropic will not be canceling accounts." / "The update was a clarification of existing language in our docs to make it consistent across pages."
Small difference: the report writes "that caused some confusion". The article has "that's caused some confusion".

### A10. Anthropic engineer stated third-party harnesses using subscriptions are prohibited by the Terms. (SECONDARY)
Source: https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/ (2026-02-20). Status: HOLDS.
Exact text: "Third-party harnesses using Claude subscriptions create problems for users and are prohibited by our Terms of Service." / "They generate unusual traffic patterns without any of the usual telemetry that the Claude Code harness provides..."
Caution: the article also quotes the February 2026 legal page: "Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service — including the Agent SDK — is not permitted and constitutes a violation of the Consumer Terms of Service." That sentence is NOT on the current legal page. The current page uses the A1 wording. Do not quote the February sentence as current terms.

### A11. Anthropic legal contacted OpenCode; OpenCode removed the Claude Pro/Max OAuth login flow. (SECONDARY)
Source: https://github.com/anomalyco/opencode/pull/18186. Status: HOLDS.
Check: PR title "anthropic legal requests", author thdxr, merged March 19, 2026, body "Remove anthropic references per legal requests". Changes include "Remove opencode-anthropic-auth builtin plugin" and "Remove anthropic-20250930.txt prompt file". The PR does not name the sender of the legal request. The inference "Anthropic legal" comes from the PR title only.

### A12. Anthropic cut subscription coverage for third-party tools on 2026-04-04. (SECONDARY)
Source: https://x.com/bcherny/status/2040206440556826908 via fxtwitter. Status: HOLDS.
Exact text (Boris Cherny, Fri Apr 03 23:14:55 UTC 2026): "Starting tomorrow at 12pm PT, Claude subscriptions will no longer cover usage on third-party tools like OpenClaw. You can still use these tools with your Claude login via extra usage bundles (now available at a discount), or with a Claude API key."
VentureBeat (2026-04-03) also quotes: "our subscriptions weren't built for the usage patterns of these third-party tools".

### A13. May 2026 Agent SDK credit announcement; press named Conductor, Zed, Jean, T3 Code, OpenClaw. (SECONDARY)
Source: VentureBeat, 2026-05-13. Status: HOLDS.
Check: Lydia Hallie quote present: "To add some clarity: you don't pay extra. It's the same subscription, same price per month." The names T3 Code, Conductor, Zed, and Jean come from Theo Browne's post, quoted by VentureBeat, not from Anthropic. OpenClaw is named by VentureBeat itself. The report says "press names". That is correct.

### A14. Anthropic sent a ban or legal notice to Kilo Code. (UNVERIFIED)
Status: STILL UNVERIFIED. A web search for "Kilo Code Anthropic subscription OAuth ban legal notice 2026" returned no source that names Kilo Code.

### A15. The Claude Code changelog records the OAuth block. (UNVERIFIED)
Source: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md, top version 2.1.261. Status: STILL UNVERIFIED, and the report is correct that no entry exists. OAuth lines in the changelog concern MCP sign-in and the apps gateway only. No line records a block on third-party OAuth use.

### A16. A public partner program grants third-party products the right to offer claude.ai login. (UNVERIFIED)
Status: STILL UNVERIFIED. The docs say "Unless previously approved" and point to the sales team. No page describes an application or an approved list.

### A17. Running Claude Code in a hosted product requires the Commercial Terms and forbids paying on behalf of end users.
Source: legal page. Status: HOLDS.
Exact text: "Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure) requires agreeing to our Commercial Terms of Service and complying with the conditions below:" / "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf. Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential (Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry)."

### A18. The Claude Code binary must not be modified and built-in auth methods must not be removed.
Source: legal page. Status: HOLDS.
Exact text: "The Claude Code binary must not be modified. Claude Code must be installed and run as published by Anthropic, and customers may not remove, disable, or restrict any authentication method built into it (including methods that permit signing in with a Claude account or the user's own API key)."

### A19. The Agent SDK may power products for a company's own customers and end users under the Commercial Terms.
Source: Agent SDK overview. Status: HOLDS.
Exact text: "Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users, except to the extent a specific component or dependency is covered by a different license as indicated in that component's LICENSE file."
Commercial Terms (Effective June 17, 2025) agree: "Subject to these Terms, Anthropic gives Customer permission to use the Services, including to power products and services Customer makes available to its own customers and end users ("Users")."

### A20. The Agent SDK hosting page documents multi-tenant hosting with a company API key.
Source: https://code.claude.com/docs/en/agent-sdk/hosting. Status: HOLDS.
Exact text: "Anthropic API: the subprocess reads ANTHROPIC_API_KEY from its environment. Supply it from your secret manager, or set ANTHROPIC_BASE_URL to route model calls through a proxy that injects the key outside the container." The page has a "Multi-tenant isolation" section. Also: "The Agent SDK spawns and supervises a claude CLI subprocess..." and "Both the TypeScript and Python SDKs bundle a native Claude Code binary for most installs".

### A21. The Vercel AI SDK Claude Code harness adapter authenticates with API keys and does not mention OAuth or subscriptions. (SECONDARY)
Source: https://ai-sdk.dev/providers/ai-sdk-harnesses/claude-code. Status: HOLDS.
Exact text: "The adapter bootstraps the Claude Code bridge dependencies inside the sandbox when the first session starts." Auth variables listed: ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, AI Gateway credentials. The words "OAuth" and "subscription" do not appear.

### A22. Anthropic documents the AI SDK harness adapter path. (UNVERIFIED)
Status: STILL UNVERIFIED. A site search of code.claude.com found no page that names the Vercel AI SDK harness adapter.

### A23. Products that ship the binary may say "runs Claude Code" in plain text but may not use the name in a product or feature name.
Source: legal page. Status: HOLDS.
Exact text: "You can accurately say, in plain text, that your product has Claude Code preinstalled or that it runs Claude Code. But you can't use the Claude Code or Anthropic names or logos as part of your own product, feature, or company name, in your own logo, or in a way that suggests Anthropic built, endorses, or is partnered with your product."

### A24. Agent SDK branding: no "Claude Code" or "Claude Code Agent"; use "Claude Agent", "Claude", or "{YourAgentName} Powered by Claude".
Source: Agent SDK overview, "Branding guidelines". Status: HOLDS. All list items match the page word for word.

### A25. Trademark Guidelines bar uses that imply sponsorship or endorsement.
Source: https://www.anthropic.com/legal/trademark-guidelines, "Effective August 1, 2024". Status: HOLDS.
Exact text: "You may not use our trademarks in a manner that implies Anthropic's sponsorship or endorsement, or a relationship or affiliation with Anthropic, except as we expressly authorize."

## 2. OpenAI findings

### O1. OpenAI permits a ChatGPT subscription in official and OSS third-party clients; sub2api is not supported and is flagged.
Source: https://x.com/thsottiaux/status/2090675027670978569 via fxtwitter. Status: HOLDS.
Exact text (Tibo, Fri Aug 21 05:39:04 UTC 2026): "Converting a subscription into api traffic to then re-serve or share across many users is not something we support and this type of usage gets flagged by our fraud-prevention systems. You are completely fine if you use your subscription through Sign in With ChatGPT, either through the official clients or through one of the many OSS clients (Pi, OpenCode, ...) that support signing in with your account and using your included usage."
Caution: this is a staff post on X, not a terms page. The account shows the display name "Tibo". The title "Codex lead" is not on the post.

### O2. About 10% of Codex production traffic runs on Pi and OpenCode.
Source: https://x.com/thsottiaux/status/2058071172361998482 via fxtwitter. Status: HOLDS.
Exact text (Sat May 23 06:22:59 UTC 2026): "About 5% of our production traffic is on the Pi harness, about another 5% is on OpenCode. Reminder you can use your ChatGPT account in a flourishing set of other tools."

### O3. Sam Altman endorsed signing in to OpenClaw with a ChatGPT subscription.
Source: https://x.com/sama/status/2050357911915028689 via fxtwitter. Status: HOLDS.
Exact text (Fri May 01 23:33:14 UTC 2026): "you can sign in to openclaw with your chatgpt account now and use your subscription there! happy lobstering."

### O4. Codex app-server docs invite deep integrations and ask developers to identify the client.
Source: https://developers.openai.com/codex/app-server (308 redirect to https://learn.chatgpt.com/docs/app-server). Status: HOLDS.
Exact text: "Use it when you want a deep integration inside your own product: authentication, conversation history, approvals, and streamed agent events." / "Use clientInfo.name to identify your client for the OpenAI Compliance Logs Platform." / "If you are developing a new Codex integration intended for enterprise use, please contact OpenAI to get it added to a known clients list."

### O5. Codex with ChatGPT sign-in is included in all ChatGPT plans, with five-hour and weekly limits.
Sources: https://learn.chatgpt.com/docs/pricing ; https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan ("Updated: 6 days ago"). Status: HOLDS.
Exact text: "ChatGPT Work and Codex are included in your ChatGPT Free, Go, Plus, Pro, Business, Edu, or Enterprise plan" / "Codex is included across ChatGPT plans, including Free and Go. Usage limits vary by plan." / "Using a full banked reset refreshes your 5-hour and weekly Codex usage windows and changes your weekly reset time."

### O6. Identity-provider "Sign in with ChatGPT" shares only identity data; it is a beta with six named partners; no developer application page found.
Source: https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt ("Updated: 30 days ago"). Status: PARTLY REFUTED.
What holds: "the external application receives only your name, email address, and profile picture, if you have one." / "Initial participating partners include Airtable, GitLab, HubSpot, Notion, Supabase, and Vercel."
What fails: the word "beta" does not appear on the Help Center page (0 matches). The page says "is rolling out across select plugins and partner sites". The "beta" label comes from secondary press (RuntimeWire, TechTimes). Relabel "beta" as SECONDARY. The claim "grants no Codex or model access" is an inference from "receives only your name, email address, and profile picture". The page does not say "no Codex access" in those words.

### O7. OpenAI Terms of Use forbid credential sharing and rate-limit circumvention; no clause on Codex, Sign in with ChatGPT, or third-party clients.
Source: https://openai.com/policies/terms-of-use/ via r.jina.ai. Status: HOLDS.
Exact text: "You may not share your account credentials or make your account available to anyone else and are responsible for all activities that occur under your account." / "Interfere with or disrupt our Services, including circumvent any rate limits or restrictions or bypass any protective measures or safety mitigations we put on our Services." The words "Codex", "Sign in with ChatGPT", and "harness" do not appear. No "Effective" date line is in the proxy text. Date: UNVERIFIED.

### O8. "Reselling access or using ChatGPT to power third-party services" is a Terms clause. (REFUTED in the report)
Status: the refutation HOLDS. The words "Reselling" and "power third-party services" do not appear in the Terms text. The only "third party" sentence is: "Third party Services. Our services may include third party software, products, or services..."

### O9. Third-party tools run Codex on the user's machine or self-hosted server with the user's own login; none logs in on a vendor server.
Sources checked: T3 Code README, Conductor docs, Warp docs, Cline blog (2026-01-22), Zed blog (2026-05-15). Status: HOLDS for the five cited sources.
Exact text: T3 Code: "Codex: install Codex CLI and run codex login" and "This will launch T3 Code's backend on your machine as well as the local web app". Conductor: "Codex auth can come from Codex CLI sign-in outside Conductor or from API-key based access." Warp: "Select Sign in with ChatGPT and authenticate with your ChatGPT account (recommended)." and "Your Codex usage is included in your ChatGPT plan." Cline: "Your OpenAI credentials never leave OpenAI's servers; Cline only receives the access tokens needed to make API calls on your behalf." Zed: "We're grateful that OpenAI continues to support subscription-based access for third-party tools, even as others move toward usage-based billing."
Small difference: the Conductor page does not contain the word "macOS". The "native macOS app" description in the table comes from elsewhere. JetBrains, Cursor, and OpenClaw sources were not re-fetched in this pass.

### O10. No written OpenAI rule on a hosted multi-tenant product that stores user ChatGPT OAuth tokens, or on charging money while the user brings a subscription. (UNVERIFIED)
Status: STILL UNVERIFIED. No such text was found on the Terms, the Help Center pages, or the Codex docs read in this pass.

### O11. Enforcement history: sub2api flagged in August 2026; May 2026 ban reports name no tool; no action against a hosted Codex OAuth proxy found. (SECONDARY)
Source: https://community.openai.com/t/.../1381906 (2026-05-27). Status: HOLDS.
Check: the first post says the account "was banned with an absolute block and zero prior warning". OpenAI_Support (Smith) replied on May 28, 2026: "Thanks for sharing everything. I'll work on the support case you created and help get this resolved." No third-party tool is named in the thread.

### O12. Anthropic comparison text in the OpenAI report.
Source: Claude Code legal page. Status: HOLDS. All quotes match the current page text (see A1, A2, A17, A18).

### O13. Anthropic cut coverage 2026-04-04, announced a credit for 2026-06-15, then paused it.
Sources: Boris Cherny post, Help Center 15036540. Status: HOLDS. See A7 and A12.

## 3. Missing: questions the reports do not answer

1. Anthropic: who grants "previously approved" status for claude.ai login on Agent SDK products, how to apply, and whether any approved list exists. No page answers this.
2. Anthropic: whether the Agent SDK's bundled Claude Code binary counts as "preinstalling or running Claude Code in your products" (the per-user credential rule) or only as a library under the Commercial Terms. No page reconciles the two clauses.
3. Anthropic: whether the "unmodified Claude Code binary" exception allows a hosted platform to show Anthropic's login flow inside its own web UI (for example a web terminal) and what "the product never touches the token" means in a hosted sandbox where the platform owns the disk that stores ~/.claude/.credentials.json.
4. Anthropic: the conflict between the April 2026 statement ("Claude subscriptions will no longer cover usage on third-party tools like OpenClaw") and the June 2026 Help Center notice ("third-party app usage still draw from your subscription's usage limits"). No primary source says which one is in force for a tool that is not built on the Agent SDK.
5. Anthropic: the exact start date of server-side OAuth blocking. Issue #12021 shows the same error on 2025-11-20. The 2026-01-09 date rests on reports only.
6. Anthropic: whether Kilo Code, Conductor, T3 Code, or Zed hold any written approval. No source.
7. Anthropic: the legal page has no visible "last updated" date. The reports cannot show when the current wording took effect.
8. OpenAI: the effective date of the current Terms of Use was not captured through the proxy.
9. OpenAI: the Help Center article "Codex CLI and Sign in with ChatGPT" (11381614) now redirects to a Codex CLI docs page. Its original text was not read. It may contain rules on third-party use.
10. OpenAI: whether a paid, commercial third-party product may use Sign in with ChatGPT for Codex; whether a hosted multi-tenant product may hold user tokens on its servers; whether OpenAI can revoke a client. No written rule was found.
11. OpenAI: whether third-party clients face different rate limits, and whether the "known clients list" is required for non-enterprise integrations.
12. OpenAI: the developer application path for the identity-provider Sign in with ChatGPT.
13. Both: no report quotes the Claude Code authentication page (https://code.claude.com/docs/en/authentication) or the OpenAI auth docs (https://learn.chatgpt.com/docs/auth) in full for the headless and remote-machine cases. Those pages may bear on hosted sandboxes.
