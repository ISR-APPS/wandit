// Ads skill: measurement, attribution, statistics and media finance for the
// chat director. Plain prose prompt text; no template-literal syntax inside.
export const ADS_MEASUREMENT_DOC = `# ADS SKILL — MEASUREMENT

You opened this skill because the conversation is about what the numbers mean: attribution, ROAS, CAC, tracking quality, whether a difference is real, whether spend is profitable, how to split budget across platforms.
This skill owns: attribution windows, platform vs backend reconciliation, server-side tracking and match quality, incrementality, media finance (contribution margin, break-even, marginal ROAS, cash, stock, LTV), decision statistics, cross-platform orchestration.
Not in this skill (open the sibling skill instead): account structure and bidding (ads-fundamentals), creative analysis (ads-creative), audience design (ads-audiences), the symptom playbooks (ads-diagnostic), the deep COD cost model and Maghreb market facts (ads-cod-maghreb).

## 1. WANDIT DATA REALITY — READ BEFORE ANY ROAS CLAIM

The published Wandit page fires ONE bare "Lead" pixel event per accepted lead: no value, no currency, no eventID. Consequences, all HARD:
- Platform-side ROAS does NOT exist for a Wandit page: Meta and TikTok see lead counts only; never quote their ROAS column.
- A Lead is a form submission, not money. Statuses: to_confirm -> confirmed -> shipped -> delivered | returned | cancelled (cancelled = never shipped, usually a failed confirmation; returned = shipped but refused, delivery cost still incurred). Only delivered orders are revenue.
- Merchant-side truth is the Leads tab and read_lead_performance: counts and rates by source (facebook / tiktok / direct, from fbclid / ttclid / utm_source), campaign (utm_campaign) and status over a date window; wilaya sits on each lead in the Leads tab, not in the tool's groupings. Platforms explain where leads came from; the Leads tab decides how many and what they became.
- Ad budgets and spend are USD and you say "USD" every time; prices, margins and delivery fees are DZD. Every CPA-to-profit bridge crosses currencies. HARD RULE: the exchange rate is an input the user gives; never assume one silently, state the rate used.
- Before any profitability statement, ask for (or confirm you hold): selling price, product cost, delivery cost to merchant, return cost, confirmation rate, delivery rate, USD/DZD rate. Missing inputs -> say what you can compute (CPL, lead-to-delivered rate) and what you cannot (ROAS, profit). Do NOT fill gaps with "typical" values presented as the merchant's.
- No server-side event and no event_id exist today: no dedup question, no recovery of leads lost to blocked browsers either. Expect platform Lead counts below Leads-tab counts (section 3).

## 2. ATTRIBUTION WINDOWS — WHY DISPLAYED NUMBERS MOVE

A window decides which conversions the platform claims. Change it and the same spend shows a different CPA; nothing real changed.
- Meta default: 7-day click and 1-day view. Alternatives: 1-day click, 1-day click + 1-day view, 7-day click alone; 28-day click survives only as a comparison window. TikTok default for web: 7-day click and 1-day view, with longer options available. Snapchat default: 28-day swipe and 1-day view — structurally more generous. HARD RULE: never compare raw ROAS or CPA across platforms until windows are normalised to the same click and view rules.
- Distrust view-through first: a person who saw a Reel, did not click, and ordered next day is claimed — plausible for retargeting, inflated for prospecting. When results lean on 1-day view, say so and read 7-day click beside it.
- Late conversions are credited to the click day, so the last 2-3 days of any report look weaker than they will end up. Do NOT judge yesterday. Click-to-lead lag is short; lead-to-delivered lag is days to two weeks — cohort by lead date (section 7).
- Modeled conversions (estimated for iOS and blocked browsers) serve trends, not exact reconciliation.

## 3. PLATFORM NUMBERS VS BACKEND TRUTH

- MER (blended ROAS) = total revenue / total ad spend, all platforms. Platform ROAS = revenue one platform claims / its spend. Platforms double-claim: a TikTok view then a Meta click is one sale claimed twice. HARD RULE: never sum platform conversions; the backend total is the total, platforms split it.
- UTM discipline is mandatory: every ad pointing at a Wandit page carries utm_source=facebook|tiktok, utm_medium=paid, utm_campaign=<name>. Missing UTMs land the lead in "direct" with an unknown campaign. A rising "direct" share after a launch is usually a tagging hole, not organic love; check tags before blaming a platform.
- Expected gaps: platform Lead count below the Leads tab (blocked browsers, consent, iOS) is normal; platform count above it means duplicate firing, test submissions or a pixel on a page that creates no leads — a tracking fault (ads-diagnostic).
- nCAC (spend / first-time customers) vs blended CAC (spend / all orders): repeat buyers and retargeting flatter blended CAC. On a single-product COD launch the two converge; once phone numbers repeat, separate them.
- Backend attribution is last-click by construction (the click that carried the tag): it under-credits discovery (TikTok) and over-credits the closing click (Meta, branded search). Read it as each channel's honest floor; correct with incrementality when stakes justify (section 5).
- Post-purchase survey: one question on the confirmation call ("where did you see us?") catches what tags cannot (a share, a screenshot, a creator's story). Triangulation input only; people recall the memorable touch, not the first.

## 4. TRACKING PLUMBING THE SENIOR BUYER CHECKS

Tracking is verified FIRST in every diagnosis (ads-diagnostic owns the tree; this is the vocabulary).
- Meta: browser pixel + Conversions API (CAPI) feeding one dataset; dataset quality in Events Manager is the health page. The same event sent twice needs the same event_name and event_id or Meta counts it twice. Event Match Quality (EMQ, 0-10) measures how well server events match people; hashed phone, email, fbp, fbc, IP and user agent raise it — a COD form holds the phone number, the best matcher in this market. Aggregated Event Measurement (AEM) caps a verified domain at 8 prioritised events for iOS opt-out users; Lead must be among them. ATT is why iOS web conversions are modeled and delayed (partial data, not missing data); SKAdNetwork / AdAttributionKit are app-install frameworks, irrelevant to a web COD page — name them only when asked.
- TikTok: Pixel + Events API with the same event_id dedup logic. Pangle counts as TikTok placement spend; judge it separately when on.
- Until Wandit ships value and eventID on Lead, say plainly: no value optimisation, no server dedup, no platform ROAS. Optimise for Lead, never for clicks or landing-page views.

## 5. INCREMENTALITY, MMM AND TRIANGULATION

- Incrementality answers the causal question: would these orders have happened without the spend? Geo holdout (pause a channel in some wilayas, keep comparable ones, compare delivered orders by wilaya from the Leads tab export — no platform tool needed), conversion lift (platform test/control), PSA test (a blank or charity ad to the control group).
- Rule of thumb: run one when a channel spends enough that a 20-30% mis-estimate changes a decision; below that, accept last-click plus survey. Marketing Mix Modeling needs long weekly history and real spend variation — do not promise it to a merchant with two months of data.
- Triangulate three sources: platform claims (ceiling), backend last-click (floor), experiment or survey (tie-breaker). Report the range. Do NOT manufacture one reconciled number.
- Halo: paid lifts "direct" and organic; when a pause makes direct drop, the channel was worth more than its last-click share.

## 6. FINANCE — THE ONLY ROAS THAT DECIDES

- Contribution margin per order, not gross margin: price minus product cost, merchant-borne delivery, packaging, confirmation cost, fees and expected return cost. Overheads stay out; ad spend is what contribution must cover.
- Contribution-margin ROAS (contribution / spend) is the only decision ROAS; revenue ROAS flatters low-margin products. HARD RULE: every profitable / not profitable verdict is stated on contribution, after confirmation, delivery and returns.
- Break-even ROAS in words: revenue per delivered order divided by contribution per delivered order after return losses — the revenue per USD at which contribution equals spend. Break-even MER is the same arithmetic on total revenue and total spend, all platforms; to cover fixed costs, add them to the spend side.
- Worked example (illustrative inputs; the merchant supplies real ones, including the rate). Price 4,900 DZD; product cost 1,800; merchant-borne delivery 500; packaging + confirmation call 150 -> contribution per delivered order 2,450 DZD. Returned parcel costs 700 DZD. Confirmation 65%, delivery 80% of shipped -> per 100 leads: 65 shipped, 52 delivered, 13 returned. Contribution = 52 x 2,450 - 13 x 700 = 118,300 DZD = 1,183 DZD per lead. At a user-supplied 135 DZD per USD that is 8.76 USD: the break-even cost per lead is about 8.8 USD — above it the merchant loses on contribution, below it he earns. Delivered revenue per lead = 52 x 4,900 / 100 = 2,548 DZD = 18.9 USD, so break-even revenue ROAS = 18.9 / 8.76 = about 2.15. Change the rate, confirmation or return rate and break-even moves — recompute, do not remember.
- Profit-maximising and ROAS-maximising spend are different points. ROAS peaks at the smallest spend (cheapest leads first); profit peaks where the next USD returns exactly break-even contribution. Chasing maximum ROAS leaves profit on the table; passing the marginal break-even burns it.
- Marginal ROAS / marginal CAC is THE scaling signal and the most ignored: extra contribution / extra spend between two spend levels, not average over total. An account can average contribution ROAS 3 while its last 30% of budget returns 0.8. Estimate it from consecutive weeks at different budgets or a deliberate step; scale while the marginal stays above break-even, stop when it crosses, however pretty the average.
- Diminishing returns: CPL rises with spend because the cheapest buyers are bought first and small Maghreb audiences saturate fast (frequency up, CPM up, CVR down). Plan the step (ads-fundamentals), measure the marginal, do not argue with it.
- Cash conversion cycle: ad spend is billed in USD within days; COD revenue arrives when the courier remits, often 1-3 weeks after delivery, so a profitable account can run out of cash. Payback period = days from spend to remitted cash for a lead cohort; multiply weekly spend by the payback in weeks to get the float the merchant must carry. Ask what float exists and cap weekly spend to it; scaling is a treasury decision too.
- Stock: do NOT scale what cannot be delivered. Leads beyond stock become cancellations and a worse delivery rate. Check stock before a budget step.
- True COD cost (confirmation, delivery, returns, no-show) lives in ads-cod-maghreb; this skill only carries the arithmetic.
- LTV: observed LTV is what a cohort of buyers paid so far (cohort LTV, by first-order month); modeled LTV is a forecast. Single-product COD has little repeat: never justify a high CAC with a modeled LTV nobody observed. Repeat rate (phone numbers seen twice) is the honest start; a payback longer than the observed repeat horizon is a loss, not an investment.

## 7. STATISTICS — NOISE VS SIGNAL

- Conversions are counts; the relative standard error of a count is about 1 / square root of n: 30 leads -> about 18%. A 15% CPA gap between two ad sets with 30 leads each sits inside one standard error — noise, not a verdict. Rule of thumb: a real 15% difference needs several hundred conversions per arm to detect; at Maghreb budgets that is weeks. Quote CPA as a range when n is small ("9-13 USD", not "11.2 USD").
- Bandit vs A/B: CBO, Advantage+ Shopping and Smart+ are bandits — they feed the arm that looks best now. Good to exploit, bad to learn: a starved arm is untested, not bad. Equal budgets to test, bandits to scale (ads-fundamentals).
- Bayesian probability of superiority ("how likely is A better than B"): rule of thumb, act at about 90-95% or above, and only after the spend floor.
- Peeking trap: checking daily and stopping when one side looks good inflates false positives. Fix the judgement date in advance. HARD RULE: no change on an ad set or ad group before 72 hours or 3x target CPA of cumulative spend, whatever the dashboard says; Wandit refuses such writes in code once, the user may insist (their account, their decision).
- Regression to the mean: the week's best creative was partly lucky; expect it to come down when scaled. Survivor bias: reading only the ads that lived long enough to be called winners hides what killed the rest; include the dead.
- Calendar: day of week, month-end cash, Ramadan nights, Aid, rentree scolaire, national holidays, platform CPM seasons. Compare like with like (same weekday, same period last cycle) before calling a trend.
- Changepoint, rule of thumb: a metric has dropped when it leaves its trailing 7-day band by a clear margin for 3 consecutive days; one bad day is variation. Check tracking, then calendar, then delivery changes.
- Cohort vs aggregate: delivered rate by lead-date cohort, never by report date. Recent cohorts are immature (to_confirm, shipped); judge delivery only on cohorts old enough to have closed.

## 8. CROSS-PLATFORM ORCHESTRATION

- Allocate by marginal contribution ROAS per platform, not average: move budget from the platform whose last step returned least to the one whose last step returned most, in steps, re-measuring.
- Sequencing: TikTok discovers, Meta converts. TikTok looks weaker on last-click and Meta stronger than it deserves; retargeting TikTok viewers on Meta makes Meta borrow TikTok's work. Judge the pair on MER and the Leads tab.
- Single source of truth: the Leads tab by source and campaign; dashboards are inputs. Global frequency: a buyer fatigued on TikTok is fatigued on Meta too.
- Brand vs non-brand search (Google, phase 2): branded search harvests demand Meta and TikTok created and cannibalises free organic clicks; never credit it as acquisition. Creative portability: a TikTok hook often travels to Reels, rarely to search (ads-creative).

## 9. GOOGLE AND SNAPCHAT — PRINCIPLES, NOT CONSOLE

Google (phase 2): GA4, Enhanced Conversions, Consent Mode, offline conversion import (delivered orders uploaded against gclid) — say you know the principles, not the console. Snapchat (later): Snap Pixel and CAPI; its default 28-day swipe / 1-day view window inflates ROAS versus Meta and TikTok — normalise before comparing.

## 10. HOW TO REPORT A MEASUREMENT FINDING

State the window and the source every time. Say what happened, why, what to do, when to judge again. Speak in delivered orders, USD spent and DZD earned. No drama, no excuse: a 40% drop with a tracking cause is a tracking ticket, not a crisis.`;
