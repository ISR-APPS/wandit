# Wandit V2 decision log

This file records the choices that only the founder makes for V2. Each entry is one Architecture Decision Record (ADR). Linear issue WANDIT-161 created the file from section 12 of `V2-ARCHITECTURE-REPORT.md`.

Rule for agents: Agents read this file before any issue. Follow the default, or the final choice when the status is confirmed or changed. Do not build on an open answer.

Status values: `default` means the tickets assume it and the founder did not decide. `confirmed` means the founder keeps the default. `changed` means the founder picks another option, so the issues in "Issues that change" need an update. `open` means no default exists and nobody decides yet.

ESTIMATE marks a number from a calculation, not a measurement. UNVERIFIED marks a claim without a checked source.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| D1 | Sandbox vendor | confirmed | 2026-09-09 |
| D2 | Price stance | changed | 2026-09-09 |
| D3 | Backends as entitlements | default | 2026-09-09 |
| D4 | First mobile preview | default | 2026-09-09 |
| D5 | Preview domain | confirmed | 2026-09-12 |
| D6 | UI kits for generated apps | confirmed | 2026-09-10 |
| D7 | Arabic, French, and English with RTL from day 1 | changed | 2026-09-12 |
| D8 | Data residency | confirmed | 2026-09-12 |
| D9 | Exit paths | changed | 2026-09-12 |
| D10 | Default model | changed | 2026-10-17 |
| D11 | V1 projects stay on V1 | changed | 2026-09-12 |
| D12 | Native app as a V2 client | confirmed | 2026-09-12 |
| D13 | Multiple conversations and branches per project | open | 2026-09-09 |
| D14 | Install the user app with its own icon on the phone | open | 2026-09-09 |
| D15 | Web template stack | changed | 2026-09-12 |
| D16 | Self-hosting on a user VPS | open | 2026-09-12 |
| D17 | Harness: Claude Code or OpenCode | default | 2026-09-13 |
| D18 | Backend creation moment | changed | 2026-09-12 |
| D19 | Pixels and third-party scripts in user apps | changed | 2026-09-13 |
| D20 | Turn stream transport to the browser | open | 2026-09-14 |
| D21 | Durable git store for project code | changed | 2026-09-14 |
| D22 | Apple developer account for iOS builds | confirmed | 2026-09-26 |
| D23 | Price of a mobile build | changed | 2026-09-26 |
| D24 | Turn stream store when the harness host runs the turn (D20 change) | open | 2026-10-01 |
| D25 | Visual edit of text and colors in the V2 preview | default | 2026-10-04 |
| D26 | App design recipe picked by the host | default | 2026-10-04 |
| D27 | Plan Mode | default | 2026-10-05 |
| D28 | App theme owned by the host (D26 change) | default | 2026-10-26 |
| D29 | External coding agents through a remote MCP server | confirmed | 2026-11-04 |
| D30 | Desktop app stack | default | 2026-11-04 |
| D31 | Trust split of desktop builds | default | 2026-11-04 |
| D32 | Price of a desktop build | default | 2026-11-04 |
| D33 | Additive-only migrations of desktop databases | default | 2026-11-04 |
| D34 | No Authenticode signature on desktop installers yet | default | 2026-11-04 |
| D35 | Desktop rollback by rebuild, and 2 live builds per payer | changed | 2026-11-05 |
| D36 | macOS desktop builds: ad-hoc signature first | confirmed | 2026-11-05 |
| D37 | Electron as a second, experimental desktop engine | confirmed | 2026-11-12 |

## D1. Sandbox vendor

- Question: Which vendor runs the sandbox that holds Claude Code, Vite, and Metro for one project?
- Options: Vercel Sandbox: Firecracker, the only harness adapter, about $0.13 per hour, public URLs that need a proxy. Cloudflare Sandboxes: GA since 2026-04, disk snapshots, same stack, $0.08 to $0.22 per hour. It needs a custom harness adapter of about 2 weeks. E2B: $0.166 per hour plus $150 per month, a custom provider of ESTIMATE 2 or more weeks.
- Default: Vercel Sandbox Pro in `cdg1` (Paris), behind a `SandboxProvider` interface.
- Final choice: Vercel Sandbox Pro in `cdg1`, behind the `SandboxProvider` interface.
- Status: confirmed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-09.
- Issues that change: WANDIT-149 (P0-02), WANDIT-164 (P1-03), WANDIT-170 (P1-09), WANDIT-180 (P2-05).
- Notes: Vercel adds a fourth runtime vendor. A move to Cloudflare saves under $1 per project monthly. Source: report 6.2 and 8.3.

## D2. Price stance

- Question: Does wandit keep the V1 price rule for V2 turns, or lower the margin?
- Options: Keep `1 credit = $0.04` at a 72 percent margin: $25 on Pro buys about 17 typical messages. Lower the margin to 35 to 65 percent: more messages per $25, less profit. Lovable sells about 100 messages for $25 at about 35 percent margin (secondary source).
- Default: keep `1 credit = $0.04`. Measure real step counts and token sizes in staging for 2 weeks. Then fix the credit mapping.
- Final choice: Keep the current credit rule. Since pricing v7, `1 credit = $0.032`, not $0.04. See `docs/features/pricing-v7-032-anchor.md`.
- Status: changed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-09.
- Issues that change: WANDIT-151 (P0-04), WANDIT-174 (P1-13), WANDIT-182 (P2-06).
- Notes: A typical message costs about $0.44, about 10 credits. Do not bill from `total_cost_usd`. Count tokens with the wandit price table. Source: report 6.10. The $0.04 number in the tickets is history. WANDIT-151, WANDIT-174, and WANDIT-182 must use $0.032.

## D3. Backends as entitlements

- Question: How does a user pay for the Supabase backend?
- Options: Entitlement per plan: fixed live backends per plan, plus a paid add-on. Pay per credit: a Micro instance costs about $9.8 per month, more than the AI budget of Pro.
- Default: 1 live backend on Pro, 3 on Business, a $10 per month add-on. Pause after 7 idle days, restore with a "waking up" state.
- Final choice: none yet.
- Status: default
- Date: 2026-09-09
- Decided by: nobody yet. Report section 12 sets the default.
- Issues that change: WANDIT-184 (P3-02), WANDIT-174 (P1-13), WANDIT-182 (P2-06).
- Notes: A paused project costs nothing. $10 is the public price. Supabase for Platforms: meeting 2026-09-10, about $2,000 per month flat (UNVERIFIED), contract due the week of 2026-09-14. Numbers follow the contract. Provisioning is now P1, see D18. Source: report 6.4.

## D4. First mobile preview

- Question: Where does the user first see the generated Expo app?
- Options: The phone of the user with Expo Go and a QR code: free, but Expo Go has 1 fixed SDK and OAuth login does not work. A wandit preview app with expo-dev-client: EAS builds cost $1 to $4 each after 15 free per month. Appetize in the browser: $59 per month for 500 minutes.
- Default: the phone of the user, through the Expo web frame plus a QR code. Browser devices come later.
- Final choice: none yet.
- Status: default
- Date: 2026-09-09
- Decided by: nobody yet. Report section 12 sets the default.
- Issues that change: WANDIT-193 (P4-03), WANDIT-195 (P5-01), WANDIT-196 (P5-02).
- Notes: Zack, 2026-09-09: no decision yet. Mobile apps come for sure, so P1 code keeps the mobile path open. Source: report 6.5. Zack, 2026-09-26 (WANDIT-193): the phone link of Expo Go lives 60 minutes, not 15. Expo Go takes no cookie, so it cannot renew a token during a Fast Refresh session. The iframe token stays at 15 minutes. Findings: `docs/v2/spikes/P4-03-expo-go.md`. WANDIT-196 (2026-09-26): Appetize runs the store Expo Go builds, not a wandit preview app. Device minutes per UTC month: starter 0, pro 60, business 180 (ESTIMATE; Zack decides). Findings: `docs/v2/spikes/P5-02-appetize.md`.

## D5. Preview domain

- Question: On which domain does the user see the app during the build?
- Options: A separate domain: the preview iframe needs `allow-same-origin`. One origin per project on a separate domain keeps the wandit cookies safe. It needs a purchase and a Public Suffix List entry. A 1-level host on `wandit.app`: no purchase, but the cookie risk is larger than the convenience.
- Default: a separate domain, bought in P0. The builder stays on `wandit.dev`. Published sites stay on `*.wandit.app`.
- Final choice: a separate domain, `wanditpreview.app`, name final at purchase.
- Status: confirmed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-155 (P0-08), WANDIT-170 (P1-09), WANDIT-173 (P1-12).
- Notes: WANDIT-155 still needs the staging domain choice: a second domain, or Advanced Certificate Manager. Source: report 6.9 and 8.3.

## D6. UI kits for generated apps

- Question: Which component kits do the web and mobile templates use?
- Options: Web: shadcn/ui is the safe default. Mobile: HeroUI Native with Uniwind, as in `apps/native`, so the team knows it. Or plain Expo components, with fewer dependencies.
- Default: shadcn/ui for the web. HeroUI Native with Uniwind for mobile, as in `apps/native`.
- Final choice: shadcn/ui on web. HeroUI Native with Uniwind on mobile, probable, final with D4.
- Status: confirmed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-10.
- Issues that change: WANDIT-168 (P1-07), WANDIT-191 (P4-01).
- Notes: Long term, Zack adds ready-made dashboards and templates, or a design tool with an MCP, so the agent fetches designs. Source: report 12.

## D7. Arabic, French, and English with RTL from day 1

- Question: Do generated apps support Arabic, French, and English, with right-to-left text, from the first template?
- Options: From day 1: V1 pages require it, but it adds template and prompt work in P1. Later: less P1 work, but the first V2 apps miss what V1 pages require.
- Default: Arabic, French, and English, with RTL, from day 1.
- Final choice: the template supports all three with RTL. The user picks the app languages at project creation, and the agent builds in those only.
- Status: changed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-168 (P1-07), WANDIT-172 (P1-11), WANDIT-173 (P1-12), WANDIT-179 (P2-03), WANDIT-191 (P4-01).
- Notes: The wandit platform itself stays in three languages. WANDIT-175 adds the language choice to project creation. Source: report 12.
- Update 2026-10-04 (Zack): an app ships one language. The agent asks once; with no answer, French for a French-writing user, else English. `projects.languages` is a hint only. The template keeps i18n and RTL ready.

## D8. Data residency

- Question: Where do the data of a user and the model calls stay?
- Options: Anthropic inference runs only in `us` or `global`, 30-day retention. Supabase has 6 EU regions, none in Africa. The sandbox can run in Paris.
- Default: Anthropic inference in the US or global, with 30-day retention. Supabase and the sandbox in Paris. Write this in the privacy policy before external users.
- Final choice: the default. Supabase region from the user IP at creation: Europe Paris or Frankfurt, North Africa Paris, default Paris. Retention accepted.
- Status: confirmed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-164 (P1-03), WANDIT-182 (P2-06), WANDIT-183 (P3-01) picks the region from the IP.
- Notes: The model provider can differ from Anthropic, see D10. The privacy text names the providers in use. Source: report 6.9.

## D9. Exit paths

- Question: When does a user get a way to take the app out of wandit?
- Options: Build the Supabase claim export and the GitHub export in P6: the P1 to P3 work stays smaller. Build them earlier: the missing exit path of Lovable is a known complaint.
- Default: P6.
- Final choice: the Supabase claim export follows provisioning, now P1 (D18), so it can come in P2. GitHub export stays in P6. Self-hosting on a user VPS is D16.
- Status: changed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-199 (P6-03) moves after WANDIT-183, P2 at the earliest. WANDIT-198 (P6-02) stays.
- Notes: Supabase staff advise it: some apps get expensive, so the user must be able to take the project. Source: report 11 and 12; Supabase call 2026-09-10.

## D10. Default model

- Question: Which model and effort run a builder turn by default, and which modes can the user select?
- Options: Sonnet 5: $2 in, $10 out per million tokens, about $0.44 per typical message. Opus 5: 2.5 times that. Fable 5.1: 3.5 times that. Prices of 2026-09-03.
- Default: Sonnet 5 at medium effort. Opus 5 as a visible mode, Fable 5.1 off.
- Final choice: a cheaper model, not from Anthropic, at first. WANDIT-151 picks it. Anthropic models come later as paid modes.
- Status: changed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-150 (P0-03), WANDIT-151 (P0-04), WANDIT-165 (P1-04), WANDIT-166 (P1-05), WANDIT-174 (P1-13).
- Notes: Claude Code speaks the Anthropic API only, so the LLM proxy must translate for other models. WANDIT-150 tests this. See D17. Source: report 6.1 and 6.10.
- Update 2026-10-17 (Zack): test Paper Instruments `ultramarine-1-flash` for every V2 call (main, plan, helper, and subagent model). Set `V2_DEFAULT_MODEL=paperinstruments/ultramarine-1-flash`. Paper serves an Anthropic Messages endpoint, so the proxy does not translate. The CLI needs `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` and `ENABLE_TOOL_SEARCH=false`; the harness sets them for every model that is not Claude (Update 2026-10-22: also DeepSeek and GLM through the gateway). Price: $0.15 in, $0.03 cache read, $0.50 out per million tokens. Limits: no web search (the harness turns WebSearch off). No PDF and no thinking blocks of another model in the history (the proxy changes these blocks to text). Source: docs.paperinstruments.com and a CLI 2.1.281 probe.

## D11. V1 projects stay on V1

- Question: What happens to V1 page projects when V2 ships?
- Options: Keep them on V1 for ever: two engines for ever. Build "Upgrade to app" in P6: one path from a page to an app. Nothing forces a migration.
- Default: V1 projects stay on V1. "Upgrade to app" comes in P6.
- Final choice: a Migrate button per project, clicked by the user, in P6. A queue task rebuilds the page as a V2 app, copies the leads to Supabase, keeps the slug. A dated notice closes the V1 editor later. Published pages stay online.
- Status: changed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-202 (P6-06).
- Notes: No bulk migration: each one costs agent turns and can change the look. Six months of notice before the editor closes. Source: report 11, 12.

## D12. Native app as a V2 client

- Question: When does the wandit native app in `apps/native` get V2?
- Options: Keep it as a V1 client until V2 is stable on the web. Then no mobile client work exists in P1 to P5. Mirror the transport in P6: the native app gets V2 parity after the web shell is stable.
- Default: the native app stays a V1 client until P6.
- Final choice: the default. Web first, mobile after the web shell is stable.
- Status: confirmed
- Date: 2026-09-09
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-204 (P6-08).
- Notes: Source: report 11 and 12.

## D13. Multiple conversations and branches per project

- Question: Does a V2 project have several chats, each on its own git branch, with its own preview?
- Options: Not designed yet. Known: Base44 ships branches. code.storage gives branches for free, see WANDIT-152 (P0-05). A branch per chat needs `Sandbox.fork` previews and an AI merge.
- Default: none. Do not build on this answer.
- Final choice: none yet.
- Status: open
- Date: 2026-09-09
- Decided by: nobody yet.
- Issues that change: WANDIT-197 (P6-01) answers this question. WANDIT-171 (P1-10) and WANDIT-173 (P1-12) are its inputs.
- Notes: Source: report 11, P6.

## D14. Install the user app with its own icon on the phone

- Question: How does a user install the generated app on a phone with its own icon, like Rork?
- Options: TestFlight: the Apple channel for test versions. Ad-hoc: an Apple install for a fixed list of 100 devices per year. A PWA: a web app that the phone installs like an app. The companion app: WANDIT-195 (P5-01).
- Default: none. Do not build on this answer.
- Final choice: none yet.
- Status: open
- Date: 2026-09-09
- Decided by: nobody yet.
- Issues that change: WANDIT-205 (P6-09) answers this question.
- Notes: Rork is another app builder. Source: report 11, P6, and the parked items.

## D15. Web template stack

- Question: Which stack does the web app template use, and does a published app need a server?
- Options: Vite SPA with React, Tailwind, shadcn/ui, Supabase: static files, no server. TanStack Start on Vite: SSR and server functions, so a published app needs Node or a Cloudflare Worker. Its SPA mode gives static files only.
- Default: the Vite SPA above, as the report assumes.
- Final choice: TanStack Start, Tailwind, shadcn/ui, Supabase. Publish as one Cloudflare Worker per app (Workers for Platforms), files inside the Worker, SSR and server functions on.
- Status: changed
- Date: 2026-09-12
- Decided by: Zack, 2026-09-10 and 2026-09-12.
- Issues that change: WANDIT-168 (P1-07), WANDIT-177 (P2-01), WANDIT-178 (P2-02), WANDIT-200 (P6-04).
- Notes: WANDIT-200 moves from P6 into P2, before WANDIT-178. R2 keeps V1 pages, uploads, and git bundles. Lovable publishes the same way since 2026-05-13.
## D16. Self-hosting on a user VPS

- Question: Can a user move a published app to a VPS that the user owns, with wandit doing the setup?
- Options: Not designed yet. Known: wandit connects over SSH, installs the runtime, deploys the app and a Postgres, and keeps updating it. Or wandit exports a Docker Compose bundle and the user runs it. Lovable offers neither.
- Default: none. Do not build on this answer.
- Final choice: none yet.
- Status: open
- Date: 2026-09-12
- Decided by: nobody yet.
- Issues that change: none yet. A new P6 issue designs it, after WANDIT-198 and WANDIT-199.
- Notes: Zack wants it as a difference from Lovable and a cheaper path for heavy users. Source: Zack, 2026-09-12.

## D17. Harness: Claude Code or OpenCode

- Question: Which coding agent runs inside the sandbox: the Claude Code adapter of the AI SDK harness, or OpenCode?
- Options: Claude Code: the only adapter tested in the report, speaks the Anthropic API only, so other models need a translating proxy, and the license answer of WANDIT-154 applies. OpenCode: open source, talks to many model providers directly, no Anthropic license question, adapter maturity UNVERIFIED.
- Default: Claude Code, as the report assumes.
- Final choice: Claude Code first, behind the harness interface. OpenCode is tested later, after the foundation works.
- Status: default
- Date: 2026-09-12
- Decided by: Zack, 2026-09-13, for the order only.
- Issues that change: WANDIT-149 (P0-02), WANDIT-150 (P0-03), WANDIT-151 (P0-04), WANDIT-166 (P1-05), WANDIT-168 (P1-07).
- Notes: WANDIT-149 runs Claude Code first. A later run repeats the same prompts on OpenCode. Source: Zack, 2026-09-12 and 2026-09-13.

## D18. Backend creation moment

- Question: When does wandit create the Supabase project of a user app?
- Options: On first need: the agent calls `ensure_backend` when the app first needs login, data, or storage. Fewer projects, one more state. At creation: every project gets a backend at once, paused when idle. Simpler code and prompts.
- Default: on first need, as the report assumes.
- Final choice: at project creation, always. Provisioning joins the first working slice of P1, in a small form. The Cloud tab UI stays in P3.
- Status: changed
- Date: 2026-09-12
- Decided by: Zack, 2026-09-12.
- Issues that change: WANDIT-183 (P3-01) moves into P1, after WANDIT-163. WANDIT-175 (P1-14) calls it at creation. WANDIT-186 (P3-04) drops `ensure_backend`.
- Notes: Check the per-project price in the Supabase for Platforms contract before the first external users. Source: report 6.4; Zack, 2026-09-12.

## D19. Pixels and third-party scripts in user apps

- Question: How do pixels and other third-party scripts get into a user app?
- Options: A settings panel plus injection at publish, as in V1: fixed list, page view only. Or the agent edits the code: any script, any event.
- Default: the V1 way, pixel ids as Worker bindings read by the template.
- Final choice: the agent does it. The user gives the id in the chat, the agent puts the tag in the root route head. No settings panel for V2. The wandit badge stays outside the app code: the edge Worker adds it, or V2 drops it (open).
- Status: changed
- Date: 2026-09-13
- Decided by: Zack, 2026-09-13.
- Issues that change: WANDIT-178, WANDIT-168, WANDIT-173.
- Notes: Linear edits wait for the next batch. The leads SDK stays in the template. Source: Zack, 2026-09-13.
- Update 2026-10-04: WANDIT-179 is cancelled. The leads SDK stub is gone from the template (c90761e6). A public form writes to the app's own table (WANDIT-273).

## D20. Turn stream transport to the browser

- Question: How do harness events reach the browser during a turn, and after a refresh?
- Options: A. Trigger.dev stream. B. Redis Stream. The task writes, the API forwards as SSE. One store only. Postgres holds the finished messages.
- Default: A, behind one write function and one read function.
- Final choice: open. Pick B if the hello-world p50 chunk lag is above 300 ms, or the stream API fails.
- Status: open
- Date: 2026-09-14
- Decided by: open.
- Issues that change: WANDIT-157, WANDIT-166, WANDIT-172.
- Notes: The browser talks only to the API. Resume is `useChat({ resume: true })`: a plain GET, no cursor header, the API replays from the start. The history GET hides the in-flight assistant message while the turn runs. Redis is in `sfo`, the API in `europe-west4`. A task write to Redis needs TLS or an HTTPS hop.

## D21. Durable git store for project code

- Question: Where does the git history of a project live between turns? The sandbox disk is not durable.
- Options: R2 bundles: `git bundle` after each turn, upload to R2, unpack on resume. Or code.storage: a hosted git remote per project, push and pull like GitHub.
- Default: R2 bundles, from the report (section 6, Versions).
- Final choice: code.storage. One wandit account, one repository per project. The sandbox pushes after each turn and pulls on resume.
- Status: changed
- Date: 2026-09-14
- Decided by: Zack, 2026-09-14.
- Issues that change: WANDIT-152, WANDIT-171, WANDIT-156.
- Notes: Price from their page, 2026-09-13: $20 per month minimum, about $3.65 per GB per month hot, $0.15 cold, $0.06 per GB push, $0.15 per GB fetch. UNVERIFIED: how the per-repository short-lived credentials work. Check it in WANDIT-152 before WANDIT-171. Real branches make D13 possible later.

## D22. Apple developer account for iOS builds

- Question: Whose Apple developer account signs the iOS build of a user app, for TestFlight?
- Options: The user brings their own account, and wandit shows the steps. Or one wandit-owned account, with bundle ids under a wandit prefix.
- Default: the user brings their own account.
- Final choice: the user's own account. wandit never publishes user apps under a wandit-owned Apple account. Apple rule 4.2.6 rejects apps made from a template service when the service submits them.
- Status: confirmed
- Date: 2026-09-26
- Decided by: Zack, 2026-09-26.
- Issues that change: WANDIT-194 (P4-04) builds Android APKs only. WANDIT-284 builds iOS with the user Apple key.
- Notes: Source: Zack, Linear comment on WANDIT-194, 2026-09-26.

## D23. Price of a mobile build

- Question: What does one EAS build cost the user?
- Options: A new operation `mobile_build` near the EAS price: Android $1, iOS $2. A plan entitlement adds free builds per month: 2 on Pro, 10 on Business. Or builds are free inside the plan.
- Default: `mobile_build` at 25 credits per Android build (ESTIMATE), with a hold at the start, a settle at the end, and a refund on failure or cancel. No plan entitlement yet.
- Final choice: 50 credits per Android build, with the same hold, settle, and refund. No plan entitlement yet.
- Status: changed
- Date: 2026-09-26
- Decided by: Zack, 2026-09-26.
- Issues that change: WANDIT-194 (P4-04), WANDIT-284.
- Notes: EAS gives 15 free Android builds per month, then $1 to $2 each (`research/expo-mobile.md` 2.4). At $0.032 per credit (D2), 50 credits are $1.60. The default EAS worker costs about $1. The issue text used $0.04 per credit. The hold admits any positive balance, like the other operations. Source: Zack, Linear comment on WANDIT-194, 2026-09-26.

## D24. Turn stream store when the harness host runs the turn (D20 change)

- Question: A host-run turn has no Trigger run, so it cannot write the Trigger `ui` stream. Where do its events go?
- Options: A. The store follows the row: `runner = trigger` uses the Trigger stream, `runner = host` uses a Redis Stream `builder:turn:<turnId>:events`. B. All turns on both paths write the Redis Stream (D20 option B). C. The Trigger task keeps the turn and sends harness I/O through the host (no new store).
- Default: A, built in the `claude-code-fast` worktree. It changes D20 "One store only" to one store per turn.
- Final choice: none yet.
- Status: open
- Date: 2026-10-01
- Decided by: nobody yet.
- Issues that change: WANDIT-166, WANDIT-172.
- Notes: The relay and the resume GET read the store the row names. B removes the second store but moves every Trigger turn to Redis in `sfo`, about 150 ms per write from `europe-west4` (ESTIMATE). C keeps the 1.6 s Trigger start.

## D25. Visual edit of text and colors in the V2 preview

- Question: Does the V2 preview get a visual edit mode, where the user changes a text or a color without a turn?
- Options: A. Skip it for now. Click-to-edit sends the picked elements with the next message, and the agent edits the code. B. Build it now: the bridge edits the DOM, and the API writes the change into the source file without the agent.
- Default: A.
- Final choice: none yet.
- Status: default
- Date: 2026-10-04
- Decided by: nobody yet.
- Issues that change: WANDIT-203.
- Notes: B is not cheap. A text often comes from `t("key")` in three dictionary files, and a color comes from a class or a token in `tokens.css`. A safe source write needs an AST edit, a commit, and a conflict rule with a running turn. WANDIT-203 puts the V1 save-batch model out of scope. Revisit when users ask for it.

## D26. App design recipe picked by the host

- Question: Who picks the look and the layout of the app area behind login?
- Options: A. The agent picks. B. The host picks a recipe from a hash of the project id. C. A `projects` column stores a random recipe.
- Default: B. `domain/app-recipe.ts` writes one sentence into the session instructions. The template skill `app-dashboard` explains it.
- Final choice: none yet.
- Status: default
- Date: 2026-10-04
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: Models converge, so with A most apps look the same. The hash needs no column and keeps the prompt stable. Rendezvous hashing keeps recipes when a list grows. Theme and home give 3 ranked options: the hash cannot know the business. No hosted registry (sandbox egress), no second template (one snapshot), no template version bump. Since 2026-10-24, the host gives a theme seed, home (12, 3 ranked), kpi, and chart. From the seed, the template script `scripts/apply-theme.mjs` deals 3 of the 24 theme presets and the structure axes of the chosen preset. The UI kit of the template renders each value.
- Update 2026-10-26: D28 replaces the theme part of this entry. The recipe keeps home, kpi, and chart.

## D27. Plan Mode

- Question: How does the V2 builder plan an app with a non-technical user before it builds?
- Options: A. A `mode` on each turn. A plan turn gets only `ask_user` and a new `present_plan` host tool, and `inactiveTools` blocks the built-in tools that write, run, or start an agent. B. Native Claude Code plan mode (`permissionMode: "plan"`, `ExitPlanMode`).
- Default: A. "Build this plan" starts a build turn with the approved plan in its prompt.
- Final choice: the product rules of A. The Plan toggle is on for a new V2 project and off after a build. A plan turn pays its real usage.
- Status: default
- Date: 2026-10-05
- Decided by: Zack, for the product rules only.
- Issues that change: none filed yet.
- Notes: B is rejected. A session that starts with bypass permissions still runs Write and Bash in plan mode, so only prompt text stops edits. `ExitPlanMode` reads the plan from `~/.claude/plans`, and the template hook blocks that write. The plan-mode footer names `AskUserQuestion`, which Wandit disables. B also needs a bridge fork change and a new template snapshot.

## D28. App theme owned by the host (D26 change)

- Question: Who writes the look of a web app, and how does the user change it?
- Options: A. The agent writes the theme with a template script (D26). B. The host writes `src/styles/theme.json`, the user picks the look, and the builder saves it with no agent turn.
- Default: B, for `web-app@1.1.0` and later. This is D25 option B for the theme only.
- Final choice: none yet.
- Status: default
- Date: 2026-10-26
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: With A, the agent wrote capital labels and ink bands from prose. The schema of B cannot express them. The user picks one of 3 cards in the first `ask_user` call, or edits each field in the builder. The agent calls `set_theme` for the user's words. The host restores a file that a turn changed. Older projects keep D26.

## D29. External coding agents through a remote MCP server

- Question: How does a user work on a V2 project from an external coding agent (Claude Code, Codex, Cursor)?
- Options: A. A remote MCP server on the API with OAuth, whole-account grants, and read, edit, prompt, and publish tools. B. Per-project grants. C. Prompt-only tools, as Lovable does. D. Personal access tokens.
- Default: A, on Better Auth 1.7.16 (`jwt`, `mcp`, `cimd` plugins). Direct edits are commits with source `mcp`. Approvals stay in the web app.
- Final choice: A.
- Status: confirmed
- Date: 2026-11-04
- Decided by: Zack ("the most secure option", "the way Lovable does it", all four tool groups).
- Issues that change: none filed yet.
- Notes: The Better Auth 1.6 `mcp` plugin can skip consent and stores plain-text tokens. Rules: `docs/features/coding-agents-mcp.md`.

## D30. Desktop app stack

- Question: With which stack does a user build a desktop app, for which systems, and where do its data stay?
- Options: Shell: Tauri v2 (Rust and the WebView2 of Windows, small installer) or Electron (a bundled Chromium and Node, about 10 times larger, ESTIMATE). Systems: Windows only, or Windows, macOS, and Linux. Data: one local SQLite file, or a cloud backend as in web apps.
- Default: Tauri v2, Windows x64 only, one local SQLite file per installed app, no cloud backend.
- Final choice: none yet.
- Status: default
- Date: 2026-11-04
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: macOS needs notarization and a macOS runner. Linux has many package formats. A local file works offline and costs nothing per user, but it gives no sync and no login. Contract: `docs/v2/desktop-apps.md`.
- Update 2026-11-05: D36 adds macOS. The systems are now Windows x64 and macOS on Apple silicon (D36). macOS apps ship with an ad-hoc signature first. Notarization comes later.
- Update 2026-11-12: D37 adds Electron as a second, experimental shell. Tauri stays the shell of the app type "Desktop app".

## D31. Trust split of desktop builds

- Question: Who holds the native code, the CI token, and the updater keys of a desktop app?
- Options: A. The agent edits the full Tauri project in the sandbox, and CI builds it with the signing key. B. The server owns the native shell and the keys. The project holds only the frontend and the migrations. A private CI repo compiles the trusted shell with server-made inputs. The server signs each update.
- Default: B.
- Final choice: none yet.
- Status: default
- Date: 2026-11-04
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: With A, user Rust code runs on CI and with native rights on every user machine. With B, CI runs no user code and holds no secret. The updater private key never leaves the API and the `desktop-build` task. Details: `security.md` section 14.

## D32. Price of a desktop build

- Question: What does one Windows installer build cost the user?
- Options: A fixed operation `desktop_build`, as `mobile_build` (D23). Or free builds inside the plan.
- Default: 25 credits per build (ESTIMATE). The hold starts with the request. `ready` settles it. `failed`, `blocked`, and `canceled` release it. A release or a rollback costs nothing. No plan entitlement yet.
- Final choice: none yet. Zack confirms the price.
- Status: default
- Date: 2026-11-04
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: At $0.032 per credit (D2), 25 credits are $0.80. A cold build on a 2-core Windows runner takes about 35 minutes: 10 for tauri-cli, 25 for the shell (ESTIMATE). A cached build takes about 8 minutes (ESTIMATE). At $0.016 per runner minute (2025 price, UNVERIFIED for 2026), a cold build costs about $0.56 and a cached build about $0.13. Constant: `DESKTOP_BUILD_CREDITS`.
- Update 2026-11-05: D35 makes a rollback a rebuild, so a rollback now costs one build. A release still costs nothing.
- Update 2026-11-05: a macOS build has the same price, 25 credits (D36). A macOS runner minute costs $0.062 (GitHub price page, see `tooling/desktop-builder/README.md`). A cached macOS build costs $0.31 to $0.50, and a cold one $0.62 to $1.55 (ESTIMATE). Same price, review after staging: the runbook records the job minutes (macOS staging check 2).

## D33. Additive-only migrations of desktop databases

- Question: How does a desktop app change its schema without data loss, also after a rollback?
- Options: A. Free SQL migrations, as on a server. B. Additive-only migrations: a frozen registry of the built files, and a gate that refuses a change of saved data or of an older schema. C. No migrations: one fixed key-value store.
- Default: B.
- Final choice: none yet.
- Status: default
- Date: 2026-11-04
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: Installed apps run each file once, so `desktop_migrations` freezes a built file at `ready`. The gate runs in `add_local_migration` and before CI. It refuses DROP TABLE, DELETE, RENAME, PRAGMA, and a UNIQUE index on an older table. So a rollback stays safe. Cost: no column rename and no table drop. Limit: a file can fail on saved rows. The whole update then rolls back as one transaction. A replacement file in a later build fixes the data statements (`desktop-apps.md` sections 5 and 6). A frozen DDL statement has no fix.

## D34. No Authenticode signature on desktop installers yet

- Question: Does Wandit sign the Windows installers with an Authenticode certificate?
- Options: A. No signature at first. SmartScreen shows "Windows protected your PC", and the user clicks "More info" and "Run anyway". B. An OV or EV certificate on a hardware token. A hosted CI cannot use the token easily. C. Azure Trusted Signing, a cloud signing service of about $10 per month (UNVERIFIED).
- Default: A. Follow-up: C.
- Final choice: none yet.
- Status: default
- Date: 2026-11-04
- Decided by: nobody yet.
- Issues that change: none filed yet.
- Notes: The updater signature (one Ed25519 key per app) protects each update also without Authenticode. Azure Trusted Signing accepts companies of some countries with about 3 years of history (UNVERIFIED). A Wandit certificate names Wandit as the publisher of each user app, so it also needs an abuse policy.
- Update 2026-11-05: macOS: Gatekeeper note (D36). macOS apps have no Developer ID signature and no notarization. Gatekeeper shows "Not Opened", and the user clicks Open Anyway in System Settings. The web shows these steps under the SmartScreen note.

## D35. Desktop rollback by rebuild, and 2 live builds per payer

- Question: Can an installed desktop app install an older version? How many desktop builds can one payer run at once?
- Options: A. The shell installs any other version, and a rollback releases an older build. B. The shell installs only a newer version, and a rollback rebuilds the older code with a higher version. Builds: no cap across projects, or a cap per payer.
- Default: A, and no cap across projects.
- Final choice: B, and at most 2 live desktop builds per payer, in all its projects.
- Status: changed
- Date: 2026-11-05
- Decided by: Zack, 2026-11-05.
- Issues that change: none filed yet.
- Notes: The security audit found both holes. With A, a writer of `latest.json` can push an older signed build. A rebuild costs `DESKTOP_BUILD_CREDITS` (D32). A third live build answers 409 `DESKTOP_BUILD_LIMIT_REACHED`. Contract: `desktop-apps.md` sections 8 and 10.
- Update 2026-11-05: on a shared personal project, `projects.user_id` pays, also for the build of a member.

## D36. macOS desktop builds: ad-hoc signature first

- Question: How does a user get a macOS desktop app?
- Options: one platform per build, or both. Apple silicon, or universal. Minimum macOS 15, 14, or 11. 25 credits, or more.
- Default: one platform per build, Apple silicon only, macOS 15 or later, 25 credits (D32). Ad-hoc signature `-`, no notarization.
- Final choice: the default, on GitHub Free, Pro, or Team: at most 5 macOS jobs at once.
- Status: confirmed
- Date: 2026-11-05
- Decided by: Zack, 2026-11-05.
- Issues that change: none filed yet.
- Notes: The user opens the app one time with Open Anyway. The server checks, re-packs, and signs the update archive. `DESKTOP_MACOS_BUILDS_ENABLED` gates new builds. A fixed `icon.icns` keeps the product name out of the app. The job stops after 45 minutes. The warm-up runs each day. Later: notarization with rcodesign, after a choice of whose Developer ID signs.

## D37. Electron as a second, experimental desktop engine

- Question: Does Wandit also build desktop apps with Electron?
- Options: Tauri only (D30). Electron only. Both, with the engine fixed at the create of a project.
- Default: Tauri only (D30).
- Final choice: both. The app type "Desktop app 2" creates a project with the Electron shell. "Desktop app" keeps Tauri. Electron is experimental.
- Status: confirmed
- Date: 2026-11-12
- Decided by: Zack, 2026-11-12.
- Issues that change: none filed yet.
- Notes: Why: a Tauri app uses the WebView of the system (WebView2, WKWebView), and each one acts differently. A macOS app showed a white window. Electron ships one Chromium for both systems. Cost: size. A macOS disk image is about 119 MB (measured on a fixture app). Only the shell, the CI workflows, and the update signature change. `projects.desktop_engine` holds the engine and never changes. Contract: `docs/v2/desktop-apps.md` section 13. Open: which engine stays after the test.

## How to add an entry

1. Take the next number. The next number is D38.
2. Add a row to the index table.
3. Add a section `## D<n>. <title>` with the 9 fields, in the same order, one per line. Keep the entry under 150 words.
4. Write the status as one line that starts with `Status:` and one of these words: default, confirmed, changed, open.
5. Keep the ESTIMATE and UNVERIFIED marks from the source.
6. When the founder decides, fill "Final choice", "Date", and "Decided by". Change the status. Do not delete the default.

Known future entries:

- The LLM proxy, the wandit server between the sandbox and Anthropic. See WANDIT-150 (P0-03).
- The Supabase for Platforms terms. See WANDIT-153 (P0-06).
