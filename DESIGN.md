# Wandit — Style Reference

> Warm parchment tooling with one ember running through it

**Theme:** light (tool chrome) · dark (generated output)

Wandit is an AI website-builder wrapped in a warm, near-achromatic parchment world — cream surfaces, warm beige borders, one variable sans with tight tracking, and full-pill controls, borrowed straight from the Lovable school of quiet interface design. The single divergence, and the whole personality of the brand, is **ember**: a warm terracotta-orange that Lovable would keep locked inside a decorative hero, but Wandit lets loose on the primary action, selected states, focus rings, progress bars, and a soft prismatic horizon behind the header. The system runs in two layers: the _tool chrome_ is restrained, warm, and text-forward; the _generated page_ previewed inside it is allowed to go bold and dark, rendered in a monospace face with vivid ember gradients. Nothing shouts except the one thing you're meant to click.

## Tokens — Colors

Colors are authored in **oklch** — that is what gives every neutral its consistent warm (yellow-leaning) undertone and keeps the ember in the same tonal family as the surfaces. Hex approximations are provided for portability, but oklch is canonical.

### Surfaces & neutrals (warm parchment)

| Name         | Value     | Token            | Role                                                                                                                                                            |
| ------------ | --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parchment    | `#fcfbf8` | `--wd-parchment` | Page canvas, workspace shell, inner cards on darker parents, the primary background                                                                             |
| Warm Sand    | `#f7f4ed` | `--wd-sand`      | Panel & card surfaces (chat pane, preview pane), elevated containers, summary tiles — one step warmer than canvas                                               |
| Linen Border | `#eceae4` | `--wd-linen`     | Every border — panel outlines, dividers, input strokes, header separators, row hairlines. Warm beige, never cool gray — this is what makes the UI feel non-tech |
| Stone        | `#d4d3d0` | `--wd-stone`     | Browser-dot tint, disabled/empty control rings, pending-state circles                                                                                           |
| Faint Warm   | `#a8a7a3` | `--wd-faint`     | Not-yet / lowest-emphasis list items                                                                                                                            |

### Text (warm charcoal)

| Name     | Value                              | Token         | Role                                                                              |
| -------- | ---------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| Ink      | `oklch(0.24 0.012 55)` ≈ `#211f1c` | `--wd-text`   | Primary text, headings, wordmark, icon fills. A warm near-black, never pure black |
| Ink Soft | `oklch(0.32 0.012 55)` ≈ `#322f2b` | `--wd-text-2` | Completed checklist / secondary body inside cards                                 |
| Dim      | `oklch(0.5 0.015 60)` ≈ `#7d7a73`  | `--wd-muted`  | Secondary text, captions, placeholders, field labels, meta, muted nav             |

### Ember (the Wandit accent)

| Name         | Value                             | Token               | Role                                                                                                                           |
| ------------ | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Ember        | `oklch(0.62 0.16 45)` ≈ `#c06a34` | `--wd-ember`        | Primary action fill (Publish, Continue, Pay), selected chip, numbered step badge, radio/toggle ON, focus ring, progress accent |
| Ember Text   | `oklch(0.55 0.16 45)` ≈ `#a85a28` | `--wd-ember-text`   | Ember-colored text/links on light, credits label, inline "add in Settings"                                                     |
| Ember Strong | `oklch(0.5 0.16 45)` ≈ `#984f20`  | `--wd-ember-strong` | Active settings-nav label                                                                                                      |

### Semantic

| Name    | Value                              | Token          | Role                                                            |
| ------- | ---------------------------------- | -------------- | --------------------------------------------------------------- |
| Success | `oklch(0.62 0.13 155)` ≈ `#3f9d6d` | `--wd-success` | Saved / Live / Available, check-circle fills, status dots       |
| Danger  | `oklch(0.58 0.19 25)` ≈ `#c2472f`  | `--wd-danger`  | Unpublish / take-offline, removed diff marker, destructive zone |

### Gradients

| Name          | Value                                                                                                                                                                                        | Token               | Role                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| Amber → Ember | `linear-gradient(135deg, oklch(0.8 0.15 70), oklch(0.66 0.19 35))`                                                                                                                           | `--wd-grad-ember`   | Logo mark, AI avatar, send button, success/progress badges, progress-bar fill           |
| Deep Ember    | `linear-gradient(135deg, oklch(0.7 0.19 38), oklch(0.5 0.13 30))`                                                                                                                            | `--wd-grad-deep`    | Version thumbnails (v-tiles)                                                            |
| Warm Horizon  | `linear-gradient(90deg, oklch(0.3 0.03 50) 0%, oklch(0.33 0.06 45) 26%, oklch(0.8 0.15 70) 40%, oklch(0.74 0.18 55) 48%, oklch(0.68 0.19 40) 56%, oklch(0.62 0.16 32) 62%, transparent 73%)` | `--wd-grad-horizon` | Ambient prismatic band behind the app header — masked to fade downward. Decorative only |

### Generated-output palette (dark layer, for the previewed page only)

| Name        | Value                                         | Role                                                    |
| ----------- | --------------------------------------------- | ------------------------------------------------------- |
| Void        | `oklch(0.14 0.01 45)` / `oklch(0.1 0.008 40)` | Dark screen background of the generated page            |
| Vivid Ember | `oklch(0.84 0.14 75)` → `oklch(0.7 0.19 38)`  | Generated-page CTAs, size-picker highlight, glow washes |

## Tokens — Typography

### DM Sans — the interface typeface

The entire tool chrome is set in **DM Sans** (a variable sans standing in for Lovable's "Camera Plain Variable"). It carries everything from 12px meta labels to 48px display headings; hierarchy comes from _weight and scale_, not from a second family. Two rules are global and non-negotiable: **letter-spacing `-0.025em` at every size** (tight tracking is a defining trait) and **`font-feature-settings: 'liga' 0`** (ligatures off, keeping letterforms mechanical). Weight 500 — not bold — is the "confident heading" weight; 600 is reserved for the wordmark, prices, and domain names.

- **Substitute:** Inter Variable or Camera Plain Variable
- **Weights:** 400 (body), 500 (headings, labels, emphasis), 600 (wordmark, numerals, domain strings)
- **Tracking:** `-0.025em` everywhere (≈ -0.4px at 16px, -1.2px at 48px)
- **OpenType:** `"liga" 0`
- **Token:** `--wd-font-sans`

### Geist Mono — the companion / output face

Monospace, used deliberately and sparingly: the **generated page's** content (headline, countdown, prices), DZD amounts and technical strings, and uppercase micro-labels. Micro-labels flip the tracking _positive_ (`0.06`–`0.14em`) and go uppercase — the one place the type opens up instead of tightening.

- **Substitute:** Geist Mono, ui-monospace
- **Weights:** 400, 500
- **Token:** `--wd-font-mono`

### Type Scale

| Role                                  | Size      | Line height | Tracking     | Weight          |
| ------------------------------------- | --------- | ----------- | ------------ | --------------- |
| display (option/section title)        | 48px      | 1.1         | -1.2px       | 500             |
| section title (Settings)              | 20px      | 1.25        | -0.5px       | 500             |
| panel title (modal/panel/step header) | 16–18px   | 1.2         | -0.4px       | 600             |
| subheading (lede paragraph)           | 18px      | 1.5         | -0.45px      | 400             |
| body                                  | 14–15px   | 1.45–1.55   | -0.025em     | 400             |
| body-strong / control label           | 13.5–14px | 1.4         | -0.025em     | 500             |
| caption / meta                        | 12.5–13px | 1.45        | -0.025em     | 400             |
| field label / micro                   | 12–12.5px | 1.4         | -0.025em     | 400             |
| mono micro-label                      | 8.5–11px  | 1.2         | +0.10–0.14em | 500 (uppercase) |

## Tokens — Spacing & Shapes

**Density:** compact — tight vertical rhythm, generous interior padding. Small element gaps (6–12px), medium panel padding (16–22px).

### Spacing Scale

| Token           | Value | Typical use                          |
| --------------- | ----- | ------------------------------------ |
| `--wd-space-2`  | 2px   | Segmented-toggle inner gap           |
| `--wd-space-3`  | 3px   | Segmented-toggle padding             |
| `--wd-space-6`  | 6px   | Chip/tab gaps, icon gaps             |
| `--wd-space-8`  | 8px   | Button-cluster gap, share-row gap    |
| `--wd-space-9`  | 9px   | Row-content gap, footer button gap   |
| `--wd-space-12` | 12px  | Tray gap & padding, list gaps        |
| `--wd-space-14` | 14px  | Card padding                         |
| `--wd-space-16` | 16px  | Panel body padding, composer padding |
| `--wd-space-18` | 18px  | Panel body / step-card padding       |
| `--wd-space-20` | 20px  | Panel body gap, legend spacing       |
| `--wd-space-24` | 24px  | Card grid gap, section legend margin |

### Border Radius

| Element                                                                       | Value                 | Token                  |
| ----------------------------------------------------------------------------- | --------------------- | ---------------------- |
| Pills — buttons, badges, chips, toggles, tabs, credits, icon-buttons, avatars | 9999px                | `--wd-radius-pill`     |
| Workspace shell & large panels                                                | 20–22px               | `--wd-radius-panel`    |
| Composer (chat input card)                                                    | 24px                  | `--wd-radius-composer` |
| Cards & rows (inner)                                                          | 13–16px               | `--wd-radius-card`     |
| Message bubble                                                                | 18px (one 6px corner) | `--wd-radius-bubble`   |
| Inputs, summary tiles                                                         | 10–11px               | `--wd-radius-input`    |
| Version thumbnail tiles                                                       | 11–12px               | `--wd-radius-tile`     |
| Phone bezel / screen                                                          | 36–38px / 30–31px     | —                      |

### Shadows & Elevation

| Name           | Value                                                                                               | Token                  | Use                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Shell          | `0 30px 70px -35px rgba(0,0,0,0.25)`                                                                | `--wd-shadow-shell`    | The rounded workspace container floating on the canvas                       |
| Card           | `oklab(0 0 0 / 0.06) 0 0 0 1px, rgba(0,0,0,0.10) 0 22px 40px -20px`                                 | `--wd-shadow-card`     | Free-floating step / flow cards                                              |
| Composer       | `oklab(0 0 0 / 0.08) 0 0 0 1px, rgba(0,0,0,0.10) 0 18px 24px -6px, rgba(0,0,0,0.10) 0 6px 8px -6px` | `--wd-shadow-composer` | The chat input card — the one richly-shadowed surface, straight from Lovable |
| Panel          | `-28px 0 60px -30px rgba(0,0,0,0.35)`                                                               | `--wd-shadow-panel`    | Right-anchored slide-in panel                                                |
| Modal          | `0 40px 90px -25px rgba(0,0,0,0.5)`                                                                 | `--wd-shadow-modal`    | Centered dialog                                                              |
| Selected inset | `inset 0 0 0 0.5px rgba(0,0,0,0.16)`                                                                | `--wd-shadow-inset`    | Selected segment in a segmented toggle                                       |
| Focus ring     | `0 0 0 3px oklch(0.62 0.16 45 / 0.1)`                                                               | `--wd-ring`            | Focused input / active search field                                          |
| Press glow     | `0 0 0 3px oklch(0.62 0.16 45 / 0.22)`                                                              | `--wd-glow`            | Emphasised Publish button                                                    |
| Status halo    | `0 0 0 3px oklch(0.62 0.13 155 / 0.18)`                                                             | —                      | The green "live" dot                                                         |

### Overlay scrims

| Name        | Value                                                        | Use                                                |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Panel scrim | `oklch(0.3 0.02 55 / 0.28)` + `backdrop-filter: blur(1.5px)` | Behind a slide-in panel                            |
| Modal scrim | `oklch(0.28 0.02 55 / 0.44)` + `backdrop-filter: blur(2px)`  | Behind a centered modal — warm-tinted, never black |

### Layout

- **Workspace shell:** ~1340px wide, 20px radius, 1px linen border on parchment
- **Two-pane tray:** 12px padding, 12px gap. Chat pane fixed **430px**; preview pane flexes
- **Header bars:** app header 52px · panel/card header 56px · pane header 48px · faux browser bar 38px
- **Flow / step cards:** 412px wide (fixed), laid out in a wrapping 24px-gap row
- **Slide-in panel:** 416px · **Modal:** 560px · **Settings left-nav:** 212px

## Components

### Workspace Shell

**Role:** The frame everything lives in
A 20px-radius parchment container with `--wd-shadow-shell`, stacked vertically: a **faux browser bar** (sand, three stone dots, a centered pill showing the URL) → an **app zone** that hosts the ambient warm horizon behind → a **two-pane tray**. `overflow:hidden` clips the horizon to the rounded corners.

### App Header (Top Bar)

**Role:** Persistent workspace navigation
52px tall, translucent parchment `rgba(252,251,248,0.72)` with `backdrop-filter: blur(8px)` and a 1px linen bottom border, floating over the warm horizon. Left: 26px ember-gradient logo mark (spark glyph) + `wandit` wordmark (18px/600) + hairline divider + **project switcher pill**. Right cluster: **Saved** status (green dot + muted text), **credits pill**, **Publish button**, 28px charcoal avatar.

### Publish Button (Primary Action)

**Role:** The one colored call-to-action
Solid **ember** fill, parchment text, full pill, 7px 16px, 500 weight. Optionally wrapped in the ember press-glow ring. This is Wandit's defining divergence from Lovable: the primary action _is_ colored. Every primary button in flows (Continue, Pay, Publish changes) repeats this exact treatment; icon + label centered.

### Outlined / Ghost Pill Button

**Role:** Secondary and tertiary actions
Transparent background, 1px linen border, ink text, full pill (Change, Restore, Cancel, Discard). Icon-buttons are 30px circles with a linen border (or fully transparent for in-header controls), muted-to-ink icon color. Micro-interactions transition color/background/border only.

### Project Switcher Pill

**Role:** Current project selector in the header
Translucent parchment, 1px linen border, full pill: an 8px charcoal dot + project name (14px/500) + a 50%-opacity chevron.

### Credits Pill

**Role:** Balance indicator
Full pill, **no fill**, ember-tinted border `oklch(0.62 0.16 45 / 0.35)`, ember-text label (e.g. "128 credits"). The one place ember appears as an outline rather than a fill.

### Two-Pane Split (Chat + Preview)

**Role:** The core working surface
Two sand cards (`#f7f4ed`, 20px radius, 1px linen) with 12px gap inside a 12px-padded tray. Chat pane is a fixed 430px column; preview pane flexes. Each opens with a 48px header row (label + context, bottom border) over a scrolling body.

### Chat Message Bubbles

**Role:** The conversation thread
**User** messages right-align in a tinted bubble `oklch(0.94 0.008 80)` with a 1px linen border and asymmetric radius `18px 18px 6px 18px`. **Wandit** messages left-align with no bubble: a 22px ember-gradient avatar + "Wandit" label (14px/500) + optional right-aligned timestamp, then plain paragraph text at 14.5px/1.55 on the canvas.

### Suggestion Chips

**Role:** Inline quick-reply / option chips
Full pills, 7px 13px, 13px. **Selected** = ember fill + parchment text. **Default** = transparent + 1px linen border + ink text. Wrap in a 7px-gap row.

### Segmented Toggle

**Role:** Compact mode/tab switcher (Hype·Minimal·Street, Page·Assets·Leads, viewport, Buy new·Own)
A pill container (sand fill, 1px linen, 3px padding, 2–3px gap). The active segment gets a parchment fill + `--wd-shadow-inset` + ink text (500); inactive segments are muted, no background.

### Build / Progress Panel

**Role:** Live generation status inside chat
Inner card (canvas, 16px radius, 1px linen). Header: title (14px/500) + percent (muted). A 4px ember-gradient progress track. Then a checklist: **done** = ember-filled check-circle + ink-soft text; **active** = spinning ember arc + ink text + a blinking caret bar; **pending** = stone ring + faint text.

### Version Card

**Role:** A saved build/version reference
Row on canvas (13–16px radius, 1px linen). A 40px deep-ember gradient thumbnail tile with a "v3" label + title (14px/500) + subtitle (muted) + a status pill on the right (ember-outline "Current" or green "Live"). Whole row is clickable.

### Composer (Chat Input Card)

**Role:** Where the user types to Wandit
The signature elevated surface: 24px radius, canvas, `--wd-shadow-composer`. Placeholder text ("Ask Wandit to change something…"), then a control row: a 30px "+" icon-button (linen), a "Build" dropdown pill, a muted credits count, and a **send button** — a 30px circle filled with the amber→ember gradient and a small drop shadow.

### Preview Toolbar

**Role:** Controls above the live preview
Segmented tabs on the left (Page/Assets/Marketing/Leads/Settings), then on the right a version dropdown pill, a viewport segmented toggle (desktop/mobile icons), and refresh + open-external icon-buttons.

### Phone Mockup / Generated Page (dark layer)

**Role:** The user's output, previewed
A dark device (bezel `#0a0a0c`, 36–38px radius, deep drop shadow) with a notch pill and a dark screen `oklch(0.14 0.01 45)`. Its content is the **only place the system goes dark and mono**: Geist Mono headline, radial ember glow washes, countdown tiles, an EU size picker (selected size = vivid-ember outline + tint; sold-out = strikethrough), a DZD price, and a full-width CTA in the vivid-ember gradient. Treat this layer as free to be bold — it is the product, not the chrome.

### Step Card (Flow Panel)

**Role:** One screen of a multi-step flow (publish, buy domain, provisioning)
412×726 floating card, 22px radius, 1px linen, `--wd-shadow-card`. **Header** (56px): a 24px ember numbered badge + title (15.5px/600) + close icon-button, bottom border. **Body**: scrollable, 18px padding. **Footer**: top border, one primary (ember) button, optionally a secondary/ghost button beside it, plus a centered muted helper line.

### Slide-in Panel

**Role:** In-context flow that keeps the workspace visible
Right-anchored, 416px, `border-left: 1px solid linen`, `--wd-shadow-panel`, sitting over the **panel scrim**. Same header/body/footer anatomy as the step card. Header shows an ember publish glyph + title + "· Project" context.

### Centered Modal

**Role:** A single focused decision
560px, 22px radius, `--wd-shadow-modal`, centered over the **modal scrim** (warm-tinted + blur). Same internal anatomy; use when the flow is one clear choice at a time.

### Status / Checklist Row

**Role:** Progress steps in publish & provisioning screens
Icon + label at 14px. Icon states: **done** = green check-circle fill; **active** = spinning ember arc (ink label, 500); **pending** = stone ring (faint label).

### Domain Result Row

**Role:** A purchasable domain in search results
Row (13px radius, 1px linen). Name in ink (600) with a muted TLD, an optional badge (**Recommended** = ember fill; **deal** = ember outline; **Taken** = sand pill with strikethrough + 0.62 opacity), a right-aligned price (`2 400 DA`, 600) with an "≈ $18" muted line, and a radio (ember-fill check when selected, stone ring otherwise). The **selected** row gets an ember-tinted background + 1.5px ember border.

### Form Field

**Role:** Text / select inputs (registrant details, payment)
A muted 12.5px label above a field: 10–11px radius, canvas fill, 1px linen border, 14px ink value. Select fields append a 50%-opacity chevron. **Focus** = ember border + `--wd-ring`. Composite fields (card entry) stack multiple cells inside one 10px rounded, linen-bordered container divided by linen hairlines — Stripe-style.

### Toggle Switch

**Role:** Boolean setting (auto-renew, re-inject pixels, primary domain)
40×23px pill. **On** = ember fill with an 18px white knob to the right. **Off** = stone/linen with knob left.

### Info / Note Row

**Role:** Inline reassurance or hint
A small circled-"i" (or lock) icon in ember + muted text at 12.5px/1.5, left-aligned, icon flush to the top. A **success** variant tints the whole row green (`/0.06` bg, `/0.3` border) for privacy/security notes.

### Diff List

**Role:** "What changed since you published"
A sand-filled card (16px radius, 1px linen, 6px padding) of change rows separated by linen hairlines. Each row leads with a colored sign in a fixed 16px column: **+** green (added), **~** ember (changed), **−** danger (removed), then the change text; a muted "+N more" closes the list.

### Status Badge

**Role:** Live-state indicator
A pill with a leading dot. **Live** = green fill + parchment text + white dot. **Saved** = green outline. **Current** = ember outline. Always small (11–12px).

### Danger Zone

**Role:** Destructive actions (take offline / unpublish)
A card tinted with danger: `oklch(0.58 0.19 25 / 0.3)` border on `/0.04` background, a danger-colored title, muted explanation, and a full-pill **outlined danger** button (danger border + text, transparent fill).

### Settings — Manage Layout

**Role:** The persistent home for publish status & domains
A 212px left-nav (border-right) of nav rows (10px radius, icon + label). The **active** row = ember-tint background `/0.1` + ember-strong text (500). Content area uses 20px/500 section titles with a muted sub-line, then the cards above (status, version history, domain list).

## Do's and Don'ts

### Do

- Reserve **ember** for meaning: the primary action, the current selection, focus, and progress. One warm accent, used decisively — that restraint is the brand.
- Keep every neutral **warm**: `#fcfbf8` canvas, `#f7f4ed` surfaces, `#eceae4` borders. Author colors in oklch so the whole palette shares one undertone.
- Use **9999px** for all buttons, badges, chips, toggles, tabs, and avatars — the full pill is the signature interactive shape.
- Apply **-0.025em tracking** and **`liga` 0** to all DM Sans, at every size.
- Build hierarchy from **weight 400 → 500 → 600** and scale alone, not from a second font or from color.
- Let the **generated preview** go dark, mono, and bold — the output is allowed a completely different energy from the chrome that frames it.
- Keep cards **flat**: one warm border, no shadow — except the **composer**, the single richly-shadowed surface.
- Show money in **DZD first** (`2 400 DA`) with a muted `≈ $` line beneath.

### Don't

- Never use **cool gray** (`#e5e7eb`, `#6b7280`) — it breaks the parchment warmth instantly.
- Never give a secondary button an ember fill — secondary is transparent + linen border. Only one ember action per view.
- Never spread the **warm-horizon gradient** onto buttons, badges, or icons — it is an ambient background only (the send button's gradient is its one licensed cameo).
- Never use **pure black** for text or **black scrims** for overlays — text is warm charcoal, scrims are warm-tinted + blurred.
- Never use **sharp corners** on interactive elements; even tiny tiles get 10–12px.
- Never introduce a **third typeface** — DM Sans and Geist Mono cover everything.
- Never let the tool chrome adopt the generated page's dark/mono treatment (or vice-versa) — the two layers must stay legibly distinct.

## Surfaces

| Level | Name          | Value                  | Purpose                                                                |
| ----- | ------------- | ---------------------- | ---------------------------------------------------------------------- |
| 0     | Canvas        | `#fcfbf8`              | Workspace background, inner cards, composer, phone screen frame        |
| 1     | Card          | `#f7f4ed`              | Chat & preview panes, summary tiles, segmented-toggle track, note rows |
| 2     | Inverse       | `oklch(0.24 0.012 55)` | Avatar circle, inverse chips                                           |
| —     | Output (dark) | `oklch(0.14 0.01 45)`  | The generated page inside the phone — a separate world                 |

## Elevation

- **Workspace shell:** `0 30px 70px -35px rgba(0,0,0,0.25)`
- **Flow / step card:** `oklab(0 0 0 / 0.06) 0 0 0 1px, rgba(0,0,0,0.10) 0 22px 40px -20px`
- **Composer (chat input):** `oklab(0 0 0 / 0.08) 0 0 0 1px, rgba(0,0,0,0.10) 0 18px 24px -6px, rgba(0,0,0,0.10) 0 6px 8px -6px`
- **Slide-in panel:** `-28px 0 60px -30px rgba(0,0,0,0.35)`
- **Modal:** `0 40px 90px -25px rgba(0,0,0,0.5)`
- **Phone device:** `0 40px 80px -30px rgba(0,0,0,0.4)`
- **Selected segment (inset):** `inset 0 0 0 0.5px rgba(0,0,0,0.16)`

## Imagery

The tool chrome is almost entirely **type and warm surfaces** — no photography, no illustration, no decorative icons. The single atmospheric moment is the **warm prismatic horizon**: a masked gradient band that bleeds behind the translucent app header, echoing Lovable's hero but recolored to Wandit's amber-through-ember range and fading to parchment before it reaches content. Icons are **thin outlined** (~1.6–1.9px stroke), monochrome in ink or dim; status icons (check / spinner / empty) use the semantic fills. QR codes render as crisp pixel SVG in ink on parchment. The **only rich imagery** is inside the previewed page — full-color product art, noise textures, glow washes — because that content belongs to the user's brand, not Wandit's. Flags, card-brand marks (Visa/Mastercard), and payment logos appear literally where a real flow needs them.

## Layout

The screen is a single **~1340px workspace shell** floating on the parchment canvas, its corners rounded and clipped. Inside, a faux browser bar tops an app zone whose **52px translucent header** sits over the ambient horizon. Below, a **12px-padded two-pane tray**: a fixed 430px chat column beside a flexible preview column, both sand cards. Multi-step flows render either as **412px step cards** wrapping in a 24px-gap row (for showing a whole journey at once), as a **416px right slide-in panel** over a blur scrim (to keep the workspace in view), or as a **560px centered modal** over a dimmed scrim (for one focused decision). The Settings surface swaps the tray for a **212px left-nav + content** layout. Vertical rhythm is compact; horizontal padding is generous — quiet space inside small containers.

## Agent Prompt Guide

**Quick Color Reference**

- text (primary): `oklch(0.24 0.012 55)` ≈ #211f1c
- text (secondary): `oklch(0.5 0.015 60)` ≈ #7d7a73
- background (canvas): #fcfbf8
- background (card): #f7f4ed
- border: #eceae4
- primary action / accent: `oklch(0.62 0.16 45)` ≈ #c06a34 (ember)
- success: `oklch(0.62 0.13 155)` · danger: `oklch(0.58 0.19 25)`
- mono/output accent: `oklch(0.84 0.14 75)` → `oklch(0.7 0.19 38)`

**Example Component Prompts**

1. **Workspace shell** — A 1340px, 20px-radius `#fcfbf8` container, `overflow:hidden`, shadow `0 30px 70px -35px rgba(0,0,0,0.25)`. Top: a 38px `#f7f4ed` browser bar with three `#d4d3d0` dots and a centered pill URL. Then an app zone with a masked warm-horizon gradient behind a 52px translucent header (`rgba(252,251,248,0.72)`, `backdrop-filter: blur(8px)`, 1px `#eceae4` bottom border).

2. **App header + Publish** — Left: 26px ember-gradient (`linear-gradient(135deg, oklch(0.8 0.15 70), oklch(0.66 0.19 35))`) logo circle, `wandit` wordmark 18px/600, hairline divider, project-switcher pill (dot + name/500 + chevron). Right: "Saved" (green dot + muted text), a credits pill (ember-outline `oklch(0.62 0.16 45 / 0.35)`, ember text), a **Publish** button (solid `oklch(0.62 0.16 45)`, `#fcfbf8` text, 9999px, 7px 16px, 500), a 28px charcoal avatar.

3. **Chat + composer** — Sand card (`#f7f4ed`, 20px radius, 1px `#eceae4`). User bubbles right-aligned, `oklch(0.94 0.008 80)` + linen border, radius `18px 18px 6px 18px`. Wandit replies: 22px ember-gradient avatar + "Wandit" 14px/500 + plain body text. Composer at the bottom: 24px radius `#fcfbf8` card, shadow `oklab(0 0 0 / 0.08) 0 0 0 1px, rgba(0,0,0,0.10) 0 18px 24px -6px, rgba(0,0,0,0.10) 0 6px 8px -6px`, placeholder, then + button, Build dropdown pill, credits, and a 30px ember-gradient send circle. All text `-0.025em`, `"liga" 0`.

4. **Flow step card** — 412px card, 22px radius, `#fcfbf8`, 1px `#eceae4`, shadow `oklab(0 0 0 / 0.06) 0 0 0 1px, rgba(0,0,0,0.10) 0 22px 40px -20px`. Header (56px): 24px ember numbered badge + title 15.5px/600 + close icon-button. Body scrolls. Footer (top border): full-width ember primary button + optional ghost button + muted helper line. Render as a right slide-in (416px, `border-left`, panel shadow, over `oklch(0.3 0.02 55 / 0.28)` blur scrim) or a 560px centered modal over `oklch(0.28 0.02 55 / 0.44)` blur scrim.

5. **Domain result list** — Rows at 13px radius. Each: domain name in ink/600 with a muted `.tld`, optional badge (Recommended = ember fill; deal = ember outline; Taken = sand pill + strikethrough + 0.62 opacity), a right price `2 400 DA` (600) over "≈ $18" muted, and a radio (ember-fill check / stone ring). Selected row: ember-tinted background + 1.5px ember border.

## Gradient System

Wandit uses **one gradient family**, all in the amber→ember range (oklch hues 30–75). It appears in exactly four sanctioned roles: (1) the **warm horizon** — a masked, full-width `90deg` band behind the app header, ambient only; (2) the **amber→ember 135° gradient** on brand touchpoints — logo, AI avatar, send button, success/progress badges, and progress-bar fills; (3) the **deep-ember 135° gradient** on version thumbnail tiles; and (4) **vivid-ember gradients** on the generated page's CTAs. Everywhere else the interface is flat warm neutral with the solid ember accent. Never place a gradient on a text button, a chip, a badge, or an input — the gradient signals "brand surface," while the solid ember signals "action."

## Motion & Transitions

Micro-interactions transition **color, background-color, border-color, and fill together at 0.15s ease** — hover on nav links, buttons, icons, chips. Named animations, all warm and functional rather than flashy: **spin** (0.9–1.1s linear) on ring loaders and the "building" spark; **pulse** (1.6s ease-in-out) on active progress-bar fills; **caret** (1s step-end) on the blinking text cursor in inputs and the "typing" state; **bounce** on typing-indicator dots; **glow** (ember box-shadow pulse) to draw the eye to the primary action; **shimmer** for skeleton loads. Deliberate UI movement uses `cubic-bezier(0.4, 0, 0.2, 1)`. The personality: calm and continuous in the chrome, with energy concentrated on the one thing being generated or the one action to take.

## Similar Brands

- **Lovable** — the direct ancestor: warm parchment canvas, one variable sans with tight tracking, full-pill controls, color reserved for a single moment. Wandit keeps the world and lets the color out onto the action.
- **Vercel** — warm near-black on cream, single custom sans, pill buttons, gradient used only as a decorative moment.
- **Linear** — one typeface system with negative tracking, achromatic controls, color as a single ambient accent rather than distributed everywhere.
- **Cursor / v0** — AI builder with the input as the hero interaction, warm neutral surfaces, pill buttons, mono for generated/technical content.
- **Raycast** — command-style input, single family across all scales, warm cream tones instead of cool gray.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Surfaces & neutrals */
  --wd-parchment: #fcfbf8;
  --wd-sand: #f7f4ed;
  --wd-linen: #eceae4;
  --wd-stone: #d4d3d0;
  --wd-faint: #a8a7a3;

  /* Text (warm charcoal) */
  --wd-text: oklch(0.24 0.012 55);
  --wd-text-2: oklch(0.32 0.012 55);
  --wd-muted: oklch(0.5 0.015 60);

  /* Ember accent */
  --wd-ember: oklch(0.62 0.16 45);
  --wd-ember-text: oklch(0.55 0.16 45);
  --wd-ember-strong: oklch(0.5 0.16 45);

  /* Semantic */
  --wd-success: oklch(0.62 0.13 155);
  --wd-danger: oklch(0.58 0.19 25);

  /* Gradients */
  --wd-grad-ember: linear-gradient(
    135deg,
    oklch(0.8 0.15 70),
    oklch(0.66 0.19 35)
  );
  --wd-grad-deep: linear-gradient(
    135deg,
    oklch(0.7 0.19 38),
    oklch(0.5 0.13 30)
  );
  --wd-grad-horizon: linear-gradient(
    90deg,
    oklch(0.3 0.03 50) 0%,
    oklch(0.33 0.06 45) 26%,
    oklch(0.8 0.15 70) 40%,
    oklch(0.74 0.18 55) 48%,
    oklch(0.68 0.19 40) 56%,
    oklch(0.62 0.16 32) 62%,
    transparent 73%
  );

  /* Generated-output (dark layer) */
  --wd-void: oklch(0.14 0.01 45);
  --wd-grad-cta: linear-gradient(
    135deg,
    oklch(0.84 0.14 75),
    oklch(0.7 0.19 38)
  );

  /* Typography */
  --wd-font-sans:
    "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    sans-serif;
  --wd-font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --wd-tracking: -0.025em; /* apply globally */
  /* also set: font-feature-settings: 'liga' 0; */

  /* Radius */
  --wd-radius-pill: 9999px;
  --wd-radius-panel: 20px;
  --wd-radius-composer: 24px;
  --wd-radius-card: 16px;
  --wd-radius-bubble: 18px;
  --wd-radius-input: 11px;
  --wd-radius-tile: 12px;

  /* Shadows */
  --wd-shadow-shell: 0 30px 70px -35px rgba(0, 0, 0, 0.25);
  --wd-shadow-card:
    oklab(0 0 0 / 0.06) 0 0 0 1px, rgba(0, 0, 0, 0.1) 0 22px 40px -20px;
  --wd-shadow-composer:
    oklab(0 0 0 / 0.08) 0 0 0 1px, rgba(0, 0, 0, 0.1) 0 18px 24px -6px,
    rgba(0, 0, 0, 0.1) 0 6px 8px -6px;
  --wd-shadow-panel: -28px 0 60px -30px rgba(0, 0, 0, 0.35);
  --wd-shadow-modal: 0 40px 90px -25px rgba(0, 0, 0, 0.5);
  --wd-shadow-inset: inset 0 0 0 0.5px rgba(0, 0, 0, 0.16);
  --wd-ring: 0 0 0 3px oklch(0.62 0.16 45 / 0.1);
  --wd-glow: 0 0 0 3px oklch(0.62 0.16 45 / 0.22);

  /* Overlay scrims (warm-tinted, never black) */
  --wd-scrim-panel: oklch(0.3 0.02 55 / 0.28); /* + blur(1.5px) */
  --wd-scrim-modal: oklch(0.28 0.02 55 / 0.44); /* + blur(2px)   */

  /* Header translucency */
  --wd-header-bg: rgba(252, 251, 248, 0.72); /* + backdrop-filter: blur(8px) */
}

/* Global type defaults */
body {
  font-family: var(--wd-font-sans);
  letter-spacing: var(--wd-tracking);
  font-feature-settings: "liga" 0;
  color: var(--wd-text);
  background: var(--wd-parchment);
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-parchment: #fcfbf8;
  --color-sand: #f7f4ed;
  --color-linen: #eceae4;
  --color-stone: #d4d3d0;
  --color-faint: #a8a7a3;
  --color-ink: oklch(0.24 0.012 55);
  --color-ink-soft: oklch(0.32 0.012 55);
  --color-muted: oklch(0.5 0.015 60);
  --color-ember: oklch(0.62 0.16 45);
  --color-ember-text: oklch(0.55 0.16 45);
  --color-ember-strong: oklch(0.5 0.16 45);
  --color-success: oklch(0.62 0.13 155);
  --color-danger: oklch(0.58 0.19 25);
  --color-void: oklch(0.14 0.01 45);

  /* Fonts */
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;

  /* Radius */
  --radius-pill: 9999px;
  --radius-panel: 20px;
  --radius-composer: 24px;
  --radius-card: 16px;
  --radius-input: 11px;

  /* Shadows */
  --shadow-shell: 0 30px 70px -35px rgb(0 0 0 / 0.25);
  --shadow-card:
    0 0 0 1px oklab(0 0 0 / 0.06), 0 22px 40px -20px rgb(0 0 0 / 0.1);
  --shadow-composer:
    0 0 0 1px oklab(0 0 0 / 0.08), 0 18px 24px -6px rgb(0 0 0 / 0.1),
    0 6px 8px -6px rgb(0 0 0 / 0.1);
  --shadow-panel: -28px 0 60px -30px rgb(0 0 0 / 0.35);
  --shadow-modal: 0 40px 90px -25px rgb(0 0 0 / 0.5);
}

/* Remember: letter-spacing -0.025em and font-feature-settings 'liga' 0 globally. */
```

### Google Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Geist+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```
