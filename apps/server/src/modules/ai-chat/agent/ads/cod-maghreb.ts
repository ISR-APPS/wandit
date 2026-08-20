// Ads skill: COD economics and Maghreb market specifics (PDF block 14, block 7 for
// COD pages, COD cost lines of block 12). Plain prose, no template syntax inside.

export const ADS_COD_MAGHREB_DOC = `# ADS SKILL — COD MAGHREB

Open this skill when the account sells cash-on-delivery in Algeria or the Maghreb and a number, a plan or a verdict depends on what happens AFTER the click: confirmation, shipping, delivery, returns, seasons, languages, wilayas.
This skill owns: COD unit economics, the form-as-conversion reality, junk traffic, WhatsApp/Messenger campaigns, language, saturation, seasonality, CPM inflation, delivery constraints, offer and post-click for COD pages.
Not in this skill (open the sibling skill instead): account structure, bidding and learning phase (ads-fundamentals); hooks and creative testing (ads-creative); audience building (ads-audiences); attribution windows and statistics (ads-measurement); the symptom tree (ads-diagnostic).
No international tool models these specifics. Reason with the merchant's own numbers, never with Tier-1 assumptions.

## 1. THE REAL COST IS LEAD-TO-DELIVERED

HARD RULE — In COD, the platform CPA (cost per Lead) is NOT the cost of a sale. A lead is a phone number on a form. Money arrives only when a parcel is delivered and paid. Every profitability statement must walk the chain lead -> confirmed -> shipped -> delivered and must count returns and the confirmation effort.

Formulas:
- Delivered orders = leads x confirmation rate x delivery rate (delivery rate = delivered / shipped; no-shows and refusals are the difference).
- Real cost per delivered order = ad spend / delivered orders.
- Return cost = returned parcels x (outbound carrier fee + return fee the carrier charges). Shipping is paid twice and nothing is sold.
- Confirmation cost = confirmation-agent time or call credit per lead x leads (every lead, including the ones that never confirm).
- Contribution per delivered order = price collected - product cost - carrier fee not covered by the customer - share of return cost and confirmation cost per delivered order.
- Net contribution of a campaign = contribution per delivered order x delivered orders - ad spend (converted once at the rate the merchant really pays for USD; say which rate you used).
- Break-even cost per delivered order = contribution per delivered order before ad spend. Break-even cost per LEAD = that number x confirmation rate x delivery rate. This is the only CPA target worth giving the platform.

Ad spend is USD; prices, carrier fees and margins are DZD. Say "USD" for spend every time; never mix the two silently.

Worked example (illustrative): 100 USD at 2 USD CPM = 50,000 impressions; 1.5 percent CTR = 750 clicks; 4 percent form rate = 30 leads, platform CPA 3.33 USD. Confirmation 60 percent -> 18 shipped. Delivery 75 percent -> 13 or 14 delivered, 4 or 5 returned. Real cost per delivered order: about 7.4 USD, more than twice the platform CPA; add about 4,500 DZD of two-way shipping on the returns (1,000 DZD each, illustrative) and the agent hours on all 30 leads. Present the verdict on the 7.4 USD and the DZD contribution, never on the 3.33 USD.

Stock and cash: do NOT scale what cannot be shipped — ask for units on hand and the restock lead time before any budget raise; a lead the merchant cannot ship within the promised window cancels or returns. COD cash arrives from the carrier days to weeks after delivery while ad spend is charged up front in USD: the float, not the ROAS, often sets the scaling pace (ads-measurement owns the cash and marginal-ROAS model).
do NOT call a campaign profitable from platform ROAS or CPA alone. do NOT scale a campaign whose confirmation or delivery rate is unknown.

## 2. THE MERCHANT'S NUMBERS BEAT EVERY BENCHMARK

The Leads tab is the merchant-side truth. Each lead carries a source (facebook, tiktok or direct, from fbclid, ttclid or utm_source), a campaign (from utm_campaign) and a status: to_confirm -> confirmed -> shipped -> delivered or returned or cancelled. cancelled = confirmation failed; returned = shipped and refused, shipping paid and lost. Read counts and rates by source, campaign and status over a date window with read_lead_performance before any benchmark is mentioned.

Rules of thumb for the Algerian COD market, to be used ONLY when the merchant has no history yet, and always labelled as such: confirmation rate often lands between 50 and 75 percent; delivery rate of shipped orders between 60 and 85 percent, higher for stopdesk than for home delivery; returns 15 to 40 percent of shipped. They vary strongly by product, price, wilaya mix and confirmation speed. From thirty or more leads on a campaign, the merchant's own rates replace the rule of thumb. Judge delivery on a window old enough for parcels to have arrived (window minus carrier lead time).

Compare sources on delivered and contribution, not on lead count. Cheap leads at 30 percent confirmation are often dearer than costly leads at 70 percent; say so with the numbers.

## 3. NO BANK CARD: THE FORM IS THE CONVERSION

There is no checkout and no Purchase event with a value. A published Wandit COD page has exactly one order form: name, phone, wilaya, commune, sometimes bundle and delivery method. Submitting it fires one bare Lead pixel event per accepted lead: no value, no currency, no eventID. Consequences:
- Optimise Meta and TikTok on that Lead event (conversions objective on the Lead / form event): it is the closest thing to a qualified lead the platform can see. Never optimise on clicks, landing-page views or video views: that buys the cheapest finger in the country, often a bot.
- The platform cannot see confirmation, delivery or value. Its conversions and any ROAS it prints are lead counts. Value-based bidding (Meta value optimisation, TikTok VBO) has nothing to learn from and should not be promised until a value or a confirmed signal is sent back.
- Phone number is the identity key. It is what the merchant calls and what deduplicates. Email is absent by design, so customer-file uploads and match quality rest on the phone alone (ads-audiences, ads-measurement).
- Attribution: the platform credits Lead events by its click and view windows and cannot see which lead became a parcel; the merchant-side truth is the Leads tab's source and utm_campaign. Reconcile the two as counts of leads, never as revenue (ads-measurement owns the reconciliation).
- Future-looking, say it as future: sending a confirmed or delivered event back to the platform (CAPI / Events API, matched on hashed phone) would let the auction optimise on real buyers. Wandit does not do this today; do not claim it does.
- Every ad Wandit creates or updates that links to a Wandit page carries UTM tags (utm_source=facebook or tiktok, utm_medium=paid, utm_campaign=name) and existing tags are never stripped. Without them the Leads tab shows direct and the merchant-side truth is lost for that campaign.

## 4. JUNK TRAFFIC IS 20 TO 30 PERCENT HIGHER THAN TIER 1

It shows up as: impossible or repeated phone numbers, the same phone on several leads within minutes, a placement or age band with many leads and zero confirmations, a sudden CPL drop with a confirmation collapse, clicks from outside the targeted country.

What to do: optimise on the Lead event, never on clicks or landing-page views; read confirmation rate per source and per campaign before celebrating a low CPL; when one placement, country or age band produces leads that never confirm, propose its exclusion with the numbers (this is a segmentation decision, see ads-fundamentals for the breakdown rules); do not add form friction that kills real buyers (local phone validation is already the page's job).

## 5. WHATSAPP AND MESSENGER CONVERSION CAMPAIGNS

Many Maghreb buyers ask questions before ordering. Meta offers click-to-WhatsApp and click-to-Messenger ads (engagement objective with a messaging destination, optimised for conversations started); TikTok offers messaging destinations (WhatsApp, Messenger, instant messaging ads). They suit considered or high-priced products with questions; the conversation IS the confirmation and costs agent time.

Limit: a wa.me tap is not a tracked lead in Wandit today. The Leads tab shows only form submissions. For a messaging campaign the platform reports conversations started; the merchant counts closed orders in WhatsApp by hand. Judge them on the platform's cost per conversation plus the merchant's own count of orders and delivered parcels, stated explicitly as manual. Never mix them with form-lead CPA in one table without saying which is which. A page with a form and a WhatsApp button understates demand in the Leads tab; say so.

## 6. LANGUAGE: DARIJA, FRENCH, ARABIC, CODE-SWITCHING

Message match includes language: the ad and the page must speak the same language and the same register, and the form labels and success message must follow. Rules of thumb, never dogma: darija in Arabic script or Latin script for mass-market consumer goods, beauty, kitchen and kids, especially in video with voice; French for professional services, tech, premium and B2B and for a large part of urban Algiers and Oran; Modern Standard Arabic for formal, religious-season and national-holiday messaging and for cross-Maghreb reach. Code-switching (a French product name inside a darija sentence) is how people speak; welcome when natural, never as a translation accident.

RTL pages need RTL-ready creatives and captions; a Latin number or price inside Arabic text stays LTR. Test language as a variable on its own (ads-creative owns the method): same hook, two languages, same audience, and let confirmation rate, not CTR, decide — a language that attracts taps but not confirmations is the wrong language.

## 7. FAST SATURATION ON A SMALL MARKET

A few large wilayas carry most of the spend; a broad audience on one product is exhausted in weeks, not quarters. Discipline: watch frequency and first-time impression ratio from week one; plan creative velocity above a Tier-1 plan (TikTok fatigues 2 to 3 times faster than Meta; ads-creative); rotate geography by wilaya clusters (Algiers region, Oran and the west, Constantine and the east, the south with its own delivery reality) instead of burning the whole country at once; rotate angle and language before raising budget. Rising CPM with rising frequency and falling CTR means the audience is spent; a new audience without new creative rarely fixes it. The 72-hour / 3x target CPA no-touch window applies here as everywhere: Wandit refuses a write on an entity it created or changed less than 72 hours ago and explains why; the user may insist, because the account and the budget are theirs.

## 8. LOCAL SEASONALITY

Ramadan: purchases shift to the evening and late night, activity drops in the afternoon; food, kitchen, home, Aid clothing and gifts rise; CPM rises in the last ten days and the week before Aid el-Fitr. Carriers are loaded before Aid: say the parcel arrives after Aid when that is the truth. Aid el-Adha: kitchen, knives, grills, clothing; a hard stop in deliveries for two or three days. Back-to-school (late August to September): school supplies, kids' clothing, bags; competition and CPM rise. National holidays and long weekends: carriers pause; do not promise 48-hour delivery across a holiday. Summer: seaside products sell, home deliveries fail more while people travel. Payday: salaries land around month end; confirmation and delivery rise a few days after and fall in the last week for higher prices (rule of thumb, verify in the Leads data).

What changes: bids and budgets accept a seasonal CPM rise instead of reading it as a fault; creatives carry the season (Ramadan greeting, Aid gift framing) without inventing discounts the merchant did not approve; delivery promises on the page follow the carrier calendar, and the ad must not promise faster than the page.

## 9. CPM INFLATION, 15 TO 25 PERCENT PER YEAR

International advertisers, gaming, betting and app installers are entering Tier-3 auctions. Plan for CPM to rise 15 to 25 percent per year on average, more in Q4 and before Aid. A CPM above last year's is not a fault by itself; compare to the last 4 weeks and the same season last year. Answer inflation with better creative, sharper offers and better confirmation and delivery rates, not with lower bids.

## 10. DELIVERY REALITY

Algeria has 58 wilayas. Carriers price home delivery and stopdesk (relay pickup) differently; stopdesk is usually cheaper and better delivered. Lead times run from one or two days in Algiers to a week or more in the deep south; some communes are not served. HARD RULE — do not promise in an ad or on a page what the carrier cannot do. Exclude non-deliverable wilayas and communes in targeting when the merchant's carrier grid says so; a lead the merchant cannot ship is a cost with zero revenue. A high return rate in a far wilaya cluster is a delivery problem, not a creative problem: propose geo exclusion or stopdesk-only for that cluster, with the numbers.

## 11. OFFER, LANDING PAGE AND POST-CLICK FOR COD

Message match: product, price, promise and language in the ad are the same on the page above the fold; any gap costs CVR and confirmation. When the ad shows a bundle price, the page's first price is that bundle.
CVR rules of thumb for a COD page (form submissions per landing-page view): mass-market consumer products on mobile often land between 2 and 8 percent, considered and premium products lower; desktop is a minority and usually converts lower. Labels, not targets: the merchant's own page number is the baseline.
AOV engineering: bundles (buy 2, buy 3 as radio cards), an order bump at the form, an upsell on the success screen only when the merchant can fulfil it, a free-delivery threshold set just above the one-unit price. Higher AOV raises contribution per delivered order, the number that pays for CPM inflation.
Offer construction: a clear guarantee (exchange window, pay on receipt), risk reversal (pay nothing now, check the parcel), real urgency only when the merchant supplies a real deadline or stock count, an anchor price only when the struck price is a real past price. Never invent reviews, counts or deadlines; page law forbids it and a policy warning names it.
Full funnel maths: CPM -> CTR -> CVR -> confirmation -> delivery -> AOV -> contribution. Lay the chain out with the merchant's figures before any verdict; the weak link names the next move (creative for CTR, page and offer for CVR, call script and speed for confirmation, carrier and geo for delivery).

## 12. HOW TO SAY IT

Business language, no drama, no excuses. Say what happened (delivered orders and real cost per delivered, not platform CPA), why (which link of the chain moved), what to do (one or two actions, each with its cost), and when to judge again (after 72 hours, after 3x target CPA of spend, after the carrier lead time for delivery). Quote the merchant's own rates and name any rule of thumb as one. Policy warnings name the element, the rule, the risk and a compliant rewrite; they never forbid. The account, the budget and the risk belong to the user.`;
