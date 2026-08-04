# COD Lead Flow — Bugs Found & What We Fixed

**TLDR: The flow works. A visitor who submits a COD form on a live domain does reach your dashboard. We found 9 bugs that could silently lose or hide leads. 7 are fixed on this branch. 1 waits for the payment branch. 1 is a production config check, not code.**

How we know: ~20 deep Codex (gpt-5.6-sol ultra) inspection and verification passes over the whole path — publish → domain → page → form → API → database → dashboard. Every bug below was confirmed twice, in code, with file evidence.

---

## The flow, in one paragraph

When you publish, the server bakes a small script into the page HTML and stores it. When a visitor on your custom domain submits the form, that script sends the data straight to the platform API (`POST /api/public/leads/...`). The API checks it and writes it to the `leads` table. The dashboard reads that same table every 15 seconds. Trigger.dev is only used to make the *domain* go live — it is never in the path of a submission.

---

## Group A — bugs that could LOSE leads (all fixed ✅)

### A1. The page said "thank you" without checking ✅ FIXED
- **Bug:** The form fired the order at the server and instantly showed success. It never read the reply and never retried. Busy server or a network blip = order gone, buyer thinks they ordered.
- **Fix:** The page now waits for the server to answer "stored" before showing success. If the server is busy, it retries up to 3 times. The order is only marked "sent" after a real confirmation.

### A2. Spam limit blocked real buyers ✅ FIXED
- **Bug:** Max 10 orders per minute per internet address — counted *before* checking the order was even valid. Mobile networks share one address, so buyer #11 was silently dropped.
- **Fix:** Limit is now 60/minute *per form* per address (plus a separate anti-abuse ceiling), and it only counts valid orders. Blocked requests get a "retry in X seconds" answer that the page's retry logic obeys.

### A3. The AI could publish a broken form ✅ FIXED
- **Bug:** The publish check accepted surface signs (a form, a phone field, a magic keyword anywhere). A page could pass while sending orders without a name — and the server rejects orders without a name. Live page, zero leads, forever.
- **Fix:** The check now requires a real name field AND a script that actually fires the capture event. The old broken example page now fails the check, with clear reasons the AI uses to correct itself.

## Group B — bugs that could kill the page link

### B4. Wrong link shown for connected domains ✅ FIXED
- **Bug:** For a bring-your-own domain we only wire up `www.yourdomain.com`, but the app displayed and copied `yourdomain.com`. Ads sent to the bare link hit a dead page.
- **Fix:** One shared helper now returns the working `www` link everywhere for connected domains (success screen, publish popover, copy buttons). Purchased domains keep the short link — theirs works.

### B5. Stuck domain setups after the trigger.dev move ⏳ NOT FIXED YET — ON PURPOSE
- **Bug:** A few domain setup paths (connected domains, credit-paid purchases) have no auto-recovery if a job dies mid-way. The domain can sit broken with no retry.
- **Why we waited:** The fix runs through payment-orders and refund code that the payment branch is rewriting right now. Fixing it here = guaranteed merge conflicts. **Do it after the payment branch lands.**

## Group C — bugs that hid leads you already had (all fixed ✅)

### C6. Order details were invisible ✅ FIXED
- **Bug:** Bundle, size, color, quantity, delivery choice — saved in the database, shown nowhere. You got name + phone and had to call the buyer to ask what they bought.
- **Fix:** Every lead row now has an expandable "Order details" section, and CSV + Google Sheets get an Order details column. Internal fields stay hidden.

### C7. Dashboard silently stopped at 1,000 leads ✅ FIXED
- **Bug:** The list loaded only the newest 1,000; totals, search, and CSV came from that slice. Sheets stopped at 10,000. Counters disagreed with the workspace badge.
- **Fix:** Real server-side pages with true totals. Search and filters run on the server over ALL leads. CSV and Sheets export everything, with no cap.

### C8. Google Sheets could end up wiped ✅ FIXED
- **Bug:** Sync erased the whole sheet first, then rewrote it. If Google failed between the two steps, your sheet stayed empty.
- **Fix:** Sync now writes everything to a hidden staging tab first, then swaps it in with one atomic Google operation. Any failure leaves the old sheet exactly as it was.

---

## The 1 thing code cannot fix — check in production

The platform API address is stamped into every page **at publish time** (from `BETTER_AUTH_URL`).

1. Confirm production `BETTER_AUTH_URL` is the public HTTPS API address.
2. Confirm the edge worker's KV namespace and R2 bucket in `apps/edge/wrangler.jsonc` match what the server writes to.
3. Confirm the Cloudflare manual setup from `docs/features/edge-serving.md` (fallback origin, wildcard DNS, route exclusions) is still in place.

## After merging this branch

1. **Republish existing pages.** Pages published before this fix still run the old fire-and-forget script. Republishing injects the new confirmed-delivery script.
2. Fix B5 once the payment branch lands.

## Proof it works

- Server: 205/205 tests pass (leads + site builder), TypeScript clean.
- Web: 334/334 tests pass (workspace + domains), TypeScript clean.
- Branch: `inspect/cod-lead-flow` in `.claude/worktrees/lead-flow` — all changes uncommitted for review.
