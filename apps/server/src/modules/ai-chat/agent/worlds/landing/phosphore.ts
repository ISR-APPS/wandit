import type { DesignWorld } from "../types";

/**
 * PHOSPHORE — the phosphor terminal.
 * A CRT terminal session as a website: one mono family sets everything,
 * one phosphor per client (green OR amber), motion is steps() only,
 * chrome is typed characters. Proven in worlds/phosphore/demo (LOGPILE).
 * fusesWith rationale:
 * - huitbit: the terminal walks into the arcade — retro computing brands
 *   that want both the tty and the sprite.
 * - gabarit: the console meets the drafting table — engineering tools that
 *   ship both a CLI and a drawing.
 * - iris: the terminal meets the product dashboard — dev/SaaS products that
 *   ship both a CLI and a polished UI.
 */
export const phosphore: DesignWorld = {
	avoidFor: [
		"wedding services",
		"aesthetic clinic",
		"kindergarten / crèche",
		"fine dining",
		"spa / hammam",
	],
	doc: `# DESIGN WORLD: PHOSPHORE — the phosphor terminal

## Philosophy
This page is a LIVE TERMINAL SESSION on a phosphor CRT, not a website. Someone left a machine logged in for the visitor: the tube is still warm, the cursor is blinking, and everything the company wants to say prints as commands, output, man pages and exit codes. First structural fact: MONOSPACE SETS EVERYTHING — headlines, prose, prices, legal lines — with prose held to a 60–70ch measure, because a terminal has columns, not text boxes. Second: ONE PHOSPHOR PER CLIENT — green or amber, never both, never a third hue; the page is a monochrome instrument and the restraint IS the credibility. Third: all chrome is character-grade — prompt glyphs, box-drawing frames, ASCII rules and gauges; if an ornament cannot be typed, it does not exist here. Fourth: motion is stepped — text TYPES and output PRINTS; nothing glides, drifts, eases or bounces, because a CRT paints in discrete refreshes. The generic dev-tool template is structurally impossible in this world: no purple gradient hero, no rounded feature cards, no browser-mockup screenshot — there is no imagery except the terminal itself, and a "product screenshot" is a typed transcript of the product actually being used. Warm nostalgia is the surface; hacker credibility is the depth, and credibility means every printed flag, number and exit code is REAL content — a fake transcript reads as costume within one line.
Self-audit before shipping: (1) zero glyphs outside the three licensed mono faces; (2) zero raster images, zero icon fonts, zero emoji; (3) hue count = ground register + one phosphor family + near-white at two moments or fewer; (4) border-radius 0 on every element on the page; (5) at most one blinking cursor per viewport; (6) longest prose measure ≤70ch; (7) the scanline vignette present and ≤6% visible.

## The variation contract (why two PHOSPHORE sites never look identical)
WORLD LAW — never renegotiated by brief or builder:
- Mono-everything with the 60–70ch prose measure; VT323 only above 2rem.
- One phosphor per site; near-black ground register; near-white rationed to ≤2 moments.
- Prompt-line furniture and the block cursor; typed/stepped motion — steps() and "none" are the only eases.
- Box-drawing chrome, the CRT scanline vignette, border-radius 0, character-grade ornament only.
- Dual visibility: JS dead = the complete transcript, fully printed and readable.
CLIENT-OWNED — where the siblings diverge, decided per brief:
- THE PHOSPHOR: green (the #4AF573/#3AD65F register) OR amber (the #FFB000/#E69A00 register), exact hexes per brief. Amber shifts the ground cast warm (#0A0805 register) and the mood from hacker-green to airport-departures amber.
- THE CLI PERSONA: a fictional binary named after the product ("logpile", "brewctl", "ledgerd"), its command grammar, the prompt glyph ($ or > or ~), the host string in titlebars ("demo@logpile — bash — 92×28"). The persona writes the hero line, scripts the session, and turns the feature list into flags.
- DENSITY REGISTER: airy (line-height 1.7–1.75, section padding at the top of the clamp) or dense (1.5–1.55, tighter, more lines per viewport).
- The body mono: IBM Plex Mono or JetBrains Mono, one per site.
- The session script, the ASCII diagrams drawn, the section order beyond the fixed boot and logout, where the two near-white moments are spent, and where the single inverse-video band lands.
A PHOSPHORE page with no command grammar is a failure: name the binary FIRST — it chooses the hero sentence, scripts the showpiece, names the flags and sets the voice.

## The vibe (voice)
Terse engineer register in the demo's language, written as terminal grammar: commands are copy, comments are asides, man pages are feature lists. Numbers always carry units and are always true. No exclamation marks, no "supercharge / unlock / blazingly", no adjectives doing the work output should do. Dry wit is allowed once per section, always inside a # comment. Example lines:
- "$ logpile tail --follow — every service you run, one stream."
- "# the part where you stop ssh-ing into twelve boxes"
- "Reads 2.1 billion lines a day. Loses none."

## Visual signatures
- PROMPT-LINE FURNITURE + BLOCK CURSOR (owned tic). Section labels and key lines open with the prompt glyph in dim phosphor, one ch of gap, then the phrase ("$ logpile plans --currency GBP"). The block cursor is a solid rectangle 0.55ch × 1.05em in full phosphor, blinking at 1s in steps(1) — its background toggles, its opacity never does. BUDGET: at most one blinking cursor per viewport; it parks after the hero's typed line and inside focused form fields, nowhere else.
- TYPED-TEXT REVEAL (owned tic). Headlines and command lines type on at 30–45ms per character via width tweens in ch units with ease "steps(n)" — never letter-by-letter opacity, and never paragraphs: paragraphs PRINT whole, they do not type.
- ASCII BOX-DRAWING FRAMES + CRT SCANLINE VIGNETTE (owned tic). Cards, terminal windows, plan columns and tables are framed in 1px solid dim phosphor with literal ┌ ┐ └ ┘ glyphs seated exactly on the corners and the title let into the top border on a ground-colored slug ("─ new message ─"). One fixed full-page overlay: horizontal scanlines (repeating-linear-gradient, 3px period, dark line ≤6% effective opacity) plus a radial corner vignette (transparent to ~58%, rgba(0,0,0,0.4) at the edges). The overlay never animates.
- PHOSPHOR BLOOM: display type ≥2rem may carry exactly ONE text-shadow, 0 0 14–18px at 22–30% phosphor opacity — a tube's afterglow, never a neon tube.
- INVERSE VIDEO is the only highlight mechanism: hover, focus, ::selection, the featured plan's title bar, one highlighted transcript line, and at most one full-width claim band flip to phosphor background with ground-colored text. The flip is instant — no transition. A STEADY (non-blinking) ground-colored block cursor may close the band's claim as punctuation; steady cursors never count against the blink budget.
- CHARACTER ORNAMENT: gauges are █ and ░ runs inside brackets; dividers are rows of ─ or a 1px dim rule; arrows are ──> ; list markers are · or ▸ . Decorative shapes, blobs and drawn icons do not exist.
- SCALE LAW: VT323 goes HUGE or not at all — wordmark at clamp(4rem,12vw,9.5rem), stat numerals at clamp(2.6rem,6vw,5rem); body mono never exceeds 1.05rem. The collision between billboard VT323 and 1rem mono IS the hierarchy.

## Color physics
- GROUND: near-black carrying the phosphor's cast — green sites in the #050A06/#07100A register, amber sites in the #0A0805/#100C06 register. The two ground tones sit 2–5 RGB points apart and alternate per section; the alternation is the section rhythm. There is no light mode.
- PHOSPHOR (one per site): green #4AF573 bright / #3AD65F standard, or amber #FFB000 bright / #E69A00 standard. Bright is for the wordmark, prompts, typed lines, CTAs and key output; standard sets body prose. Long prose may drop to 82–88% opacity of standard — never lower; the readability floor is ~7:1 against ground.
- DIM: #1E5C33 (green sites) / #7A5200 (amber sites) — borders, corner glyphs, comments, login banners, man-page footers, muted transcript lines. Dim is chrome and asides, never body text.
- NEAR-WHITE #E8FFEC (amber sites #FFF6E4): TWO moments per page maximum — the one number that matters, and/or the final "exit 0". Spent three times it stops meaning anything.
- NO third hue, ever. Errors, warnings and "before" states are dim or inverse video — this tube has one electron gun.
- GRADIENTS exist only as the radial vignette and the bloom shadow. Never on grounds, type, borders or buttons.

FIXED TOKEN MAP — GROUND→--background · PHOSPHOR standard→--foreground · PHOSPHOR bright→--primary · GROUND→--primary-foreground · alternate GROUND→--secondary · NEAR-WHITE→--accent · DIM→--muted · DIM→--border · zero→--radius · DISPLAY→--font-heading · BODY→--font-body. These are the only CSS color/type/radius variables: every pole below is a prose role, literal register hexes belong only in these :root values, and every sibling, bloom or alpha step is a color-mix(in srgb, var(--foreground) N%, transparent), substituting the mapped fixed token for that pole, or a color-mix between two mapped fixed-token references. Every unmapped role below MUST reuse the nearest mapped token or such a mix; it never gets another custom property or literal. Non-color mechanics may keep their own custom properties. Any rgba(POLE, a) notation below is design shorthand for that color-mix, never emitted CSS.

## Typography system
- DISPLAY: VT323 400 (Google Fonts) ONLY at ≥2rem — it is illegible small and must never set body text, labels or buttons. Zero letter-spacing (the face is already a grid). Never italic.
- EVERYTHING ELSE: IBM Plex Mono or JetBrains Mono (one per site), weights 400/500/700, base 0.95–1.05rem, line-height 1.5–1.75 per density register, prose measure 60–70ch. Labels: 700, uppercase, 0.72–0.8rem, tracking 0–0.06em.
- SIZE REGISTER: hero wordmark clamp(4rem,12vw,9.5rem); section command labels 1–1.1rem; VT323 stats clamp(2.6rem,6vw,5rem); fine print 0.8–0.85rem.
- HARD RULES: nothing but these three faces, ever — no serif, no proportional sans, no second display face, no italic anywhere. Mono numerals are naturally tabular: align columns by character count, the way ls -l does.
- ARABIC RULE: no credible Arabic terminal mono exists. Arabic pages set prose in IBM Plex Sans Arabic 400/700 on the same grounds and measure discipline, keep commands and flags in Latin mono, and VT323 never sets Arabic (it has no glyphs) — the wordmark stays Latin or becomes an ASCII lockup.

## Signature art / components
- IMAGERY IS THE TERMINAL ITSELF: session transcripts, man pages, unified diffs, ASCII pipeline diagrams (box-framed stages joined by ──>), ASCII gauges and tables. No photography, no illustration, no icons, no mockups. ASCII diagrams that stand for a real system get role="img" and a real aria-label naming what they show.
- TERMINAL WINDOWS: a box-drawing frame with a titlebar line ("demo@logpile — bash — 92×28") in dim above a 1px dim rule, body padded 1.25–2ch, filled with the alternate ground. Windows may go full-width up to 1100px; on mobile they may bleed to 12px from the edges.
- BUTTONS are commands in brackets: "[ $ install logpile ]" — 1px phosphor border, corners at min(var(--radius), 0px) (a tube draws no rounded corners; every element on the page stays square), body mono 0.95–1rem, padding 0.7em 1.3em. Primary = inverse video at rest (phosphor fill, ground text); secondary = outline. Hover and :focus-visible flip the video instantly; keyboard and touch get the identical flip.
- FORMS are prompt dialogues: each field is one line — "> name:" label, then a borderless input on a 1px dim baseline that turns phosphor on focus-within; caret-color phosphor; PHONE FIRST (type="tel" before email). Submit is "[ send ⏎ ]". Success is honest printed output in an aria-live region: "queued · msg id 7f3a · a human replies < 24h · exit 0" — no modal, no confetti. On valid submit dispatch the "wandit:lead" CustomEvent on document with the visitor's fields flat in detail, and keep one off-canvas decoy input carrying data-wandit-hp that the page's own script never reads, writes or mentions.
- TABLES AND PLANS: box-drawing chrome with flags as rows ("--retention 90d") — never naked default-web bordered tables (that furniture belongs to HYPERTEXTE).
- FAVICON: inline SVG data URI — the prompt glyph and a block cursor in phosphor on ground.

## Page chassis
- FIXED OPENING — LE BOOT: the first viewport is a login. A dim banner line (version, arch, "Last login: …"), the wordmark printed HUGE in VT323 with its bloom, ONE typed line that parks the page's blinking cursor (it stays nowrap — drop it to 0.85–0.9rem below 600px so it never wraps or clips), one ≤68ch paragraph in standard phosphor, two command CTAs (one inverse, one outline), one dim # comment stating the honest offer (price, free tier, no card). Optional at ≥1024px: an aria-hidden ambient tail panel on the right — a framed window of dim log lines with one phosphor line, appending a line every 1.2–1.6s. The machine is alive.
- FIXED CLOSING: the prompt-form dialogue beside the humans' coordinates in # comment register (address, phone, hours), then the logout — "$ logout", "Connection to <host> closed.", small command links (back-to-top, pricing, contact — real in-page anchors), one dim legal line. The page ENDS with an exit, never a sitemap.
- FREE MIDDLE — compose 3–5 from this vocabulary, never two adjacent alike: LE MAN(1) man-page feature section · LE STDOUT stats-as-output · LA GRILLE ASCII framed card grid (2–4 columns) · LE DIFF before/after unified diff · LE PIPE ASCII pipeline diagram · LE --HELP aligned FAQ/detail output. Exactly ONE session scrub per page (showpiece law below).
- RHYTHM: section padding clamp(4.5rem,10vh,8rem); prose containers 68ch; wide sections max 1240px centered with clamp(1rem,4vw,3rem) side padding; grounds alternate per section.
- MOBILE DISCIPLINE: every grid child holding a frame, form or transcript gets min-width:0 (native input intrinsic widths blow grid columns past 390px otherwise); the header's command CTA hides below 720px, keeping the brand plus 2–3 slash-links; corner glyphs sit at -0.3ch and need that inset respected inside the viewport.

## Motion identity (GSAP 3 + ScrollTrigger via cdnjs UMD)
GOVERNING LAW: every hidden state is set via gsap.set, never in CSS; gate all motion on (window.gsap && window.ScrollTrigger && !prefers-reduced-motion). CDN dead = the complete transcript, fully printed.
- The personality is TYPED SEQUENCES: the only eases are "none" and "steps(n)". Nothing slides in from a direction, nothing fades longer than ~120ms, nothing scales, nothing bounces, no parallax. Text TYPES (width in ch, steps(chars), 30–45ms/char) or PRINTS (autoAlpha 0→1 in 10–20ms, the whole line at once).
- ENTRANCES: each section prints top-to-bottom — its lines staggered 50–90ms apart, instant per line, like output scrolling onto a screen. Triggered once around "top 72–78%".
- THE SHOWPIECE — LA SESSION: one pinned terminal window scrubbed over 250–320% of viewport height. Commands type, outputs print in beats, one ASCII gauge fills in steps(20–24) via an onUpdate text render, and the scene ends on "exit 0" (a near-white moment) plus a printed CTA. The transcript content is REAL: actual features, stats and prices, ending on the product's true promise.
- CONTINUOUS MOTION BUDGET: the cursor blink (1s, steps(1)) and, optionally, ONE ambient tail appending a line every 1.2–1.6s (instant, no tween). Nothing else loops.
- HOVER: inverse video, instant, with identical :focus-visible and touch active states.
- REDUCED MOTION: cursor steady (no blink), session unpinned at its final composed frame, all transcripts printed, gauges full. A designed still, never a blank.

## Ban list (the global ban list applies; in addition)
1. Machine-telemetry captions — SYS.STATUS, FILE 001, coordinate readouts — that is CINÉTIQUE's voice; PHOSPHORE speaks commands and man pages, never sensor poetry.
2. Glyph-scramble decoders on links and the two-part difference cursor — CINÉTIQUE's tics.
3. Rotated crossing marquee strips — CINÉTIQUE's.
4. Neon-tube type (inner-bright core + multi-layer colored glow) and electric beam lines — VOLTAGE's; our bloom is one soft shadow, never a tube.
5. Dark glass panels and ANY backdrop-filter blur — VOLTAGE's territory.
6. Pixel-art sprites, 8px-grid art, stepped pixel corners, and game-HUD furniture (health bars, score counters, "PRESS START") — HUITBIT's; our gauges are printed characters inside a transcript, never HUD chrome.
7. Times/system-serif document furniture, blue underlined links, visitor counters, "last updated" lines, naked bordered tables as layout — HYPERTEXTE's.
8. Both phosphors on one page (green + amber), or any third hue.
9. Matrix-style falling glyph rain, "hacking" gibberish, hex dumps as decoration — costume, not content.
10. Border-radius above 0 anywhere; pill buttons; soft-shadow cards.
11. Smooth easing of any kind — power*, back, elastic, bounce — and slow opacity fades.
12. CRT barrel distortion, chromatic aberration, heavy flicker loops — the vignette and scanlines are the entire CRT budget.
13. Proportional type anywhere (tooltips, inputs, footers included), outside the documented Arabic prose rule.
14. Fake transcripts: lorem output, flags the man page never defines, decorative numbers with no unit.

## LES GESTES (moves menu)
1. LE BOOT — the login hero: dim banner line, wordmark prints at 12vw, one line types and parks the page's cursor, CTAs print last. Whole sequence ≤2.4s, then the page is still.
2. LA SESSION — the pinned scrub: 4–6 command/output beats telling the product's story, one gauge fill, ending exit 0 + CTA. THE showpiece type; exactly one per page.
3. LE MAN(1) — features as a man page: NAME / SYNOPSIS / DESCRIPTION / OPTIONS between the canonical header and footer lines ("LOGPILE(1) — User Commands — LOGPILE(1)"), flags left-aligned in a two-column grid, every flag a real feature carrying a human benefit.
4. LE DIFF — before/after as a unified diff: minus-lines dim (the old pain), plus-lines phosphor (life with the product), the @@ hunk header naming the moment ("@@ 03:12, production incident @@").
5. LE STDOUT — stats as command output: a "$ … stats" line, then 3–4 numerals in VT323 at clamp(2.6rem,6vw,5rem) with dim unit captions; one may spend a near-white moment.
6. LA GRILLE ASCII — 2–4 box-framed cards with titles let into the top border; the featured card's titlebar in inverse video. Pricing's natural home.
7. LE PIPE — an ASCII pipeline: 3–5 framed stages joined by ──>, printing left-to-right (stacking vertically on mobile with │ connectors); role="img" with a real label.
8. LE TAIL — an ambient framed log stream, lines appending instantly on a 1.2–1.6s interval; dim except one phosphor line. The page's heartbeat; kill it below 1024px.
9. L'INVERSE — one full-width inverse-video band carrying the single most important claim in ground-on-phosphor, VT323 at clamp(2rem,4.2vw,3.4rem), max-width 22–24ch with balanced wrapping, closed by a steady ground-colored block cursor. Once per page, maximum.
10. LE --HELP — FAQ or plan detail as aligned help output: flag column, description column, dim defaults in brackets.
11. L'EXIT 0 — the honest ending: success states and the footer close with an exit code and "Connection to <host> closed." — the site logs out; it never begs.
Pick 2–3 gestes per build, and invent 1–2 of your own in the same spirit — never play the whole menu on one page.

## Example variations
- UPTIME KIT — monitoring SaaS, green, dense. Hero: no wordmark at first sight — the first viewport is a status command already mid-output, the brand living only in the titlebar. Showpiece: an incident replay session — alert fires, a human acks, the fix lands, the postmortem prints. Middle: stdout → diff → grille. Fastest typing in the family (30ms/char). Mood: on-call calm.
- NIGHTWATCH — security company, amber, dense. Hero: an access-log tail with one DENIED line in inverse video beneath a mid-sized wordmark. Showpiece: a perimeter-audit session ending "0 critical · exit 0" — the near-white spent on the verdict. Middle: man(1) → inverse band → --help. Motion sparse: only commands type, outputs print silently. Mood: watchful, sober.
- PACKETWORKS — telecom/ISP, green, dense. Hero IS a traceroute: hops print one per beat with real latencies, the wordmark small above. Showpiece: LE PIPE as the scrub — the network path assembles hop by hop with ping gauges filling. Middle: stdout → grille of fibre plans with £/mo → diff (the old ISP vs this one). Mood: infrastructure pride.
- FORGE TERMINAL — coding bootcamp, green, airy. Hero: "$ whoami" types; "student — cohort of september" prints; the wordmark below, smaller than the answer. Showpiece: a lesson-zero session in which scroll writes the visitor's first program and runs it — "hello, world" is the near-white moment. Middle: --help of modules → stdout of hiring stats → tail of alumni commits. Mood: encouraging, plain-spoken.
- LEDGERD — fintech product, amber, dense. Hero: a balance query whose one number is the page's only near-white; the wordmark lives in the titlebar. Showpiece: a reconciliation diff scrub — the minus-lines of a messy statement resolve into plus-lines, ending balanced at 0.00. Middle: man(1) of compliance flags → inverse band ("Your auditor can read this website.") → grille. Motion nearly still, typing at 45ms/char. Mood: exact, dry.
- WAITLIST/1 — pre-launch startup, green, airy. The whole page is ONE session: hero, story and signup are a single continuous scrubbed transcript — no section labels, no nav; the prompt form is the final command. Motion: one long typed sequence and nothing else. Mood: confident mystery.
- PATCHDAY — electronics/gadgets shop, green, airy. The shop as a package manager — hero: "$ patchday search handhelds" with results printed as package lines (name, version, £ price). Showpiece: an install session assembling the flagship's spec line by line, gauges as spec bars, closing "installed · exit 0". Middle: grille of categories → diff (repairing your old gear vs this) → stdout. Mood: playful retail.
These show the range. NEVER copy one — remix their moves or invent a new variation in the same spirit.

## Intensity
Three things at 100% or the world fails: (1) MONO DISCIPLINE — one proportional glyph or one rounded corner and the terminal collapses into a themed template; (2) STEPPED MOTION — if anything glides, eases or drifts, the CRT dies; steps() is this world's plaster; (3) THE SESSION WITH REAL CONTENT — the showpiece transcript must use the product's true flags and numbers, because developers smell fake output in one line. The cheap details that separate it from a generated page: the scanline vignette, corner glyphs seated exactly on the frame, the one-cursor budget respected, # comments carrying the wit, man-page header and footer lines, and the exit code at the bottom — a page that logs out instead of begging is the entire personality.`,
	energy: "medium",
	family: "terminal",
	fusesWith: ["huitbit", "gabarit", "iris"],
	id: "phosphore",
	industries: [
		"dev tool",
		"SaaS product",
		"IT services / agency",
		"AI product",
		"startup (pre-launch / waitlist)",
		"coding bootcamp",
		"online courses / e-learning",
		"telecom / ISP",
		"electronics / gadgets",
		"security company",
		"fintech product",
	],
	kind: "website",
	mood: ["nostalgic", "precise", "hacker", "confident"],
	name: "Phosphore",
	preview: {
		accent: "#FFB000",
		fontFamily: "VT323",
		ground: "#050A06",
		ink: "#4AF573",
		sampleWord: "> run_",
	},
	priceFeel: "accessible",
	tagline:
		"Le terminal phosphore : une session CLI qui se construit toute seule.",
};
