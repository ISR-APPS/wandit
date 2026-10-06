# V2 robustness audit before the event

Date: 2026-10-06. Branch: `audit/v2-harness-robustness`, from `origin/dev` at `a65e7d19`.
Scope: the V2 app builder on staging (preview.wandit.dev, api-staging.wandit.dev).
Language: ASD-STE100 Simplified Technical English. Code names stay as they are.

This report answers one question: what can stop a user during the live event, and what makes the
system recover by itself? Read section 1 first. It lists the actions that only you can do.

Status labels:

- **Fixed in branch**: the change is in this branch, not committed, and the checks pass.
- **Already on dev**: another commit fixed it. Merge `dev` into `staging` before the event.
- **Ops**: a setting in a dashboard. No code.
- **Open**: not fixed yet. The fix is described.

---

## 1. Do these before the event

The order matters. Do the first block before you invite people.

### 1.1 Without these, the event cannot work

1. **Give credits to new accounts (P0-01).** Staging gives a new user 0 credits today, and all
   purchases are off. A live read of `/api/v1/settings/public` on 2026-10-06 returned
   `signupGrantEnabled=false`. In the admin app, open Product controls:
   1. Set "Signup grant credits" first (whole credits). A first Opus build costs about 150 to 600
      credits. 1,500 to 2,000 credits give 2 or 3 builds. Pick the amount from the money that
      you accept to spend per attendee.
   2. Then turn on "Signup grant". The order matters: the ledger key `signup:<userId>` makes a
      second grant a no-op, so a user who signs up while the amount is 20 keeps 20.
   3. Run "Signup grant backfill" for the accounts made while the grant was off.
   4. Give more credits to testers who already got 20, with Users > Grant credits.
2. **Check the AI Gateway balance (P0-06).** An empty balance fails every turn for every user.
   In the Vercel AI Gateway dashboard, compare the balance with the expected spend (about $1,000
   for 50 users). Turn on auto top-up. Check the team and key budgets.
3. **Set the PostHog flag to 100 % (P0-07).** In PostHog, set `v2-builder` to 100 % with no
   person conditions. An attendee with an ad blocker (Brave, uBlock) does not load the flag and
   gets the V1 builder. This branch adds a first-party proxy path `/lumen`. In Vercel, set
   `VITE_POSTHOG_HOST=https://preview.wandit.dev/lumen` for the branch `staging`, and build the
   staging web again.
4. **Check `PREVIEW_DOMAIN` in Trigger.dev staging (P0-08).** It must be `wanditpreview.app`.
   With this branch, backend creation always turns off email confirmation. The auth URLs and
   the mobile Trigger fallback still need the value. Backends that went active before the
   deploy keep "Confirm email" on: turn it off in the Supabase dashboard.
5. **Decide about Publish (P0-11).** Publish has never completed on staging. The link goes to the
   production zone and shows "This site isn't available", or a production site with the same
   slug. If Publish is not fixed, do not click it on stage. Tell testers not to use Publish,
   Connect domain, or Buy domain.

### 1.2 Merge and deploy, then freeze

6. **Merge this branch and `dev` into `staging`.** `dev` holds two fixes that staging does not
   have yet: the kill script of the stale bridge (#484, the `EADDRINUSE` error after "Build this
   plan") and the lifted daily LLM cap (#482). In Railway, check that `server` and
   `harness-host` run the new commit with status SUCCESS.
7. **Do the steps of the runbook section "After the robustness deploy".** They include:
   run `template-snapshot` once, stop the sandboxes of the demo projects (so that they get the
   dev restart loop), and delete the old stream slot keys.
   **Run `template-snapshot` once** in the Trigger dashboard (staging) after the last deploy.
   Wait for `built` or `exists` on both platforms. Before that, every new project boots slowly
   from the image (P2-19).
8. **Deploy the preview-proxy Worker by hand (P0-04).** CI does not deploy it. From the merged
   commit: `cd apps/preview-proxy && npx wrangler deploy --env ""`. Then open a project on a
   real iPhone and in Chrome Incognito.
9. **Freeze deploys (P0-05).** Turn off auto-deploy on Railway `server` and `harness-host`
   (staging) and on the Vercel web project. Or agree not to push to `staging` until the event
   ends. A change in `/apps/server`, `/packages`, `/templates`, `/apps/admin`, or the root
   package files redeploys the harness host. The code fix in this branch lets a deploy keep the
   live builds (see P0-05). It needs `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` on `harness-host`.
   The freeze is still the safest plan for the event.

### 1.3 Capacity and settings

10. **Redis volume (P1-02).** The Redis volume holds 500 MB and is 64 % full. One failed snapshot
    makes Redis refuse every write: locks, the LLM proxy, and the chat streams stop. Run
    `railway ssh` on Redis, then `df -h /data; du -sh /data/*`, and delete old `temp-*.rdb`
    files. Run `CONFIG SET stop-writes-on-bgsave-error no` and add
    `--stop-writes-on-bgsave-error no` to the start command. Resize the volume to 5 GB.
11. **Harness host settings (P1-19, P1-22, P0-05).** On `harness-host`: set the restart policy to
    Always; set `HARNESS_HOST_URL=http://127.0.0.1:<HARNESS_HOST_PORT>` so that follow-up turns
    stay on the host; set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (for example `1800`) so that a
    deploy waits for live builds.
12. **Backend burst (P1-14).** In the Trigger dashboard (staging), set a concurrency override of
    10 on the `provision-backend` queue. With 3 slots, 30 new projects wait 4 to 5 minutes for
    their database, and first builds ship without tables. Turn on `v2-cloud-tab` in PostHog,
    so a failed backend has a visible "Try again" (P1-15).
13. **Appetize (P1-12).** Appetize gives 3 shared devices. Check the plan. From `apps/server`, run
    `pnpm appetize:upload-expo-go -- --referrers wandit.dev,preview.wandit.dev --max-concurrent
    <plan limit>`. Open the device once on preview.wandit.dev. Use Expo Go on a real phone as
    the stage plan A.
14. **Model (P2-10).** Read `V2_DEFAULT_MODEL` on Railway staging. If it is
    `anthropic/claude-opus-5.5-fast`, think about `anthropic/claude-opus-5.5` for the event. The
    gateway can then fail over between providers, and each build costs about half.
15. **Load check (P0-10).** Start 10 short turns at the same time on staging, one time only (it
    costs credits). Read the memory and CPU of `harness-host` in Railway.

### 1.4 Last steps

16. After the last rehearsal and the last deploy, clear the rate counters:
    `redis-cli --scan --pattern 'builder:rate:*' | xargs redis-cli DEL`.
17. Rehearse on the stage devices: one Plan to Build flow, one mobile project with the Expo Go QR,
    one backend app with sign-up. Do it in Safari and in Chrome.
18. On the event morning, run `curl -s https://exp.host/--/api/v2/versions | jq
    .data.expoGoSdkVersion`. If it is not `57.0.0`, tell attendees to use the web phone frame or
    the device button (P2-27).

---

## 2. During the event

Keep one terminal with `railway connect Redis` (environment staging) and one with `psql` on the
staging `DATABASE_URL`. The full commands are in `docs/v2/runbook.md`, section "Unstick a user
during an event".

- Every 15 minutes, run:
  `SELECT status, runner, count(*) FROM builder_turns WHERE created_at > now() - interval '1 hour' GROUP BY 1, 2;`
  Rows that stay in `running` for a long time, or many `failed` rows, show a problem first.
- Watch the memory and CPU of `harness-host` in Railway, and the new issues in Sentry.
- **Every turn fails at the same time:** check the AI Gateway balance first. Then Redis
  `INFO persistence` (`rdb_last_bgsave_status`). Then the `harness-host` deploy status.
- **The room gets "Too many requests. Please wait a moment and try again.":** delete the IP counters (runbook).
- **A preview is blank in Safari or Incognito** and the Worker fix is not live: the panel now
  offers "Open in a new tab". Or use Chrome in normal mode.
- **The Appetize queue blocks the stage device:** use Expo Go on a real phone.
- **A hotfix cannot wait:** push only when this query returns 0:
  `SELECT count(*) FROM builder_turns WHERE runner = 'host' AND status IN ('queued', 'running', 'cancelling');`

---

## 3. P0 issues: likely during the demo, and they stop the user

| ID | Problem | What the user sees | Fix | Status |
|---|---|---|---|---|
| P0-01 | New accounts get 0 credits and cannot buy any. | "You're out of credits." No button. | Signup grant, section 1.1. | Ops |
| P0-02 | The IP caps assume 3 people behind one office IP: 30 new projects per IP per day, 90 turn posts per IP per 10 min. Every send, Approve, Deny, and answer is a turn post. | After about 30 projects from the venue, "New project" fails for the rest of the day. With about 18 active users, every send fails for up to 10 min. | Staging values: 500 creates per IP per day, 50 per user, 2,000 turn posts per IP per 10 min. Marked `STAGING ONLY`. | Fixed in branch (project, turn, and publish IP caps) |
| P0-03 | "Build this plan" fails with `EADDRINUSE 0.0.0.0:4000` on every retry. The kill script of the old bridge matches its own command line and kills itself first. | "Something went wrong on our side." Retry fails the same way. | `[b]ridge\.mjs` pattern (#484). A Linux test in this branch proves it on CI. | Already on dev |
| P0-04 | Safari, every iPhone browser, and Chrome Incognito never show the preview. The preview cookie is a third-party cookie without `Partitioned`. | "Something went wrong." Retry fails. No "Open in new tab". The Expo Go QR disappears. | `Partitioned` cookie (CHIPS). For a browser that still blocks it, the panel says so and offers "Open in a new tab". The QR stays. | Fixed in branch. Needs the manual Worker deploy. |
| P0-05 | Every push to staging ends every running build. The new host fails the turns of the old host at boot, and the old host exits at once on SIGTERM. | "The build server restarted. Send your message again." A 10 to 30 minute build is lost. | Freeze deploys. Code: each host turn keeps a run mark in Redis (90 s TTL, refreshed every 30 s). The recovery skips a turn with a fresh mark. On SIGTERM, the host takes no new turns and waits for the live turns until 5 s before Railway's SIGKILL. | Fixed in branch. Needs `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`. |
| P0-06 | An empty AI Gateway balance or a budget refusal fails every turn. Claude Code does not retry a 402. | Every turn fails. Zack learns it from the users. | Ops: balance and auto top-up. Code: a 402 now opens a Sentry issue, and every upstream refusal is logged with its status. | Fixed in branch, plus Ops |
| P0-07 | Ad blockers hide the PostHog flag, so attendees get the V1 builder. | A V1 page project, or 403 `V2_BUILDER_DISABLED`. | Flag at 100 %. A PostHog proxy path in `apps/web/vercel.json` with a neutral name, and `VITE_POSTHOG_HOST`. | Ops (flag at 100 %), plus Fixed in branch (`/lumen` proxy path; needs `VITE_POSTHOG_HOST` on Vercel) |
| P0-08 | Without `PREVIEW_DOMAIN` in Trigger.dev staging, generated apps keep email confirmation on. | Sign-up in a generated app never completes. | Set the value. Code later: always send `mailer_autoconfirm`. | Fixed in branch (email confirmation is always off), plus Ops (the auth URLs and the mobile Trigger fallback still need the value) |
| P0-09 | Better Auth allows 3 sign-in requests per 10 s per IP. | Most of the room gets "Too many requests" on "Continue with Google". | A custom rule: 100 per 10 s for `/sign-in/social`. Email sign-in keeps the default. | Fixed in branch |
| P0-10 | One harness host runs every build with no cap and no heap flag. One crash ends every live build. | "The build server restarted" for everyone at the same time. | A cap of live turns on the host (the API then uses Trigger), `--max-old-space-size`, no trace sampling on the host. | Fixed in branch (cap of 20 live turns, heap flag, no traces). Run the load check. |
| P0-11 | Publish on staging fails at the build (`pnpm install` exit 137), and the link points to the production zone. | A green "Live" chip, then "This site isn't available", or a stranger's site. | Decide: keep Publish out of the demo, or fix the build and add a staging route (`*.stg.wandit.app`). | Open (decision) |

---

## 4. P1 issues: real and serious, less likely on stage

| ID | Problem | Fix | Status |
|---|---|---|---|
| P1-01 | A dev server (Vite or Metro) that dies never restarts. The preview stays "asleep" forever. Wake does not help. | Run the dev command in a restart loop (`while true; do ...; sleep 5; done`). | Fixed in branch |
| P1-02 | A full 500 MB Redis volume stops every Redis write. | Ops (section 1.3). Code: turn streams live 1 hour, not 24 hours. | Ops, plus Fixed in branch (turn streams live 1 hour) |
| P1-03 | A first turn that cannot start (3 builds already run, or a 402) leaves a new project with a lone prompt, no error, and no Retry. | The create path now stores an error reply with Retry. | Fixed in branch |
| P1-04 | A failed, stopped, or capped turn loses its error card and Retry after a reload. No reply row is stored. | `failTurn`, `finalizeCanceled`, and the host recovery store the partial reply plus the error part. | Fixed in branch |
| P1-05 | Silent long work (an install, a build) trips the 4-minute stall watchdog. Background tasks shift the replies of the kept CLI by one turn. | `BASH_MAX_TIMEOUT_MS` below the watchdog, background tasks off, subagents off in build mode. | Fixed in branch |
| P1-06 | Version Restore does not reinstall packages, so it cannot undo a removed package (the font bug). | `pnpm install --frozen-lockfile --prefer-offline` after the restore. | Fixed in branch |
| P1-07 | Restore deletes the uncommitted work of a failed turn. | A "Before restore" wip commit first. | Fixed in branch |
| P1-08 | No runbook step and no admin button unsticks a user. | Runbook section "Unstick a user during an event". | Fixed in branch (docs) |
| P1-09 | Every bridge failure shows "Something went wrong on our side" with no cause, and the row keeps no cause. | The HTTP status in the Claude Code error text now reaches the classifier: 529 shows "high demand", 429 a rate limit, 402/401 a config error. The raw cause goes to `failure_provider_message`. | Fixed in branch |
| P1-10 | The agent can leave the app broken, and mobile has no "Try to fix". | A dev-only error bridge in the mobile template and the web banner in the phone frame. A rule in both `CLAUDE.md` files. | Fixed in branch (new mobile projects) |
| P1-11 | The mobile template tells the agent to delete auth and profile before it edits the files that import them (the same class as the font bug). | Reorder the steps. Add the rule "Edit every file that imports a thing before you delete it." | Fixed in branch (new projects) |
| P1-12 | Appetize has 3 shared devices, and `preview.wandit.dev` may not be an allowed embed host. | Ops (section 1.3). | Ops |
| P1-13 | A page reload during a device session blocks the device for 17 minutes. | Keep the session id in `sessionStorage` and end it before a new start. | Fixed in branch |
| P1-14 | A burst of new projects queues backend creation, and the first build ships without tables. | Concurrency 10 on `provision-backend`. | Fixed in branch (concurrency 10); an override is still useful before the deploy |
| P1-15 | A failed backend has no exit outside the flag-gated Cloud tab. | Ops: turn on `v2-cloud-tab`. Code: a new turn starts the provisioning again. | Fixed in branch (a new message starts a failed backend again) |
| P1-16 | Open-stream slots leak on every API deploy and never expire for an active user. | A fixed window for the stream slots, 16 min. | Fixed in branch |
| P1-17 | An API restart during a Wake or a Restore blocks the project for 10 or 30 minutes (409). | A lock of 2 min with a refresh. | Fixed in branch |
| P1-18 | A sandbox start that dies halfway leaves the preview at 409 while the user keeps building. | The next start finishes the unfinished boot. | Fixed in branch |
| P1-19 | A dead Trigger-run turn never reaches a terminal row. | Ops: restart policy Always. Code: the host sweep also checks Trigger rows. | Ops, code open |
| P1-20 | Approve after the sandbox slept: the SQL runs, but the agent never gets the result and asks again. | A fallback prompt that says the call did not run. | Open |
| P1-21 | The second message of a new backend app fails once with 401. A raw network policy push deletes the run-token rule of the kept session. | The handle reports `networkPolicyReplaced`, and the turn resumes from the stored state. | Fixed in branch (also after a restore between the turns) |
| P1-22 | `harness-host` has no `HARNESS_HOST_URL`, so follow-up turns go to Trigger. | Ops (section 1.3). | Ops |
| P1-23 | A reload during a long build freezes the page: every replayed chunk renders the page once. | `throttle: 50` in `useChat`. | Fixed in branch |
| P1-24 | A client stream failure (Wi-Fi off for more than 45 s, a deploy) ends with a generic sentence and no Reconnect, while the build runs out of view. | A Reconnect button, a reconnect on the `online` event, and a draft that stays after a refused send. | Fixed in branch |

---

## 5. P2 issues: rare, small, or later

| ID | Problem | Status |
|---|---|---|
| P2-01 | The daily LLM cap is lifted on staging (#482). Production still shows a generic error at the cap. The branch adds a typed stop with the sentence "You reached today's AI limit. It resets at 00:00 UTC." and no Retry. | Fixed in branch |
| P2-02 | A paused turn whose `done` event is lost keeps the spinner on. | Fixed in branch |
| P2-03 | A refused send clears the draft and the files. | Fixed in branch |
| P2-04 | A failed commit on a first turn hides the built app. | Fixed in branch |
| P2-05 | A 429 on a preview re-mint replaces the Wake screen with an error. | Fixed in branch |
| P2-06 | A missing chunk after a web deploy crashes the builder page. The deploy freeze removes the cause for the event. | Open |
| P2-07 | A throw after `complete` shows a succeeded build as failed. | Fixed in branch |
| P2-08 | A kept session that died between turns fails the next turn once. | Open |
| P2-09 | A chat whose Claude session cannot resume fails every turn. | Fixed in branch |
| P2-10 | No fallback model. Under load, the Fast model cannot fail over. | Ops (section 1.3) |
| P2-11 | A failed answer turn closes the card, and Retry loses the answers. | Open |
| P2-12 | Approval edge cases: a typed message over an open approval, a host restart, a second tab. | Open |
| P2-13 | The relay can lock onto the empty host stream for a Trigger-run turn. | Fixed in branch |
| P2-14 | Three small SSE relay leaks under load. | Partly fixed (a paged stream read) |
| P2-15 | A message sent while a Wake boots gets 409 and is dropped. | Fixed in branch (the draft stays, with a clear sentence) |
| P2-16 | Trigger fallback edge cases: a long queue wait and a reused run. | Open |
| P2-17 | A host turn has no hard time limit. | Open |
| P2-18 | Sandbox edge cases: a raw 410 page, a phone-only viewer, a slow start, an old template. | Open |
| P2-19 | New projects boot slowly after a deploy until `template-snapshot` runs. | Ops (section 1.2) |
| P2-20 | Publish and git edge cases: no cause shown, stuck rows, no push timeout. | Open |
| P2-21 | A failed write of the provision run id marks a queued backend as `error`. | Fixed in branch |
| P2-22 | Web "Try to fix" does not show after a fresh load with a root compile error. | Open |
| P2-23 | Chat client edge cases: an orphan chunk, a failed Stop POST, Safari 16. | Partly fixed (Safari 16) |
| P2-24 | Template guard gaps: Deno code in the web `tsconfig`, an unprotected preview bridge, `git stash`. | Partly fixed (Deno exclude, git stash/clean/restore denied) |
| P2-25 | Deleting a project does not stop its queue or its host turn. | Partly fixed (a queued turn of a deleted project ends early) |
| P2-26 | Load checks that need data first: the fence query and the proxy request limit. | Data first |
| P2-27 | The store Expo Go can move to SDK 58. | Check on the event morning |

---

## 5b. Known gaps after the fixes

These gaps stay open. Each one is rare, and a page reload or a short wait gets the user out.

- A send whose POST answer is lost (the network drops after the API created the turn), then
  Reconnect, then a failed turn: the user bubble and Retry are missing until a reload. The same
  flow with Stop misses the "Stopped" line until a reload. Cause: the history reseed of
  `use-builder-chat.ts` runs only when the chat status is `ready`.
- After an API cancel, a waiting turn can start before the runtime stores the "Stopped" reply.
  The fence then drops the reply (a `LIMIT` in `finalizeCanceled`).
- A Version Restore to an old version brings back the old deny list of `.claude/settings.json`
  until the next create, resume, or finished boot (a limit in `docs/v2/security.md`).
- A resume of a `running` row that dies after the vendor call stays `running`. The preview then
  stays down until the vendor timeout (a `LIMIT` in `vercel-sandbox.provider.ts`).
- P1-19 (a dead Trigger-run turn), P1-20 (Approve after the sandbox slept), and the open P2 items
  stay as described in sections 4 and 5.

## 6. What already works well

- Host crash recovery ends dead host turns in about 2 minutes with a retryable card. It refunds the
  hold, revokes the token, frees the lock, and promotes the queue.
- The chat reopens a cut stream for about 45 s. The 15-minute Railway cut and an API restart
  recover by themselves.
- The approval bug (old ids after Approve) cannot come back: old-id chunks are dropped on both
  runners.
- One active turn per project: a partial unique index, a compare-and-set on every status write,
  and a compare-and-delete lock release.
- Stop works without the host. A dead row ends after at most 30 s, the lock is released, the
  hold is refunded, and the next turn starts.
- A paused turn (question, approval, plan) settles its hold and frees the lock.
- At zero credits, a turn stops cleanly with a wip commit and a real settle.
- The LLM proxy passes upstream 429, 529, and 5xx answers with their retry headers, so Claude
  Code retries about 10 times.
- A Redis error lets the rate-limit guard and the Better Auth store pass the request.
- The relay sends a heartbeat every 15 s, and it ends the stream from the row when a `done` event
  is lost.
- A killed turn loses no files: the sandbox is persistent, and cancel and cap stops commit.
- Commits are idempotent, and a crash between the push and the head write heals itself.
- Backend provisioning is idempotent and never fails a project create or a first turn.
- Backend tools never throw to the agent. They answer typed failures.
- The idle sweep never stops a sandbox while a turn or a restore holds the project lock.
- The in-browser device runs a pinned Expo Go 57 build.

---

## 7. Open questions

- Does the venue Wi-Fi put all attendees behind one public IP? This decides how fast P0-02 and
  P0-09 occur.
- What is the AI Gateway balance now, and is auto top-up on?
- Is the PostHog flag `v2-builder` at 100 %? Do attendees get `v2-device-preview` and
  `v2-cloud-tab`?
- Is `PREVIEW_DOMAIN` set in the Trigger.dev staging environment?
- Is Publish part of the demo?
- How much memory does one live host turn use, and what is the `harness-host` memory limit? Only
  a load check can answer this.
- Can the Supabase organization hold 50 or more new projects during the event?
- How many credits per attendee do you accept to spend?
- Is the Vercel team on Pro (many concurrent sandboxes) or Hobby (10)?
- Will you demo in Safari or Incognito on stage?

---

## 8. Findings that the verifiers refuted

- The LLM proxy cut at an API deploy does not fail the turn: Claude Code 2.1.281 sends the call
  again.
- The 4 MiB proxy body limit does not lock a chat: the CLI makes images smaller and removes them
  after a 413.
- The fence query per part and the 10-connection pool keep up at event scale (kept as a data
  check, P2-26).
- The preview Worker runs current code. A CI deploy from `main` fails on a placeholder KV id, so
  it cannot overwrite the Worker.
- The staging pause sweep ran on 2026-10-06 at 03:00 UTC and paused 0 backends.
- A stale `.git/index.lock` has no realistic cause: no git write has a kill timeout.

---

## 9. The failure classes behind these bugs

The three bugs you met (the 15-minute stream cut, the Approve ids, the removed font package) are
not separate accidents. They belong to classes. Most findings of this audit belong to the same
classes. Use these rules when you build the next feature.

1. **Seams between turns.** A turn ends, and the next turn depends on what the last one left:
   ids, a kept session, a kept CLI process, a lock, a network policy, a reply row. Examples: the
   Approve ids, the 401 on the second message (P1-21), the lost error card (P1-04). Rule: for
   every value that one turn leaves for the next, ask "what if the last turn failed or was
   killed at this line?"
2. **Long connections.** A stream, a WebSocket, or a lock that lives for minutes will be cut by a
   proxy, a deploy, a laptop sleep, or Wi-Fi. Rule: every long connection needs a reconnect, and
   the server must keep enough state to replay it.
3. **Deploys during use.** A deploy is a crash for the old process. Two instances run at the
   same time for a few seconds. Rule: a new instance must never assume that it is the only one
   (P0-05). Freeze deploys during an event.
4. **Shared limits.** A limit per IP counts a whole room as one person (P0-02, P0-09). Vendor
   quotas (AI Gateway balance, Appetize devices, Supabase projects, queue concurrency) are
   shared by all users. Rule: before an event, list every limit and size it for the room.
5. **Configuration drift.** A value that exists on Railway but not on Trigger.dev (P0-08), a
   staging grant that is off (P0-01), a flag that an ad blocker hides (P0-07). Rule: one list of
   required values per environment, and a check that reads them.
6. **Errors that hide the cause.** "Something went wrong on our side" for a 529, a 402, or a
   daily cap (P1-09). The user retries into the same wall, and you cannot see the cause. Rule:
   keep the cause on the row, and show the user a sentence that tells them what to do.
7. **The agent leaves the app broken.** The agent is a user of your system who can stop at any
   line: a cap, an approval card, a crash. Rule: the instructions must keep the app working after
   every step (edit importers before you delete), and the system must check the app after a turn
   and offer "Try to fix" (P1-10, P1-11).

---

## 10. How the audit worked

- 15 auditors read one area each (turn lifecycle, harness and bridge, Agent SDK docs, stream
  relay, web chat, sandbox, LLM proxy, approvals, Supabase, harness host, preview and mobile,
  agent instructions, git and publish, capacity, live evidence). They found 131 findings.
- One or two skeptical verifiers per finding tried to refute it: 212 verifications. A critic then
  found 5 areas with no owner, and 5 more auditors covered them (about 20 more findings).
- The live evidence came from read-only sources: the local `builder_turns` and
  `llm_proxy_requests` tables, the Trigger.dev dev run logs, and the Railway staging logs.
- A synthesizer merged the findings by root cause into 62 items: 11 P0, 24 P1, 27 P2.
- No agent changed a dashboard, a deploy, or a production value. Every code fix is in this branch
  and is not committed.

---

## 11. Proof: the end-to-end checks

Two agents ran the checks on the local stack of this worktree: the dev sign-in, the local
Postgres and Redis, the Trigger dev worker, a local harness host where needed, real Vercel
sandboxes, and real model calls through a tunnel to the local LLM proxy. They used 8 real build
turns in total (about 200 credits). Every temporary change (an `.env` line, a Redis key, a row,
a code line) was restored after the run. The steps are in the agent reports of the session.

What passed (46 checks):

- The daily cap ends as a typed stop with "You reached today's AI limit" and no Retry. The
  stored error reply, the first-turn failure, the canceled reply, and the `host_lost` reply all
  show after a reload.
- A mock upstream with 402, 529, and 429 gives the right card and the real cause on the row.
- A refused send keeps the draft. Reconnect brings back a lost stream. A turn that ended during
  the outage shows its stored reply with no reload.
- The project, turn, and publish IP caps, and the Google sign-in rule.
- The `Partitioned` cookie headers of the local Worker. The blocked preview shows "Open in a
  new tab", and that tab shows the app.
- A second host started during a live host turn does not fail it. SIGTERM drains the live turn.
  A dead run mark ends the turn in 17 s. A full host answers 503, and the turn runs on Trigger.
- A forced raw policy push between two host turns does not break the second turn.
- The dev loop restarts Vite 15 s after a kill. An unfinished boot finishes on Wake. The wake
  and restore locks live 2 min.
- A restore saves dirty files as "Before restore" and runs `pnpm install`.
- A broken import in a mobile app shows the banner under the phone frame. "Try to fix" sends
  the error, and the agent fixes the import.
- The stream slot window does not grow on a reconnect. A paused turn ends its stream.
- A Bash call stops at 3 min 30 s, and the turn does not stall. A session-bound error clears
  the stored session.
- A queued turn of a deleted project fails at once as `project_missing`.

What did not pass or did not run:

- 2 failures, both after a lost POST answer and a Reconnect. They are listed in section 5b.
- Not run: a real iPhone and Safari, a Worker deploy, the Appetize device (the phone-link mint
  of the deployed preview proxy answers 500 to a local API), the backend re-provision with the
  real Supabase API, and a few optional checks that needed more paid turns. Run these on
  staging after the deploy.
