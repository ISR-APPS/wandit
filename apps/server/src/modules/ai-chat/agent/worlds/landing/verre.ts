import type { DesignWorld } from "../types";

/**
 * VERRE — le verre en plein jour.
 * The light-glassmorphism fintech genre (Revolut/Wise register) executed as
 * an expensive, disciplined system: three declared glass depths over a flat
 * prism field, one grotesk, one mono, zero photography. Registered as the
 * DAYLIGHT exception to voltage's dark backdrop-blur glass, and as the
 * abstract-finance-chip exception to iris's drawn mock-UI dashboards.
 * fusesWith bridges: clair (the same trust brief in opaque daylight, when the
 * client needs friendliness over depth) · iris (the same product at night,
 * when the client wants the screen to be the poster).
 * Values below are measured from the shipped demo (Dinaro, Alger).
 */
export const verre: DesignWorld = {
	avoidFor: [
		"restaurant (classic)",
		"fine dining",
		"patisserie / bakery",
		"traiteur / catering",
		"wedding services",
		"guesthouse / riad",
		"notary",
		"lawyer / law firm",
		"carpentry / woodwork",
		"tattoo & piercing",
	],
	doc: `# DESIGN WORLD: VERRE — le verre en plein jour

## Philosophy
This page is A STACK OF FROSTED GLASS SHEETS HELD UP TO A PALE MORNING SKY. Almost nothing prints on bare ground: what is read sits ON or BEHIND a pane of daylight glass over a field of colour. ONE — THE HEADLINE CROSSES GLASS: a large frosted sheet INTERSECTS the display type, half the sentence crisp, half read THROUGH the pane — LA LECTURE À TRAVERS LE VERRE. Type and glass side by side is a template. TWO — DEPTH IS DECLARED: every container is z1 (near), z2 (middle) or z3 (far), and its alpha, blur, border, radius, shadow and scroll speed follow from that decision: everything is a pane at a stated distance, never "a card". THREE — the only light is THE PRISM FIELD, two or three flat, heavily blurred pastel discs behind the glass; panes never glow or carry a sheen. FOUR — no photography, no illustration: ABSTRACT FINANCE FRAGMENTS only (balance, rate pills, sparkline, card silhouette, QR), never a product screen, device or person.
Impossible failure modes: the dark neon glass panel (VOLTAGE's night — verre is the registered daylight exception), the purple-to-blue gradient hero wash, the shadowed white card on white (depth here is translucency, not elevation). Self-audit: (1) the headline visibly crosses one pane, both halves legible; (2) every pane's values match its register; (3) never more than three orbs per viewport; (4) exactly ONE sparkline; (5) zero raster images, icon fonts, emoji; (6) every amount mono with tabular figures, and with backdrop-filter off the page still composed and readable.

## The variation contract (why two VERRE sites never look identical)
WORLD LAW — never renegotiated:
- LA LECTURE À TRAVERS LE VERRE: the headline crosses one large sheet. WHERE it cuts is client-owned; THAT it cuts is not.
- Display type is ALWAYS full ink (FULL-INK LAW, Typography system).
- Three declared glass depths, the register below, on every container.
- The prism field as the only light: two or three blurred pastel discs behind the glass.
- Pale blue-grey daylight grounds, navy ink, ONE indigo accent. No dark section, no inverted interlude.
- Two faces: one grotesk, one mono. Mono sets money and codes, never prose.
- Abstract finance fragments as the whole imagery system: zero photography, drawn scenes or dashboards.
- Depth-float motion: transforms only, speeds ordered by depth, 1.0s power2.out, no overshoot.
- Honest fintech voice: exact figures, stated fees, no hype.
CLIENT-OWNED — where siblings diverge:
- The geometry of the crossing, and what rides on the sheet (balance, rate, receipt, card).
- The exact hexes inside the registers (ground #EEF2F9–#E9EEF7, accent #5E5CE6–#4B49C7, prism pastels from the palette below).
- LA LUMIÈRE: which two or three prism colours light this site, and where — first decision of the build, and what makes siblings different buildings.
- LE FRAGMENT-HÉROS: the financial object the page is about — balance, rate, card, receipt, QR, payout. It names the hero pane and the showpiece's subject.
- Hero composition and showpiece choreography (from LES GESTES or invented), section order beyond the fixed opening and closing, the plans, the dataset.
Name LA LUMIÈRE and LE FRAGMENT-HÉROS first: a page with neither is a glassmorphism template.

## The vibe (voice)
Banking French with the banking language taken out: short present-tense declaratives stating a fact and its cost. Every claim carries a real number and unit; every fee is written down. Numbers are locale-formatted (152,40 · 184 260,00 DA · 1,2 %); the reader has been overcharged before.
Register: "Votre argent bouge à la vitesse d'un message." · "Le taux affiché est le taux appliqué." · "Aucune marge cachée : 1,2 % annoncés."
Banned vocabulary: révolutionnaire, incroyable, boostez, "la finance de demain", exclamation marks, ALL-CAPS shouting, countdowns.

## Visual signatures
- LE VITRAGE — the frosted pane stack (owned tic; the registered daylight exception to voltage's dark glass). Three registers:
  · z1 (near): rgba(255,255,255,0.66); backdrop-filter blur(18px) saturate(1.25); border 1px rgba(255,255,255,0.78); radius 24px; shadow 0 26px 60px -30px rgba(19,27,46,0.30) + inset 0 1px 0 rgba(255,255,255,0.92).
  · z2 (middle): rgba(255,255,255,0.50); blur(14px) saturate(1.15); border 1px rgba(255,255,255,0.60); radius 20px; shadow 0 18px 44px -30px rgba(19,27,46,0.22) + the same inset arête at 0.85.
  · z3 (far): rgba(255,255,255,0.34); blur(10px) saturate(1.06); border 1px rgba(255,255,255,0.48); radius 16px; NO outer shadow, inset arête at 0.70 only.
  L'ARÊTE is that inset top-edge hairline, the sheet's cut edge: 1px, flat, white, never a sheen. Mandatory fallback — @supports not (backdrop-filter) raises fills to 0.90 / 0.84 / 0.76.
- LA LECTURE À TRAVERS LE VERRE — the crossing (pane-stack tic). ONE sheet, LA GRANDE VITRE, over the display type: fill rgba(255,255,255,0.44); border 1px rgba(255,255,255,0.72); radius 28px; shadow 0 34px 78px -36px rgba(19,27,46,0.30); THREE inset arêtes — top 1px rgba(255,255,255,0.94), left and right 1px rgba(255,255,255,0.55) — cut edges where letters enter and leave. z1 in every value BUT BLUR: blur(calc(--h1 * 0.088)) — about 7px under a 78px headline, 3px under 34px — the one sanctioned break in the register. Geometry: margin-top calc(--h1 * -1.30) drops the top edge onto the previous line's baseline, slicing its descenders, above an empty READING ZONE of calc(--h1 * 1.98). Below 600px: a forced break, pull-up calc(--h1 * -2.18), zone calc(--h1 * 2.9), TWO lines crossing. LAW: pure CSS, unchanged by JS dead or reduced motion; if the frosted half smears, lower the blur, never raise the fill.
- LE CHAMP PRISMATIQUE — the prism field (owned tic). Flat circles, single pastel fill, blur(72px) desktop / blur(46px) ≤760px, opacity 0.95, 20–46vw, two or three per section, never more per viewport, in an absolute .orbs layer at z-index 0, pointer-events none; panes at z-index 1. Orbs animate translate and scale only; their one loop is LE PRISME QUI TOURNE, a slow 40–60s orbit behind a quiet pane.
- LES PASTILLES DE CHANGE — the currency ticker pills (owned tic), five or six pairs. 999px radius, padding 9px 15px, rgba(255,255,255,0.62) fill, 1px rgba(255,255,255,0.90) border; three mono parts — pair 10.5px/+0.11em ink-55, rate 14.5px/500, delta 11px with a 7px triangle (green #1F9E76 up, rose #C2557A down). ONE pill active: indigo fill, white text. The row scrolls under mask-image linear-gradient(90deg,#000 0,#000 86%,transparent), the last pill fading, never cut.
- Hairlines inside panes rgba(19,27,46,0.10), never darker than 0.17; dividers are hairlines, never bars.
- Mono micro-captions 10.5–11.5px, +0.13 to +0.16em, uppercase, ink-38/55 (SOLDE DISPONIBLE · PLAFOND 80 000 DA), above or below their number.
- Section labels: a mono kicker with a 6px indigo dot, never a pill.

## Color physics
- GROUND: the #EEF2F9 / #E9EEF7 register — pale blue-grey daylight, a fixed 3-stop vertical body wash (0% / 46% / 100%), endpoints under 8 RGB points apart. No section owns a different ground; the prism field does the colour work.
- INK: #131B2E. Body 72% alpha, captions 55%, micro-captions 38%. Never black or a grey ramp.
- ACCENT INDIGO: the #5E5CE6 / #4B49C7 register. Budget: primary buttons, ONE active ticker pill, the sparkline stroke and its 8% area fill, the plan's 3px top rule and badge, kicker dots, step numerals, focus rings, links. It lives ONLY in panes, chips, links, small furniture and the prism field — never on display type (full-ink law), never a ground or gradient.
- PRISM PASTELS: #C9D8FF (bleu), #F4CFE4 (rose), #CFF1E4 (menthe) — ONLY as blurred orbs behind glass, never a fill, border, text colour or chip. One indigo orb at opacity ≤0.18 sits behind the closing CTA, nowhere else.
- FUNCTIONAL: #1F9E76 for positive states and the 8px status dot, #C2557A for negative deltas — chips and pills only.
- GRADIENT LAW: gradients exist in exactly three places — the body ground wash, the sparkline area fill, the ticker mask. No gradient text, buttons or borders, no radial aura behind a hero object (IRIS's).

FIXED TOKEN MAP — GROUND→--background · INK→--foreground · ACCENT INDIGO→--primary · pane white→--primary-foreground · the deeper GROUND stop→--secondary · PRISM BLEU→--accent · ink at 55%→--muted · ink at 10%→--border · 14px→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, frost or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- FULL-INK LAW (the first typography rule): display type — h1, h2, h3, pull quotes — is ALWAYS flat #131B2E at 100%. Never an accent word, a second colour, an underline, a highlight, a gradient fill or an outline. Emphasis comes from SIZE, from the LINE BREAK, from WHICH HALF CROSSES THE GLASS. The coloured keyword belongs to CLAIR and IRIS.
- DISPLAY: Schibsted Grotesk 600/700 (ALT: Onest, for a softer rounder g; NEVER Hanken Grotesk — CATALOGUE's). Hero statement clamp(2.1rem, 6vw, 4.9rem) in a --h1 custom property (crossing geometry and frost radius compute from it), line-height 1.04, letter-spacing -0.042em, eight words maximum, hand-broken with <br> (plus the extra break below 600px); never leave the crossing to a natural wrap. Section titles clamp(1.85rem, 3.5vw, 2.9rem) at -0.032em; sub-titles clamp(1.18rem, 1.8vw, 1.42rem) at -0.024em. Display never exceeds 10vw — fit-to-viewport is AFFICHE's, words-as-structure MANIFESTE's.
- BODY: the same grotesk 400/500, 16.5px, line-height 1.62, -0.005em; leads clamp(1.02rem, 1.5vw, 1.16rem) at 72% ink, capped 35rem; a third family is a bug.
- MONO: Spline Sans Mono 400/500, font-variant-numeric: tabular-nums. It sets money, rates, deltas, references, card fragments, timestamps, micro-captions, legal lines — NEVER prose, headings, navigation, buttons (mono prose is PHOSPHORE's).
- AMOUNTS carry word-spacing -0.34em so the thousands space reads as a French thin space; the currency suffix sits in a .cur span, 0.66em, ink-55, 0.35em left margin. Hero balance clamp(1.7rem, 3.1vw, 2.35rem); showpiece balance clamp(1.6rem, 3vw, 2.2rem); plan prices clamp(1.5rem, 2.6vw, 2rem). Mono at EVERY size — the inversion that separates VERRE from product worlds.
- Never italic; emphasis is the indigo, a chip, or nothing.
- ARABIC PAIRING: display and body become IBM Plex Sans Arabic (600/700, 400/500); Spline Sans Mono keeps Latin digits in chips; layout and prism field mirror to RTL. Glass, depth, motion unchanged.

## Signature art / components (the fragment system)
PHOTOGRAPHY: none by law — no stock, no render, no illustrated scene, no device mockup.
THE FRAGMENTS: pieces of a financial product, drawn in HTML/CSS/SVG, always inside a pane:
- LE SOLDE: mono uppercase label, one large tabular amount clamp(1.85rem, 3.9vw, 3rem), a hairline, two or three label/value rows on 1px dividers, a row of state pills. THE PAGE'S MOST IMPORTANT PANE: it rides ON the crossing sheet (desktop two columns, amount left, rows right); on mobile it LEADS, amount first.
- LE REÇU: status dot, one bold counterparty line, one amount, one mono meta line (Instantané · 09:41 · 6 s · 0 DA). Small, tilted 1–1.5°, frontmost pane of a SECTION collage, never in the hero (CLAIR toast).
- LA CARTE: a flat rounded rectangle, 1px hairline, brand word 11px/600/+0.14em, an indigo 22×17px rounded square as the puce, a masked mono number, a mono meta line (VIRTUELLE · 09/29). Flat fill only — bevels are AN 2000's. LE QR: an SVG module grid (three 9–10px finder squares at 2px stroke, ~25 scattered 2×2 modules) under a mono caption.
- LA COURBE: ONE sparkline per page — a polyline stroked 2px in the accent over an 8%-alpha area path, end dot r=3.5, two mono date stamps below, drawn once (strokeDashoffset, 1.4s power2.inOut).
Every fragment carries role="img" and a real aria-label; numbers invented but coherent (real communes, plausible amounts, one last-four digit group page-wide).
- BUTTONS: corners consume var(--radius) directly (the 14px register) — never 8px, never a full pill (pills belong to chips). Primary: indigo fill, white text, 600, padding 0.86em 1.4em; hover deepens to #4B49C7, lifts 2px, 0.22s. Ghost: rgba(255,255,255,0.58), 1px rgba(255,255,255,0.85), blur(12px).
- FORMS: the lead form is the frontmost sheet (z1, radius 28px): a claim column beside a field column. Fields are glass wells: rgba(255,255,255,0.60), 1px rgba(255,255,255,0.90), radius 14px, 15.5px; focus turns the border indigo, fill to 0.85. PHONE FIRST after the name — a tel input, mono +213 prefix, inputmode and autocomplete set; one select. HONEST SUCCESS STATE: the form is replaced in place by a receipt slip — green dot + "Demande enregistrée", a personalised title, a real next step with real hours, a mono reference (DNR-2026-0418 register), in an aria-live="polite" block. On valid submit dispatch the wandit:lead CustomEvent on document, fields flat in detail; keep one off-canvas decoy input with data-wandit-hp the script never touches.
- ::selection indigo on white; :focus-visible 2px indigo at 3px offset. Favicon: inline SVG data URI, a white 66%-alpha pane over a blue and a rose disc.

## Page chassis
- Container 1200px, side padding clamp(20px, 4vw, 44px). Section rhythm clamp(4rem, 8vh, 6.6rem), tightened to clamp(2rem, 4vh, 3.2rem) before the showpiece. Sections: scroll-margin-top 88px, overflow: clip; html/body overflow-x: clip.
- HEADER: transparent over the hero; past 40px of scroll it takes rgba(238,242,249,0.72), backdrop-filter blur(16px) saturate(1.2), a white hairline, a long soft shadow. Wordmark 19px/600, four links, one ghost + one primary button; links drop below 900px. Full-width bar, never a pill.
- FIXED OPENING (hero law): a mono kicker on BARE GROUND (11.5px, +0.16em, uppercase, ink-55, 6px indigo dot before it — never a rounded eyebrow pill, CLAIR's). Then the h1 in full ink, hand-broken, CROSSING ONE LARGE SHEET, the fragment-héros riding it below the reading zone (payment client: le solde). Then, on bare ground, one sub-sentence at 33rem and a right column — primary + ghost CTA above a mono trust line of three claims (one column below 900px). THE HERO CARRIES EXACTLY ONE PANE (ban 0b).
- FIXED CLOSING: the form sheet, centred at 920px over the indigo orb, then a quiet footer on bare ground — wordmark and one line, three link columns under mono headers, a hairline, a mono legal row.
- FREE MIDDLE (compose 3–5, never two adjacent alike):
  · LA BANDE DE CHANGE — a full-bleed glass strip (radius 0, no side borders, 28px vertical padding) holding a label block and the pill row.
  · L'ESCALIER — 3–4 panes on a 12-column grid stepping diagonally (spans 1/8, 6/13, 2/9), -36px overlaps, depth increasing downward, text and fragment swapping sides. Variant LE MUR DE PANNEAUX: five panes, no two alike.
  · LES FORMULES — three plans as three depths: the recommended one z1, raised -22px, wider (grid 1fr 1.13fr 1fr, gap clamp(14px, 1.6vw, 22px)), 3px indigo top rule, mono badge; the others z3. Prices mono, features on hairline rows with an 11px indigo check; one column below 900px.
  · LA PREUVE — one static client sentence, clamp(1.35rem, 2.5vw, 1.95rem), beside a z2 pane holding the only sparkline. Never a carousel.
  · LES GARDES — three short z3 panes (mono indigo label + one sentence) above a full-width FAQ pane of details/summary rows, rotating plus glyph.
- Exactly ONE scroll-scrubbed showpiece per page, mid-page.

## Motion identity — DEPTH FLOAT (GSAP 3 + ScrollTrigger via CDN)
GOVERNING LAW: every hidden state is set with gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). CDN dead means a complete, composed page.
- TRANSFORMS ONLY. Blur is never animated: opacity, x, y, scale and strokeDashoffset are the whole vocabulary.
- ENTRANCES: 1.0s power2.out, stagger 0.085–0.09s, opacity 0→1 with yPercent by depth — z1 10%, z2 7%, z3 4%: a uniform stagger kills the signature. Sections trigger at "top 80%". Hero order: kicker → headline → sheet → sub → CTA.
- THE CROSSING SHEET IS LOCKED: it fades in place at yPercent 0, never drifts, tilts or scales — its reading zone is registered to the headline behind. Every other pane drifts.
- DRIFT (depth is also a speed): one scrub-0.8 tween per pane, "top bottom" to "bottom top", y by depth (z1 -52 to -58, z2 -22 to -34, z3 -12 to -16), orbs the opposite way (+34 to +64, or -36 to -42). Full-bleed elements never drift; in the hero only the ORBS move.
- CAUTION: GSAP takes over the transform and clears CSS individual translate/rotate/scale; static tilts and offsets on animated panes must be re-declared with gsap.set(rotation) or as position: relative + left.
- SHOWPIECE SEED — L'ASSEMBLAGE: a 300vh section (250vh ≤760px), 100vh position: sticky frame (CSS sticky, never a ScrollTrigger pin). THE FRAME IS FILLED, NEVER FLOATED IN A VOID: sticky inner a flex column, justify-content: space-between, height 100%, padding-top clamp(78px, 10.5vh, 112px), padding-bottom clamp(26px, 4.6vh, 50px); head high, stage flex: 1 and centred, legend low. Beat 0 plays on APPROACH, not scrub: head, FAR pane and first legend line at "top 72%", never an empty stage. Then a scrub-0.7 timeline, "top top" to "bottom bottom", on a 3-unit clock: z2 rises and slides 28px inward at t 0.10 (0.9s), legend 0.45; z1 rises and slides 28px the other way at 0.75 (0.95s), legend 1.10; balance digits RESOLVE left to right from t 1.15 (per-character opacity 0.25s, 0.045s stagger — never rolling digits, FORME's); orbs scale 0.88 to 1. THE STACK IS WHOLE BY t≈1.7 OF 3, the last third the prism field alone behind assembled glass. Panes land in a diagonal fan (left -118px, centre 0, right +118px via position: relative, -15px overlaps, width min(486px, 92%)). "Glass assembles in depth order toward one legible figure" is law; the choreography is client-owned.
- HOVER: panes lift 3px, border to rgba(255,255,255,0.95) over 0.24s cubic-bezier(.22,.61,.36,1); :focus-within the same, for keyboard and touch parity. Buttons lift 2px; nothing scales past 1.02 or rotates.
- FORBIDDEN EASINGS: back, elastic, overshoot. power2/power3/expo/sine only.
- REDUCED MOTION: the showpiece collapses to auto height, fan composed, digits present, sparkline drawn: a composed still, never a blank.

## Verre ban list (the global ban list applies; in addition)
0. THE ACCENT KEYWORD IN A HEADLINE — an h1/h2 word in the accent, underlined or highlighted (full-ink law). CLAIR's and IRIS's move; forbidden anywhere.
0b. THE STOCK-FINTECH HERO — copy column left, a collage of two or three floating cards right, a "payment received" toast tilted over their corner, a pill eyebrow, pill CTAs. CLAIR's and every template's; a VERRE hero is one sheet crossing the headline — no card collage, no toast, no QR chip in the first viewport.
1. Neon-tube type, electric beam lines, DARK glass with glowing 1px borders — VOLTAGE's.
2. The single radial aura behind a hero object, and drawn mock-UI dashboards with header rows and populated tables — IRIS's.
3. Soft-shadow floating cards on white, duotone spot illustrations, the pill-tab switcher, the rounded eyebrow pill — CLAIR's.
4. Chrome and metal type, glossy aqua orbs with specular sheen, orbit rings, lens flares — AN 2000's.
5. Puffy blobs, squash-and-stretch, back.out overshoot ≥1.7 (GUIMAUVE's); the 800px pill nav container and halftone-dot hero (CALDERA's).
6. Rotated crossing marquees, telemetry captions (SYS.STATUS, FILE 001), outline display type, mix-blend-mode difference chrome — CINÉTIQUE's.
7. Rolling odometer digits (FORME's) and giant serif pull-figures on a hairline rule (CAPITALE's): verre's numbers resolve, never roll.
8. Arch geometry and 4% plaster grain (MATIÈRE's).
9. Any photograph, render, 3D object, device mockup, browser frame or traffic-light dots; illustrated people, faces, hands.
10. Purple-to-blue gradient washes, gradient text, gradient buttons, glowing borders, text-shadow halos.
11. Animated blur or backdrop-filter; blur outside the 10–18px register; more than three orbs per viewport; orbs in front of glass or with visible edges.
12. A dark section, an inverted interlude or a "dark mode" — VERRE has no night. Also mono prose, buttons or navigation, and any amount NOT in mono.

## LES GESTES (moves menu)
Every hero geste crosses the headline with glass — law; only the cut varies.
- LA LECTURE À TRAVERS LE VERRE — THE CANONICAL OPENING: a full-container sheet across the headline like a sash, top edge on the first line's baseline, last line read through the frost, fragment-héros in the sill.
- LE MONTANT — the sheet stands on the right 54%, full height; every headline line crosses its left edge, half crisp half frosted.
- LE LINTEAU — headline and CTA centred; ONE wide z1 pane clipping the last line's descenders, two z3 fragments above.
- LE COMPTE POSÉ — centred claim; one large pane low-centre over the biggest orb, crossing the final line, ticker row on its edge.
- LA GRANDE VITRE — the hero lives INSIDE one giant z1 pane, headline overhanging its top edge: first line crisp, the rest inside the glass; prism field only at the edges.
- LE REBORD — an almost empty prism field, headline high and left; ONE narrow pane docked to the bottom viewport edge, rising far enough to take the last line.
- L'ESCALIER — section: the diagonal step of 3–4 panes, depth increasing downward, text and fragment swapping sides.
- LA BANDE DE CHANGE — section: the full-bleed strip, pill row masked right, one mono update stamp.
- L'ASSEMBLAGE — showpiece: panes arrive far to near into a diagonal fan while the hero figure resolves digit by digit.
- LA FEUILLE QUI PASSE — showpiece: one pane travels z3 to z1 on scrub (scale 0.90→1, opacity 0.35→1, y +160→0), orbs the other way.
- LE TAUX QUI SE POSE — showpiece: the pills land one by one, the sparkline draws beneath, the active pair turns indigo last.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- "DINARO" — payment and card app, Alger. Lumière bleu/rose/menthe; héros: le solde. Hero: LA LECTURE À TRAVERS LE VERRE, second line through a sash. Showpiece: L'ASSEMBLAGE. Mood: morning light on a ledger that adds up.
- "TAUX BLED" — remittance and FX. Lumière menthe and rose; héros: le taux. Hero: LE LINTEAU, its pane holding the live pair. Showpiece: LE TAUX QUI SE POSE. Mood: a rate readable across the room.
- "CARNET DE CAISSE" — treasury for freelancers (SaaS). Lumière bleu and menthe; héros: le journal. Hero: LA GRANDE VITRE. Showpiece: LA FEUILLE QUI PASSE, a statement travelling z3 to z1. Mood: a quiet desk, bright day.
- "AMANE" — mobile micro-insurance. Lumière rose dominant, one bleu disc; héros: le contrat. Hero: LE MONTANT mirrored, sheet LEFT 52%. Showpiece: LE PRISME SCRUBBÉ, orbs crossing behind a fixed pane whose content changes each pass. Mood: calm on a bad day.
- "SAHM" — savings and investment. Lumière menthe and bleu, orbs low; héros: la courbe. Hero: LE REBORD. Showpiece: L'ÉCLATEMENT, one pane separating into three on scrub. Mood: patience, drawn in glass.
- "PASSERELLE" — payments API, merchants. Lumière bleu only, two discs, the coldest sibling; héros: le webhook. Hero: LE MONTANT, a tall right-54% sheet cutting three lines. Showpiece: LE TRAVELLING, LE MUR DE PANNEAUX dollying sideways at three speeds. Mood: infrastructure that never shouts.
- "NAJM" — a mobile operator's app, waitlist. Lumière rose and menthe, orbs high; héros: le forfait. Hero: LE COMPTE POSÉ, chip row on its bottom edge. Showpiece: LA BANDE QUI SE REMPLIT, a strip whose pill row fills on scrub. Mood: a launch that did its homework.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
FOUR things must be at 100%. THE CROSSING: the headline passes behind one large sheet — not next to it, THROUGH it — both halves legible; too opaque gives a white box, too blurred a bruise, so tune the blur against the display size, never the fill. DEPTH DISCIPLINE: three registers without exception, alpha, blur, radius, shadow and speed agreeing — one pane at the wrong opacity flattens the stack into white rectangles. THE PRISM FIELD: strong enough to be seen THROUGH the glass (0.95 opacity, 20–46vw, blur 72px); a timid field goes grey-on-grey. THE FRAGMENTS: one balance, one row of rates, one curve, coherent data, mono tabular figures; a pane reading as "an empty white box with a title" is a template.
Cheap details that separate this from a generated page: the three inset arêtes on the crossing sheet, the 1px arête on every other, the -0.34em word-spacing making a French thin space, the ticker's mask fade, the +213 prefix, the mono reference on the success slip, the indigo orb saved for the last viewport. When in doubt, do not add an element — move an existing pane closer or further away. In this world, distance is the design.`,
	energy: "medium",
	family: "fintech-glass",
	fusesWith: ["clair", "iris"],
	id: "verre",
	industries: [
		"fintech product",
		"SaaS product",
		"mobile app landing",
		"startup (pre-launch / waitlist)",
		"AI product",
		"dev tool",
		"IT services / agency",
		"telecom / ISP",
		"financial advisor",
	],
	kind: "website",
	mood: ["luminous", "translucent", "calm", "precise"],
	name: "Verre",
	preview: {
		accent: "#5E5CE6",
		fontFamily: "Schibsted Grotesk",
		ground: "#EEF2F9",
		ink: "#131B2E",
		sampleWord: "Dinaro",
	},
	priceFeel: "premium",
	tagline:
		"Le verre en plein jour : panneaux dépolis, lumière prismatique, chiffres nets.",
};
