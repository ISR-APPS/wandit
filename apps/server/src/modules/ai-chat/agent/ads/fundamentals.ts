// ads-fundamentals: the platform-independent media-buying base (unit economics,
// structure, CBO/ABO, learning phase, bidding, scaling, delivery, breakdowns).
// Plain prompt prose — no template-literal syntax inside the string.

export const ADS_FUNDAMENTALS_DOC = `# ADS SKILL — FUNDAMENTALS

Use for paid media on Meta or TikTok: reading an account, structuring campaigns, judging budgets, scaling, or deciding to touch nothing.
This skill owns: unit-economics vocabulary, account hierarchy, CBO vs ABO, learning phase, bid strategies, tracking structure, scaling, delivery diagnostics, kill criteria, breakdowns.
Not in this skill (open the sibling skill instead): creative analysis (ads-creative), audience doctrine (ads-audiences), attribution, statistics, finance (ads-measurement), COD economics (ads-cod-maghreb), diagnostic tree, playbooks, policy, tone (ads-diagnostic).

## 1. UNIT ECONOMICS — ONE LINE EACH

CPM: cost per 1,000 impressions. CPC: cost per click = CPM / CTR. CTR: clicks / impressions — always say which: link CTR (outbound) or CTR all. CPA: cost per result; on a Wandit page the result is a Lead. ROAS: platform-attributed revenue / spend. MER: total revenue / total ad spend, all platforms. AOV: average order value. LTV: lifetime revenue per customer. CAC: cost per new customer. Contribution margin per order: price minus product, shipping, payment and return cost — never gross margin. Break-even ROAS: 1 / contribution margin rate; below it you lose money whatever the platform shows. Cost per result vs profitable cost per result: the platform reports the first; know the second.
HARD RULE: in COD the real unit is a DELIVERED order, never a lead. A Lead CPA means nothing until confirmation and delivery rates turn it into cost per delivered order (formula, market rates: ads-cod-maghreb); apply the rates from read_lead_performance to the platform CPA, then judge.
HARD RULE: ad budgets and ad costs are USD — say USD every time. Page prices stay DZD.

## 2. ACCOUNT HIERARCHY

Meta: campaign (objective, CBO budget, bid strategy) -> ad set (audience, placements, ABO budget, optimization event, schedule) -> ad (creative, destination, UTMs). TikTok: campaign -> ad group -> ad; ad set below means ad group too.
Structure follows conversion volume, not ambition. The three-stage funnel (TOF reach or views -> MOF engagement, 50-75% video viewers -> BOF conversion) needs volume; a merchant at a few leads a day runs ONE broad prospecting campaign with 1-3 ad sets plus one retargeting ad set once audiences exist. Video-view-to-conversion: a cheap video-views campaign builds the viewer pool, then a conversion ad set retargets the 75% viewers — worth it only while the page produces too few Leads to seed retargeting. Keep prospecting, retargeting and retention in separate campaigns with cross-exclusions so the warm audience never absorbs the prospecting budget (ads-audiences). Separate a testing campaign (fixed budget, fixed rules) from a scaling campaign (proven winners only). Reuse the same post ID across ad sets to accumulate social proof. Multi-product accounts: one campaign per product while each can clear learning alone; by category when none can; by margin tier when margins differ widely, so budget and CPA target match what each product earns. Split by geography, language or device only when segment economics really differ — otherwise stay broad: on Meta in 2026, broad targeting with a clean conversion signal beats interest stacks almost every time.
Viable ad sets for a budget (rule of thumb from the learning threshold): each ad set needs about 50 results in 7 days, so supportable ad sets = weekly budget in USD / (target CPA x 50). Below that, ad sets never learn; consolidate.

## 3. CBO VS ABO — AND THE 2026 AUTOMATION SHIFT

CBO = Meta Advantage campaign budget / TikTok campaign budget optimization: the algorithm allocates across ad sets. ABO = ad set / ad group budget, fixed by you.
Rule: ABO to learn, CBO to scale.
Testing audiences -> ABO -> CBO starves weak ad sets before they have data.
Testing creatives -> ABO -> guaranteed spend on each variant.
Scaling proven winners -> CBO -> algorithmic reallocation beats a human.
Tight budget -> ABO -> CBO needs volume to allocate well.
Many ad sets -> CBO -> ten manual budgets are unmanageable.
CBO traps: 80% of budget on one ad set is often correct but kills parallel tests; per-ad-set min/max spend fights the algorithm; changing the CBO budget restarts learning for the WHOLE campaign; overlapping audiences inside one CBO bid against each other and raise CPM; a zero-spend ad set was never tested — not a loser.
2026 shift: both platforms push automatic consolidation — Meta Advantage+ Shopping (with Advantage+ Audience, Placements, Creative), TikTok Smart+ — so the debate is now automated vs manual campaign. Hand control over when the pixel/CAPI signal is clean, volume clears learning, creatives are many and diverse, and the goal is scale. Take it back to test an angle, audience or market, when volume is below learning thresholds, or when the automated campaign hides the breakdown you need. Manual stays superior in testing; master both, force neither. Automated rules (Meta and TikTok: pause, raise, lower on a threshold) only with the 72 h / 3x CPA threshold written into the condition — otherwise they automate the over-optimization this skill forbids.
Wandit note: Smart+ and Advantage+ Shopping optimize on the bare Lead here; GMV Max and Video/Product Shopping Ads need a TikTok Shop catalog — say so.

## 4. LEARNING PHASE

Meta: an ad set exits learning after about 50 optimization events in the 7 days after its last significant edit; below that it is Learning Limited — unstable delivery, higher cost. TikTok follows the same 50-in-7 logic. Learning Limited is a budget-or-signal problem, not a creative verdict: consolidate, raise budget or pick a higher-volume event.
Significant edits that reset learning (Meta list): any change to targeting, placements, optimization event, bid strategy or bid/cost control amount, creative (editing or adding an ad), a significant budget change, a pause of 7 days or more. In CBO a budget change resets every ad set. TikTok's list is equivalent.
HARD RULE: never touch an ad set in learning — every edit restarts the clock and burns the data you paid for. Bundle edits: make all needed changes at once, then wait.
HARD RULE (PDF; enforced in code): no modification to an ad set before 72 hours or 3x target CPA of cumulative spend, whatever the analysis suggests. Wandit refuses a write to a campaign/ad set/ad it created or changed less than 72 h ago, once, with an explanation; retry only when the user explicitly insists — their account, their decision.

## 5. BID STRATEGIES AND HOW EACH BREAKS AT VOLUME

Meta: Highest volume (lowest cost), Highest value, Cost per result goal (cost cap), ROAS goal, Bid cap. TikTok: Lowest cost / maximum delivery, Cost cap, Bid cap, Value-Based Optimization (VBO).
Lowest cost / highest volume: spends the full budget, CPA floats. Breaks when budget outgrows the audience: CPA climbs with each step, silently. Default for testing and small accounts.
Cost cap / cost per result goal: the platform averages toward your target. Breaks when the target is below what the auction can deliver: spend stops, the ad set looks dead. Use only after one full learning cycle revealed a true CPA; set it at or slightly above the profitable CPA, not at the wish.
Bid cap: a ceiling on the auction bid, not on CPA. Breaks fastest: too low wins nothing, too high buys junk. Expert tool only.
ROAS goal / VBO: need purchase value in the event. The Wandit Lead carries no value and no currency, so on a Wandit page they have nothing to optimize on — do NOT recommend them there.
Auction mechanics: Meta ranks by total value = bid x estimated action rate + ad quality, billed as eCPM. Weak creative or poor signal lowers estimated action rate and raises effective CPM more than any bid setting; rising CPM on a stable audience is usually a creative problem, not a bidding one. Meta's ad-level quality / engagement / conversion rate rankings say which term is weak (ads-creative).

## 6. TRACKING — ONLY WHAT STRUCTURE NEEDS

Needed: browser pixel (Meta Pixel / TikTok Pixel) plus server stream (Conversions API / Events API); standard events — custom events feed the algorithm worse; dedup browser and server copies by event_id plus event name; Event Match Quality and Aggregated Event Measurement (verified domain, Lead ranked) decide how much signal the platform can use (detail: ads-measurement).
Wandit reality: the published page fires one bare Lead per accepted lead (no value, no currency, no eventID) — optimize on Lead, expect no value optimization, promise no dedup. On TikTok, Lead is not a standard event name (the form event is SubmitForm): confirm in TikTok Events Manager that the event arrives and is selectable as the optimization event before launching a conversion campaign.
Instant forms (Meta lead ads, TikTok instant pages) trade quality for volume: cheaper, more leads, lower intent, no Wandit page, no Leads-tab attribution; suggest them only to a merchant who accepts more confirmation calls per delivered order. Merchant truth is read_lead_performance: counts and rates by source (facebook / tiktok / direct, from UTMs), by campaign (utm_campaign), by status (to_confirm -> confirmed -> shipped -> delivered | returned | cancelled).
HARD RULE: ads pointing to a Wandit page carry UTM tags (utm_source=facebook|tiktok, utm_medium=paid, utm_campaign=name); without them the Leads tab cannot attribute and this skill is blind.

## 7. SCALING

Vertical: +20-30% per 48 hours on a stable ad set (PDF rule; a larger jump counts as a significant edit). Exceptions: a fresh winner on a tiny base may take one larger step; a CBO campaign steps as a whole; in Ramadan or pre-Aid weeks the auction moves daily — step slower. If CPA rises beyond the noise band after two steps, that is the break point — hold, do not panic-retreat. The marginal cost of the last increment, not the average, decides the next step (ads-measurement).
Horizontal: duplicate the winner into a new audience, placement, geography or campaign with the same post ID; it adds reach without resetting the winner. Prefer it while the winner is in learning.
Saturation (fast in small markets): prospecting frequency climbing, CPM up with CTR down, first-time impression ratio dropping. Fix: new creative and audiences, not budget.
Do NOT scale what cannot be delivered: stock, confirmation capacity and courier coverage cap useful budget first.

## 8. DELIVERY DIAGNOSTICS

Auction overlap: your own ad sets reach the same people and bid against each other; CPM rises, delivery concentrates — merge or exclude (ads-audiences). Pacing: standard spends linearly across the day; accelerated as fast as possible — only for a deadline or a LIVE. An ad set that does not spend: bid or audience too tight, learning, disapproved ad, payment failure — in that order (ads-diagnostic). Dayparting: Meta ad scheduling needs a lifetime budget; TikTok schedules at ad group level. Use it only on a significant, repeated hour-of-day difference, or to match the confirmation team's calling hours — a COD lead never called back is a wasted click.
Frequency by funnel stage (rules of thumb): prospecting about 1-2 per week; retargeting higher, accepted; prospecting above that with falling CTR is fatigue — refresh creative (ads-creative). Frequency caps exist only on reach objectives; elsewhere budget and audience size control it.

## 9. KILL CRITERIA BY LEVEL AND THE SPEND THRESHOLD

HARD RULE: no decision at any level before cumulative spend reaches 3x target CPA; under that there is no data, only noise.
Ad: kill after 3x target CPA with zero results, or when clearly behind its siblings past the threshold; keep an ad that carries the volume even at a higher CPA.
Ad set: kill when, after 72 h and 3x target CPA, CPA sits clearly above the profitable cost per result AND the creative is proven elsewhere; with unproven creative the ad set may be fine and the creative guilty — test creative first. Never kill an ad set in learning for cost alone.
Campaign: kill when the offer or page is the problem (CVR collapses on every ad set) or delivered-order economics lose money at a good platform CPA.
Reset (relaunch from zero) only when the optimization event changed, the audience was rebuilt, or many edits destroyed the ad set's history.
Do NOT kill on one bad day, a weekend dip, or a 15% CPA move — usually noise (ads-measurement).

## 10. BREAKDOWNS — READ WITHOUT OVER-SEGMENTING

Age and gender: read, never act on reflex; the most common trap is excluding a segment on a handful of conversions. Exclude an age range only when it has spent several times target CPA at materially worse cost AND the product logically does not fit; never a cell with few impressions, nor one broad delivery already under-serves.
Placements: Meta Reels, Feed, Stories, Audience Network; TikTok in-feed, Search, Pangle (third-party app network, with a block list). Advantage+ Placements / TikTok automatic placement usually win on blended cost; exclude a placement only when significant spend shows near-zero results or a lead-quality problem — Audience Network and Pangle are the first suspects (rule of thumb), proven with read_lead_performance outcomes, never assumed.
Device, OS, connection: read for the page (Android-heavy, slow connections need a light page), not for targeting.
Geography: national by default in Algeria; regional when the merchant ships to some wilayas only. Exclude non-deliverable zones at ad-set level, aligned with the wilaya list the page accepts — an unserved wilaya is a guaranteed cancellation.
Time-to-conversion: click-to-lead is minutes; lead-to-delivered is days — judge delivered economics after the delivery window closes.
Delivery vs conversion insights: impressions, reach, frequency say where the platform delivered; conversions say where it worked — never optimize on delivery data alone. Simpson's paradox: a segment can look worse in aggregate and better inside every campaign because budget mix differs — compare within one campaign and one window.
HARD RULE: statistical significance before any exclusion; a cell with a handful of results is not a signal. In doubt, stay broad and let the algorithm allocate.

## 11. PLATFORMS OUTSIDE THE CORE

Google Ads (phase 2) is intent, not interruption: Search match types, negatives, Quality Score, Performance Max, tCPA / tROAS. Snapchat Ads (later): 9:16 sound-on, hook under 2 seconds, a different default attribution window — never compare raw ROAS with Meta. Principles only; say so.

## 12. BEFORE ANY CHANGE

Knowing when to do nothing is the skill (stance and tone: ads-diagnostic). Before any change ask, in order: tracking right? Spend above 3x target CPA? Ad set out of learning and past 72 h? Effect bigger than noise? Even an ads problem (offer, price, delivery, stock)? If any answer is no, recommend waiting and name the date and the number at which to judge again. Only money-moving writes (activating delivery, budget or bid changes on existing entities, deletes) pause for the user's confirmation; build steps run without one.
`;
