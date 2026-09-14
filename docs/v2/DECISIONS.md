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
| D10 | Default model | changed | 2026-09-12 |
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
- Notes: Zack, 2026-09-09: no decision yet. Mobile apps come for sure, so P1 code keeps the mobile path open. Source: report 6.5.

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

## How to add an entry

1. Take the next number. The next number is D22.
2. Add a row to the index table.
3. Add a section `## D<n>. <title>` with the 9 fields, in the same order, one per line. Keep the entry under 150 words.
4. Write the status as one line that starts with `Status:` and one of these words: default, confirmed, changed, open.
5. Keep the ESTIMATE and UNVERIFIED marks from the source.
6. When the founder decides, fill "Final choice", "Date", and "Decided by". Change the status. Do not delete the default.

Known future entries:

- The LLM proxy, the wandit server between the sandbox and Anthropic. See WANDIT-150 (P0-03).
- The Supabase for Platforms terms. See WANDIT-153 (P0-06).
- The Apple developer account model, and the `mobile_build` credit price. See WANDIT-194 (P4-04).
