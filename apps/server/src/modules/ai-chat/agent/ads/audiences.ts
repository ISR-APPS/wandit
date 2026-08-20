// Ads skill "ads-audiences": prospecting doctrine, retargeting ladders,
// lookalikes, exclusions and overlap for Meta and TikTok in a COD market.
// One template literal of plain prose; a spec forbids backticks and
// template-literal placeholders inside it.

export const ADS_AUDIENCES_DOC = `# ADS SKILL — AUDIENCES

You opened this skill because the conversation is about WHO an ad set or ad group reaches: prospecting targeting, retargeting ladders, customer files, lookalikes, exclusions, overlap, cross-platform retargeting.
This skill owns: audience architecture and hygiene, the COD translation of every funnel audience, and a short audience diagnostic.
Not in this skill (open the sibling skill instead): creative and hooks (ads-creative), bidding, budgets, CBO/ABO and the 72-hour / 3x CPA rule (ads-fundamentals), attribution maths and platform-vs-backend gaps (ads-measurement), confirmation and delivery economics (ads-cod-maghreb), the full diagnostic tree (ads-diagnostic).

## 1. PROSPECTING DOCTRINE

HARD RULE: on Meta in 2026, broad targeting plus a clean conversion signal beats interest targeting almost always. Start broad, let Advantage+ Audience (or an Advantage+ Shopping campaign) use the signal. Same on TikTok Smart+ once the pixel or Events API feeds it.
"Clean signal" means: the Lead event fires once per accepted lead, pixel or CAPI/Events API verified, and the ad set optimises for Lead, never for clicks, landing page views or engagement. Without it, broad is blind: fix tracking first (ads-measurement), then go broad.
Interests, behaviours, hashtags and creator targeting still earn their place in three cases: a brand-new account with zero conversion history (first learning week only); a niche product the broad pool would never self-select; a message written for one group that would annoy everyone else. Use them as a suggestion on top of Advantage+ Audience (suggestions are soft; custom-audience exclusions stay hard), not as a cage, and drop them once the ad set exits learning. On TikTok, interest, hashtag and creator-interaction audiences are broader and noisier than Meta interests: discovery hints. Search Ads (keyword surface) are intent capture; read them as a separate audience.
Small-market reality: Maghreb audiences are small. Broad Algeria 18-65 is tens of millions of profiles; one product's real buyers are a few thousand. Broad saturates in weeks. Watch 7-day frequency per ad set from day one: rising frequency + rising CPM + falling CTR is saturation, not a targeting error. Cure: new creative and angles first, new audiences second, a new wilaya or country split last. Do NOT answer saturation with interest layers; that shrinks the pool and speeds up the wall.
Exclude wilayas the merchant cannot deliver to and say so in the ad set name. Target language by the language of the creative (darija, Arabic, French), not by assumption.

## 2. THE WARMTH LADDER

Retargeting is a ladder of time windows; each rung gets a different message because the person is in a different state.
- 3 days: hottest. Remove the last doubt, answer the objection, restate offer and delivery promise. No discount.
- 7 days: warm. Proof: reviews, demonstration, unboxing; reassurance on pay-on-delivery and exchange.
- 14 days: cooling. New angle or new format; the first creative did not convince, repeating it fails again.
- 30 days: lukewarm. A real reason to come back: bundle, real stock limit or deadline, seasonal hook (Aid, Ramadan, rentree). Invented urgency burns trust.
- 90 days: cold. Re-introduction with the best prospecting creative. Cheap reach, low intent.
- 180 days: website-audience retention limit on both platforms. Beyond it, a stranger: prospecting.
Rule: each rung EXCLUDES the hotter rungs (7d excludes 3d, 14d excludes 7d...) so one person sits on one rung. Without exclusions the rungs self-bid and hot people see cold messages.
In a small market, 3d and 7d rungs are often below the delivery minimum (roughly a thousand matched people, rule of thumb from platform minimums). Merge to 7 / 30 / 90 when volume is low; keep the message logic. Budget in proportion to decay: most of the retargeting USD on the hottest rung that still has volume, a sliver on the coldest.

## 3. VIDEO AUDIENCES

Relative value, weakest to strongest:
- 3 s (Meta 3-second views; TikTok 2 s / 6 s): a scroll-stop, not interest. Huge, cheap. Seed for reach only.
- 25%: they gave the hook a chance. Mostly noise.
- 50%: real attention. First rung worth a conversion message.
- 75%: genuine interest. The video-view-to-conversion play retargets this rung: best size/intent balance.
- 95% / watched to end: highest intent, tiny. Top of the ladder and lookalike seed.
Retention: up to 365 days on Meta, 180 on TikTok; section 2 decay applies anyway.
Video-view-to-conversion: a cheap video-views campaign builds a 50-75% viewer pool; a Lead-optimised ad set retargets it. When site traffic is thin it is often the cheapest warm pool available (rule of thumb). It does not replace conversion-optimised prospecting.

## 4. ENGAGERS

Instagram account and Facebook Page engagers, TikTok profile visitors, likers, commenters, sharers, savers, CTA clickers. Shares and saves signal intent; likes signal nothing. On a COD ad, comments are often price questions and order intents: a commenter audience is hot and cheap.
Use engagers as a mid-funnel rung between viewers and visitors, and as a lookalike seed when the website pool is too small. Do NOT run engagement-optimised campaigns to feed them; build them as a by-product of conversion and video-view campaigns.

## 5. FUNNEL AUDIENCES AND THE COD TRANSLATION

Classic ladder: ViewContent -> AddToCart -> InitiateCheckout -> Purchase, each rung excluding the rungs below it. Cross-exclusions are MANDATORY: never show an abandoned-cart ad to a buyer.
On a Wandit page there is no cart and no card. The "purchase" is the form submission: the page fires one bare Lead event per accepted lead (no value, no currency, no event id). Confirmation happens by phone. Lead statuses: to_confirm -> confirmed -> shipped -> delivered | returned | cancelled.
The COD ladder:
- Visited, did NOT submit (website audience minus Lead audience): the retargeting target, message by rung.
- Submitted (Lead audience): EXCLUDE from retargeting and prospecting. They are in the confirmation pipeline; only the phone call converts them, more ads waste USD and create duplicate orders.
- Confirmed / shipped / delivered: EXCLUDE from acquisition of that product. The pixel cannot know who confirmed; rebuild from the Leads tab export as a customer file (section 6).
- Cancelled (confirmation failed): do NOT retarget with the same offer; the failure was the phone, the price or a fake order. A different offer later, if the merchant wants it.
- Returned (shipped, refused, shipping cost incurred): exclude; a second attempt is the most expensive lead in the funnel.
The platform sees Lead; Wandit sees the rest. Merchant-side truth by source and campaign is the Leads tab / read_lead_performance. Decide which audiences deserve budget on confirmation and delivery rates, not only on platform cost per Lead.

## 6. CUSTOMER FILE (PHONE-FIRST)

Maghreb is no-bank-card and phone-first: the match key is the phone number, not the email. Upload phones in international format (+213...), normalised, plus country. Platforms hash (SHA-256) on upload; both accept pre-hashed data.
Source: Leads tab export filtered by status (confirmed / delivered = buyers; cancelled / returned = negative list). Re-upload weekly (rule of thumb) so exclusions stay current.
Match rate: a phone matches only when the platform account carries that number (common in the Maghreb, where accounts are registered by phone; rule of thumb, not a guarantee). Expect well under 100 percent on both platforms and treat the MATCHED count as the audience. Below the delivery minimum, the file is an exclusion and a seed, not a deliverable audience.
LTV segmentation: the pixel carries no value; value lives in the Leads tab. Segment by hand: delivered buyers (best), repeat buyers (rare in single-product COD, gold when present), returned (negative). Add an order value column to unlock value-based lookalikes.

## 7. LOOKALIKES

HARD RULE: source quality beats percentage. 600 delivered buyers beat 40,000 page visitors.
Seed priority, best first: delivered buyers -> confirmed leads -> Lead submitters -> 95% / 75% viewers -> engagers -> all visitors. Never seed from clickers or 3-second viewers.
Minimum seed: platforms accept about 100 matched people from one country; below roughly 1,000 the lookalike is noisy (rule of thumb; Meta's own guidance is 1,000 to 50,000). Wait for volume; a lookalike from 150 leads is a coin flip.
Tiers (Meta): 1% tightest, 1-3% the working band, 3-5% reach, 5-10% is broad with extra steps. TikTok exposes narrow / balanced / broad; same logic. In a small country, 1% is a few hundred thousand people and saturates fast. Do NOT stack overlapping tiers in separate ad sets; one tier per ad set, wider tier excludes the tighter one.
Value-based lookalike: seed with values (section 6); the platform weights high-value buyers. With Advantage+ Audience a lookalike is a suggestion; on a tested account lookalike and broad converge. When broad delivers the same cost per Lead, stop rebuilding lookalikes; when one fatigues, refresh the seed instead of widening the tier.

## 8. OVERLAP AND SELF-BIDDING

Two ad sets of the same advertiser reaching the same people compete in one auction: the platform drops one, CPM rises, learning slows, and under CBO the "loser" starves.
Measure: Meta Audiences > Show Audience Overlap (audiences of at least roughly 1,000 people) and the ad set delivery diagnostics (auction overlap, audience saturation, first-time impression ratio) where Ads Manager exposes them. TikTok does not expose overlap the same way: read it from ad groups whose CPM rises together and whose reach does not add up.
Prevent: one job per ad set. Rule of thumb: two ad sets with heavy overlap are one ad set in disguise; consolidate, do not cap. Every prospecting ad set excludes the retargeting pool (30-day visitors, Lead audience, buyer file); every rung excludes the hotter rung; every lookalike excludes its own seed.

## 9. SYSTEMATIC EXCLUSIONS AND SUPPRESSION LISTS

HARD RULE: every acquisition campaign excludes recent buyers and already-converted people. On Wandit: the Lead audience (180 days) and the confirmed/delivered customer file.
Suppression lists on acquisition: buyer file, cancelled and returned leads, the merchant's own team, known fraud numbers. Refresh weekly.
Advantage+ Shopping accepts few exclusions: define existing customers in the account-level audience segments and cap their budget share; under Advantage+ Audience a custom-audience exclusion is still a hard exclusion. TikTok Smart+ takes exclusions at the ad group.
Exception: consumables and repeat products. Recent buyers become a retention audience with its own campaign and message, still excluded from prospecting.
Do NOT exclude an age band or gender on a hunch; that is a breakdown decision (ads-fundamentals) and needs statistical weight.

## 10. DYNAMIC PRODUCT RETARGETING

Meta Advantage+ catalog ads (DPA) and TikTok Video Shopping Ads / Product Shopping Ads retarget the exact products viewed. They need a catalog, a feed and ViewContent / AddToCart events with content ids.
A single-product COD merchant on a Wandit page should IGNORE them: one product, Lead only, a static retargeting ad does the same job with no feed. Revisit with a real catalog (dozens of SKUs) and product-level events. GMV Max and LIVE Shopping assume TikTok Shop checkout, absent for COD pages: say so, do not promise it.

## 11. CROSS-PLATFORM RETARGETING

The sequence: TikTok for discovery, Meta for conversion. Audiences are not portable between platforms; a TikTok viewer cannot be retargeted on Meta by identity. What crosses is the page visit: a TikTok click that lands on the Wandit page joins the Meta website audience (pixel / CAPI), and its ttclid and utm tags put the lead in the Leads tab under tiktok. The honest mechanism: drive cheap TikTok traffic to the page, retarget page visitors on Meta, exclude the Lead audience on both. The director's UTM rule (utm_source=tiktok|facebook, utm_medium=paid, utm_campaign=<name>) is what makes the source readable.
Limits: a TikTok view that never clicks is invisible to Meta; each platform will claim the same lead (ads-measurement). Never say "we retarget TikTok viewers on Meta" without the page-visit caveat.

## 12. RETENTION WINDOWS AND VALUE DECAY

Website audiences: up to 180 days on both platforms. Engagement and video: 365 on Meta, 180 on TikTok. Customer files: no expiry, but stale; refresh.
Value decays with time and exposure: a retargeting ad set above a weekly frequency of 3 on a rung (rule of thumb) is already tired. Rotate retargeting creative faster than prospecting. When a rung's cost per Lead passes the prospecting cost per Lead, the rung is exhausted: shrink its USD, do not feed it.

## 13. GOOGLE AND SNAPCHAT (PHASE 2 / LATER)

Google (phase 2): intent first (keywords, search terms), then Performance Max audience signals and remarketing lists; Customer Match takes phone numbers. Snapchat (later): Snap Audience Match (phone), lookalikes, Lifestyle Categories; young urban skew. For both: say you know the principles, not the console.

## 14. AUDIENCE DIAGNOSTIC (SHORT)

Tracking first, always: name an audience cause only after the Lead event and UTMs are verified. No change on an ad set or ad group before 72 hours or 3x target CPA of cumulative spend. Editing targeting, exclusions or a custom audience on a live ad set is a significant edit (learning restarts): no confirmation card shows for it, so say in plain words what changes and any USD budget it touches and get the user's go-ahead in chat first; inside the 72-hour window the platform refuses once, explain and ask, never retry on your own.
- Frequency up, CPM up, CTR down on prospecting -> saturation -> test a new angle in the same ad set; cost per Lead recovers = fatigue, does not = pool exhausted, widen geography or accept the ceiling.
- Retargeting cost per Lead above prospecting -> rung exhausted or buyers not excluded -> check Lead and buyer-file exclusions, then cut the rung.
- Two ad sets with CPM rising together, reach not adding up -> overlap -> overlap tool or consolidate, judge after 72 hours.
- Good platform cost per Lead, poor confirmation rate for that source or campaign in read_lead_performance -> wrong people (curiosity clicks, under-age, undeliverable wilayas) -> compare confirmation by campaign, exclude undeliverable wilayas, move budget to the Lead-optimised broad ad set.
- Lookalike spending nothing -> seed too small or tier covered by broad -> matched seed size, exclusions; rebuild from delivered buyers past a thousand.
- Ad set with a custom audience not spending -> below delivery minimum -> merge rungs (section 2).
Recommendation tone: what happened, why, what to do, when to judge again. No drama, no excuses, business language. Budgets in USD, always.`;
