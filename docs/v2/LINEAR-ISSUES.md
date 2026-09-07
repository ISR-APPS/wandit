# Wandit V2 Linear issues

Project: https://linear.app/scalemindapps/project/wandit-v2-app-builder-87ef3ccaf3bf (team ISR-WANDIT). Overview issue: WANDIT-147. Created 2026-09-06 from `V2-ARCHITECTURE-REPORT.md` sections 11 and 13.

Each issue is written for one Claude Code session: Why, Outcome, Scope, Out of scope, How, Acceptance criteria, Verification, Dependencies, References. Effort is an ESTIMATE in days for 1 senior engineer who knows the repo.


## P0 · Spikes and vendor answers

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-148 | Bump the AI SDK to the latest v7 and add the harness packages | 2 | 2 | none |
| WANDIT-149 | Spike: run HarnessAgent with Claude Code on Vercel Sandbox from a Railway-like process | 1 | 5 | WANDIT-148, WANDIT-156 |
| WANDIT-150 | Spike: the LLM proxy path for Claude Code with short tokens and cache pass-through | 1 | 4 | WANDIT-148 |
| WANDIT-151 | Spike: cost and quality of 20 real prompts through the harness | 2 | 3 | WANDIT-149, WANDIT-150 |
| WANDIT-152 | Spike: code.storage as the internal git remote against R2 bundles | 2 | 3 | none |
| WANDIT-153 | Vendor: send the Supabase for Platforms request and get the answers | 2 | 1 | none |
| WANDIT-154 | Vendor: get a written license answer from Anthropic for a hosted Claude Code harness | 1 | 1 | none |
| WANDIT-155 | Buy the preview domain and submit the Public Suffix List entries | 1 | 1 | none |
| WANDIT-156 | Vendor: open the accounts, plans, quotas, and tokens V2 needs | 2 | 1 | none |
| WANDIT-157 | Move Redis to the API region | 2 | 2 | none |
| WANDIT-158 | Add CI for type checks and tests | 2 | 2 | none |
| WANDIT-159 | Add a CI deploy for the edge Worker | 2 | 1 | WANDIT-158 |
| WANDIT-160 | Check and document the staging site: preview.wandit.dev with api-staging.wandit.dev | 2 | 0.5 | none |
| WANDIT-161 | Record the 12 founder decisions in a decision log | 2 | 1 | none |

## P1 · Web builder alpha (internal users)

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-162 | Scaffold the app-builder module, the V2 switch, the v2 contracts, and the env values | 1 | 3 | WANDIT-156 |
| WANDIT-163 | Add the V2 core tables and columns as additive migrations | 1 | 3 | none |
| WANDIT-164 | Build the SandboxProvider interface and the Vercel Sandbox implementation with lifecycle | 1 | 6 | WANDIT-149, WANDIT-163 |
| WANDIT-165 | Build the LLM proxy with short run tokens, key injection, and spend limits | 2 | 5 | WANDIT-150, WANDIT-162 |
| WANDIT-166 | Build the builder-turn Trigger.dev task with one harness session per project | 1 | 8 | WANDIT-148, WANDIT-149, WANDIT-162, WANDIT-163, WANDIT-164, WANDIT-165 |
| WANDIT-167 | Build the turn API: create, stream, cancel, the lock, and the message queue | 1 | 6 | WANDIT-162, WANDIT-163, WANDIT-157 |
| WANDIT-168 | Build the web app template with CLAUDE.md, skills, and deny rules | 1 | 6 | none |
| WANDIT-169 | Add the host tools: ask_user, generate_image, approvals, and MCP connectors | 2 | 4 | WANDIT-166 |
| WANDIT-170 | Build the preview proxy Worker with signed tokens on the preview domain | 2 | 5 | WANDIT-155, WANDIT-149, WANDIT-156 |
| WANDIT-171 | Build version history: a commit per turn, durable storage, and copy-forward restore | 2 | 6 | WANDIT-152, WANDIT-166 |
| WANDIT-172 | Build the BuilderTransport with resume and the harness message parts | 1 | 5 | WANDIT-148, WANDIT-162, WANDIT-167 |
| WANDIT-173 | Build the builder shell: engine switch, preview iframe, file tree, and versions panel | 2 | 6 | WANDIT-170, WANDIT-171, WANDIT-172 |
| WANDIT-174 | Add the agent_session money operation, checkpoint debits, project caps, estimate, and receipt | 1 | 5 | WANDIT-151, WANDIT-163, WANDIT-165, WANDIT-166, WANDIT-167 |
| WANDIT-175 | Add V2 project creation and the per-user rollout flags | 2 | 3 | WANDIT-162, WANDIT-163, WANDIT-164, WANDIT-168 |
| WANDIT-176 | Run the P1 staging alpha: end-to-end, observability, and the internal test script | 2 | 4 | WANDIT-158, WANDIT-160, WANDIT-166, WANDIT-167, WANDIT-172, WANDIT-173, WANDIT-174, WANDIT-175 |

## P2 · Publish, security basics, first external users

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-177 | Extend the edge Worker to serve multi-file apps with a manifest, a flip object, and SPA fallback | 1 | 5 | WANDIT-159 |
| WANDIT-178 | Build the publish-app task: build in the sandbox, upload, flip, rollback, and unpublish | 1 | 6 | WANDIT-177, WANDIT-164, WANDIT-166, WANDIT-173, WANDIT-179 |
| WANDIT-179 | Build the @wandit/leads SDK and wire it into the template | 3 | 3 | WANDIT-168 |
| WANDIT-180 | Harden the sandbox: network policy, deny rules, and the PreToolUse hook | 2 | 4 | WANDIT-164, WANDIT-168 |
| WANDIT-181 | Add abuse controls: rate limits, audit events, secret scanner, phishing rules, and the suspend switch | 2 | 5 | WANDIT-163, WANDIT-177, WANDIT-178 |
| WANDIT-182 | Open V2 to the first external users: rollout checklist, privacy text, and support runbook | 2 | 3 | WANDIT-154, WANDIT-176, WANDIT-177, WANDIT-178, WANDIT-180, WANDIT-181 |

## P3 · Cloud tab with Supabase

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-183 | Build Supabase provisioning: the Management API client, the provision-backend task, and app_backends | 1 | 6 | WANDIT-153, WANDIT-163, WANDIT-166, WANDIT-185 |
| WANDIT-184 | Add the backend lifecycle: pause and restore sweeps, entitlements, and billing operations | 2 | 4 | WANDIT-183, WANDIT-174 |
| WANDIT-185 | Add project_secrets with encrypted storage and the write-only Secrets panel | 2 | 3 | WANDIT-163 |
| WANDIT-186 | Add the agent backend tools: ensure_backend, apply_migration, run_sql, deploy_function, set_secret, get_advisors | 1 | 6 | WANDIT-183, WANDIT-169, WANDIT-185 |
| WANDIT-187 | Add the Cloud tab server endpoints | 2 | 5 | WANDIT-183 |
| WANDIT-188 | Build the Cloud tab UI panels | 2 | 6 | WANDIT-187, WANDIT-185, WANDIT-173 |
| WANDIT-189 | Add the app connectors: Resend tenant domains and the Stripe restricted key | 2 | 5 | WANDIT-185, WANDIT-186, WANDIT-180 |
| WANDIT-190 | Add the backend publish gate: advisors, the anonymous RLS probe, and login redirect registration | 1 | 3 | WANDIT-183, WANDIT-186, WANDIT-178 |

## P4 · Mobile phase 1

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-191 | Build the Expo app template pinned to the store Expo Go SDK | 3 | 5 | WANDIT-168 |
| WANDIT-192 | Add the project type at creation and the mobile composer mode | 3 | 3 | WANDIT-175, WANDIT-191 |
| WANDIT-193 | Run Metro through the preview proxy, the phone-frame web preview, and the QR panel | 3 | 5 | WANDIT-192, WANDIT-170 |
| WANDIT-194 | Add mobile_builds and the mobile-build task with EAS | 3 | 5 | WANDIT-192, WANDIT-156 |

## P5 · Mobile phase 1.5

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-195 | Build the wandit preview app with expo-dev-client | 3 | 6 | WANDIT-193, WANDIT-194 |
| WANDIT-196 | Add the Appetize device preview on demand with minute limits | 4 | 4 | WANDIT-195, WANDIT-174 |

## P6 · Power features

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-197 | Design and build a branch per chat with forked sandbox previews and AI merge | 4 | 10 | WANDIT-171, WANDIT-173 |
| WANDIT-198 | Add GitHub export, then two-way sync | 4 | 8 | WANDIT-171 |
| WANDIT-199 | Add the exit paths: Supabase claim export and Vercel claim export | 4 | 5 | WANDIT-183, WANDIT-198 |
| WANDIT-200 | Add Workers for Platforms for server-side apps | 4 | 10 | WANDIT-178 |
| WANDIT-201 | Add Stripe Connect for user payments | 4 | 6 | WANDIT-189 |
| WANDIT-202 | Build 'Upgrade to app' for V1 page projects | 4 | 5 | WANDIT-178 |
| WANDIT-203 | Add click-to-target editing through a Vite source plugin | 4 | 6 | WANDIT-173 |
| WANDIT-204 | Add history pagination and native client parity for V2 | 4 | 6 | WANDIT-172, WANDIT-173 |
| WANDIT-205 | Research: install the user app with its own icon on the phone, like Rork | 4 | 3 | WANDIT-194 |
| WANDIT-206 | Run the early access rollout of V2 in production | 3 | 3 | WANDIT-182, WANDIT-188, WANDIT-190 |

## P7 · Device streaming

| Issue | Title | Prio | Days | Blocked by |
|---|---|---|---|---|
| WANDIT-207 | Run own Android emulators on KVM with WebRTC streaming | 4 | 15 | WANDIT-196 |
| WANDIT-208 | Run a Mac mini pool with serve-sim behind a login proxy, after legal review | 4 | 15 | WANDIT-196 |

## Open points from the cross-issue review

Decide these before the named issue starts. They are also in WANDIT-147.

1. LLM proxy token life: WANDIT-165 (P1-04) sets the token `exp` at 45 minutes. WANDIT-166 (P1-05) sets the turn `maxDuration` at 3600 seconds, and WANDIT-174 (P1-13) sets the stale window at 90 minutes. A turn longer than 45 minutes loses its proxy token. Decide: set `exp` to 65 minutes, or make the task mint a new token at 40 minutes. Extend WANDIT-165 (P1-04).

2. Sandbox idle signal from the preview proxy: WANDIT-170 (P1-09) writes `preview:last-seen:{projectId}` to the Worker KV binding `PREVIEW_KV`. WANDIT-164 (P1-03) reads `sandbox_sessions.lastActiveAt` through `touchActivity` for the idle sweep. No issue says how the sweep reads the KV key. Decide: the sweep reads KV through the Cloudflare REST API (extend WANDIT-164 (P1-03)), or the Worker posts a heartbeat to an API route (extend WANDIT-170 (P1-09)).

3. Supabase auth redirect list and per-run preview origins: WANDIT-170 (P1-09) makes one origin per run (`r-<rid12>--p-<projectId>`). WANDIT-183 (P3-01) and WANDIT-190 (P3-08) register one fixed preview host in `site_url` and `uri_allow_list`. After each new sandbox run, login on the preview breaks. Decide: a wildcard entry `https://*--p-<projectId>.<PREVIEW_DOMAIN>/**` in `uri_allow_list`, or a `BackendAuthUrlsService` call at each new `sandbox_sessions` row. Extend WANDIT-190 (P3-08).

4. Phone token in a DNS label: WANDIT-193 (P4-03) puts the WANDIT-170 (P1-09) token (a base64url JSON payload plus an HMAC) in the host label `m-<token>--p-<projectId>`. A DNS label holds at most 63 characters, so the WANDIT-170 (P1-09) token does not fit. Decide a short token form for phones (for example a 16-byte random id stored in `PREVIEW_KV`, or a 20-byte truncated HMAC over `pid|rid|exp`). Extend WANDIT-193 (P4-03).

5. V2 project limit per plan: report 9 step 2 checks 'the project limit'. WANDIT-175 (P1-14) says WANDIT-167 (P1-06) and WANDIT-174 (P1-13) add plan limits, WANDIT-167 (P1-06) says 'check the plan and project limits', and WANDIT-174 (P1-13) defines only credit caps. No issue sets the number of V2 projects per plan. Decide the count for Starter, Pro, and Business, and the owner issue (suggest WANDIT-175 (P1-14) for the create check and the constant).

6. Assistant message persistence: report 9 step 9 stores the harness parts, the usage, and the commit sha on the message row. The WANDIT-166 (P1-05) text fix adds this line, but confirm the message storage design: one `messages` row per turn with the full UI message parts in `parts` jsonb, in the V1 shape, so the V1 history GET and the WANDIT-172 (P1-11) hydration read it without a new route.

7. Screenshots: report 8.1 lists screenshots in R2 and WANDIT-164 (P1-03) starts the Playwright service in the sandbox, but no P1 issue takes a screenshot per turn or a project card thumbnail for V2 projects. Decide if V2 needs a thumbnail. If yes, extend WANDIT-171 (P1-10) (screenshot at commit, key `sites/{projectId}/thumbnail.png`) or WANDIT-173 (P1-12).

8. Delete of a published V2 project: WANDIT-175 (P1-14) deletes `git/{projectId}/` and the sandbox. After WANDIT-178 (P2-02), a deleted V2 project still has `published/{projectId}/current.json`, its `deployments` row, and its KV slug pointer. Extend WANDIT-178 (P2-02) with an unpublish step in the WANDIT-175 (P1-14) delete task.

9. Founder decisions that block an agent: (a) WANDIT-155 (P0-08) the preview domain name and the staging domain choice (a second domain, or Advanced Certificate Manager); (b) WANDIT-156 (P0-09) one Trigger.dev project or the `wandit-v2-experiment` project, and the Vercel Pro upgrade that changes the preview billing of `wandit-web` and `wandit-admin`; (c) WANDIT-152 (P0-05) the code.storage or R2 bundles choice, before WANDIT-171 (P1-10) starts; (d) WANDIT-194 (P4-04) the Apple developer account model (the user's own account or a wandit-owned account) and the `mobile_build` credit price and entitlement; (e) WANDIT-196 (P5-02) the preview minutes per plan (ESTIMATE Free 0, Pro 60, Business 180); (f) WANDIT-169 (P1-08) `generate_image` spends credits without approval, which differs from report 8.2 item 1 ('tools that spend money need approval').

10. Agent SDK fallback: report 8.2 item 1 names the Claude Agent SDK as the fallback if the WANDIT-154 (P0-07) answer is negative. No issue exists for it. Create one only when WANDIT-154 (P0-07) answers no.

11. Turn status enum: the text fixes extend `builder_turn_status` in WANDIT-163 (P1-02) and WANDIT-162 (P1-01) to 13 values and add `cancelling` to the active-turn unique index. Confirm this list before WANDIT-163 (P1-02) starts, because every later issue writes these values.

