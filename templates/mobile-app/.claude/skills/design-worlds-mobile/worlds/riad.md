# Riad — a cool courtyard behind a carved door

`riad` · medium · light and dark · best for: hotel, guesthouse, riad, travel agency, tours,
real estate, holiday rentals, heritage brand · avoid for: gym, kids, finance, clinic, nightlife

## 1. Feel

Lime plaster warm from the sun, terracotta tiles, a deep blue door under a brass lantern. You
leave the street and step into a quiet courtyard. Every picture sits in an arch, like a view
through a doorway. A band of eight-point stars runs along the wall. By day: sand and ink.
By night: indigo, and the brass glows.

Voice: a good host. Calm, courteous, exact: "Your stay", "Arrive from 3 pm" (real data only).
No exclamation marks, no emoji, no "exotic", no "magical".

## 2. World law and client choices

World law, the same in every Riad app:

- Sand ground, deep blue ink, one terracotta accent. Brass draws lines and stars only.
- Marcellus for display text, names, and big numbers (the `display`, `title`, and `carved`
  roles). Work Sans for all other text.
- Square plaster, round arches: `--radius: 0.375rem` (cards 18 px, fields 10.5 px). A photo
  is never square: it sits in an arch (`rounded-t-full`).
- Three signatures: the arch frame, the star band, the ornamental divider (section 5).
- `"userInterfaceStyle": "automatic"`. Dark mode is the indigo night, never grey.

Client choices, decided fresh for each app: the welcome (W1, W2, W3), the home (H1, H2), the
lead number (upcoming stays, nights booked, tours this week), and the photo subject.
Two Riad apps never share the same welcome and home composition.

## 3. Tokens

Keep the imports and the hero `@theme static` color block of the template. Replace the rest:

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.375rem;
}

@theme static {
	--font-normal: "WorkSans_400Regular";
	--font-medium: "WorkSans_500Medium";
	--font-semibold: "WorkSans_600SemiBold";
	--font-bold: "WorkSans_700Bold";
	--font-display: "Marcellus_400Regular";
}

/* Brass: lines and stars only. It is below 4.5:1 on sand, so never text. */
@theme static {
	--color-brass: var(--brass);
}

@layer theme {
	:root {
		@variant light {
			--background: #f4ecdf;
			--foreground: #1b2340;
			--surface: #fbf6ee;
			--surface-foreground: #1b2340;
			--surface-secondary: #efe4d2;
			--surface-tertiary: #e6d7c0;
			--overlay: #fbf6ee;
			--muted: #6e5e4e;
			--accent: #ae4e27;
			--accent-foreground: #fff8ef;
			--default: #eadfcc;
			--default-foreground: #1b2340;
			--border: #1b234017;
			--separator: #1b234012;
			--field-background: #fbf6ee;
			--field-border: #1b23402e;
			--field-placeholder: #8e8273;
			--color-default-hover: #e2d4bd;
			--success: #2f7a55;
			--success-foreground: #ffffff;
			--warning: #d99a2b;
			--warning-foreground: #1b2340;
			--danger: #a8243e;
			--danger-foreground: #ffffff;
			--segment: #fffdf8;
			--segment-foreground: #1b2340;
			--focus: #ae4e27;
			--hero-start: #26336e;
			--hero-end: #141a38;
			--hero-foreground: #f6ebdd;
			--surface-shadow: 0 10px 24px -14px rgba(27, 35, 64, 0.22);
			--overlay-shadow: 0 12px 32px -12px rgba(27, 35, 64, 0.28);
			--field-shadow: 0 0 0 0 transparent inset;
			--brass: #a57a35;
		}

		@variant dark {
			--background: #10142a;
			--foreground: #f2e8d8;
			--surface: #181d38;
			--surface-foreground: #f2e8d8;
			--surface-secondary: #1f2546;
			--surface-tertiary: #283055;
			--overlay: #1b2140;
			--muted: #a9a291;
			--accent: #e07a4f;
			--accent-foreground: #10142a;
			--default: #232a4d;
			--default-foreground: #f2e8d8;
			--border: #f2e8d81a;
			--separator: #f2e8d812;
			--field-background: #181d38;
			--field-border: #f2e8d82e;
			--field-placeholder: #8a8576;
			--color-default-hover: #2c3459;
			--success: #5fc28f;
			--success-foreground: #10142a;
			--warning: #e8b04a;
			--warning-foreground: #10142a;
			--danger: #f2727f;
			--danger-foreground: #10142a;
			--segment: #2c3459;
			--segment-foreground: #f2e8d8;
			--focus: #e07a4f;
			--hero-start: #26336e;
			--hero-end: #0c1022;
			--hero-foreground: #f2e8d8;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(242, 232, 216, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--brass: #c9a35e;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#F4ECDF`, dark splash `#10142A`,
`android.adaptiveIcon.backgroundColor` `#F4ECDF`.

## 4. Type

`npx expo install @expo-google-fonts/marcellus @expo-google-fonts/work-sans`

```ts
import { Marcellus_400Regular } from "@expo-google-fonts/marcellus/400Regular";
import { WorkSans_400Regular } from "@expo-google-fonts/work-sans/400Regular";
import { WorkSans_500Medium } from "@expo-google-fonts/work-sans/500Medium";
import { WorkSans_600SemiBold } from "@expo-google-fonts/work-sans/600SemiBold";
import { WorkSans_700Bold } from "@expo-google-fonts/work-sans/700Bold";

export const appFonts = {
	Marcellus_400Regular,
	WorkSans_400Regular,
	WorkSans_500Medium,
	WorkSans_600SemiBold,
	WorkSans_700Bold,
};
```

- Marcellus has one weight and no italic. It comes only from a role; never add `font-display`
  to a `body`, `caption`, `heading`, or `label` text: two faces conflict.
- In `app-text.tsx`, set `display` to `font-display text-5xl leading-[1.1] tracking-normal
  text-foreground` (sentence case), and add two roles:
  - `carved`: `font-display text-lg leading-7 text-foreground`, for names on arch cards,
    initials, the carved name, and big numbers.
  - `label`: `font-medium text-[11px] uppercase tracking-[2.5px] text-muted`.
- The carved name: the app name only, `carved` plus `text-3xl uppercase tracking-[6px]`.
- The lead number: `carved` plus `text-7xl leading-none tabular-nums`. Small numbers: `body`
  plus `font-semibold tabular-nums`.
- Arabic twin: `npx expo install @expo-google-fonts/el-messiri @expo-google-fonts/alexandria`.
  `--font-display` is `ElMessiri_600SemiBold`; `--font-normal` to `--font-bold` take the
  Alexandria 400 to 700 keys below. Drop `uppercase` and every `tracking-*`.

```ts
import { Alexandria_400Regular } from "@expo-google-fonts/alexandria/400Regular";
import { Alexandria_500Medium } from "@expo-google-fonts/alexandria/500Medium";
import { Alexandria_600SemiBold } from "@expo-google-fonts/alexandria/600SemiBold";
import { Alexandria_700Bold } from "@expo-google-fonts/alexandria/700Bold";
import { ElMessiri_600SemiBold } from "@expo-google-fonts/el-messiri/600SemiBold";
```

## 5. Signatures

SVG colors: `const [brass, accent] = useCSSVariable(["--color-brass", "--color-accent"])` from
`uniwind`; use a value only when it is a string. Put this helper in `src/shared/ui/star.ts`:

```ts
/** Points of an 8-point star (two squares). The inner radius is r * 0.765. */
export function starPoints(cx: number, cy: number, r: number): string {
	return Array.from({ length: 16 }, (_, i) => {
		const radius = i % 2 === 0 ? r : r * 0.765;
		const angle = (Math.PI / 8) * i - Math.PI / 2;
		return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
	}).join(" ");
}
```

1. **The arch frame.** Outer `rounded-t-full border border-brass p-2`. Inner `overflow-hidden
   rounded-t-full`, with `aspect-[3/4]`, or `flex-1` when the outer has a fixed height. In it,
   `<Image className="size-full" resizeMode="cover" />`. The thin gap is the mark. No text on it.
2. **The star band.** A 28 px row between two `h-px bg-brass` hairlines: a `h-7` View holds
   `<Svg height={28} width="100%">`, a `Pattern` (28 x 28, `patternUnits="userSpaceOnUse"`) with
   `Polygon points={starPoints(14, 14, 9)} fill="none" stroke={brass} strokeWidth={1.25}` and an
   accent `Circle r={1.75}`, then a `Rect width="100%" height="100%"` filled with the pattern.
   On the web, SVG ids are global: each pattern or gradient id is `useId().replaceAll(":", "")`,
   used as ``fill={`url(#${id})`}``. One band per screen.
   The star lattice: its own `Pattern` and id, 36 px cell, `--color-hero-foreground` stroke,
   opacity 0.12, in an `absolute inset-0` View on an indigo block.
3. **The ornamental divider.** `flex-row items-center gap-3`: a `h-px flex-1 bg-brass/50` rule,
   a filled 12 px brass star, the rule again. A section head puts a `label` in place of the star.

## 6. Screens

**Welcome**. Pick one:

- W1 Doorway: centered on sand. The carved name in `text-accent`, the arch frame at
  `w-[72%] self-center` with the photo, the star band at full width (`-mx-5`), a centered
  `display` title, one `text-muted` line, the primary button, a ghost "I have an account".
- W2 Arcade: three arches, `flex-row items-end justify-center gap-3`: a `h-[170px] w-[26%]
  rounded-t-full bg-accent` with a brass star, the arch frame with the photo at `h-[260px]
  w-[38%]`, then a `h-[170px] w-[26%] overflow-hidden rounded-t-full` indigo arch
  (`bg-linear-to-b from-hero-start to-hero-end`) with the lattice. Then the band, a `label`, a
  start-aligned `display`, buttons.
- W3 Night door, no photo: not `Screen`. A `View className="flex-1 bg-linear-to-b
  from-hero-start to-hero-end"` holds the lattice and an `AppSafeAreaView className="flex-1
  px-6 pb-10"` for the content. A lantern glow (SVG `RadialGradient`, brass, `stopOpacity` 0.35
  to 0) behind a doorway `h-[340px] w-[64%] self-center rounded-t-full border-2 border-brass
  p-2.5`; its inner arch (`border border-brass/50`) holds the carved name in
  `text-hero-foreground`. The ghost button child is `<AppText className="text-hero-foreground">`.

**Sign-in and sign-up**: `<Screen className="p-0">` under the modal header of the template. An
indigo block `h-56 items-center justify-center gap-3 bg-linear-to-b from-hero-start
to-hero-end` with the lattice, the carved name in `text-hero-foreground`, and a divider. Then
the doorway panel `-mt-24 mx-3 flex-1 gap-4 rounded-t-full bg-background px-8 pt-24 pb-8`,
which rises into the indigo like an open door: a centered `title`, the fields, the primary
button, the switch as a ghost button.

**Onboarding** (setup facts only, for example the house name): one question per screen, at
most 3. Progress: 3 stars of 14 px on a brass hairline, done stars filled `accent`. Option
cards `rounded-2xl border border-border bg-surface p-4` with a mini arch icon tile
(`h-12 w-10 rounded-t-full bg-surface-tertiary`); selected: `border-2 border-accent`.

**Home, first run** (no rows yet):

- H1 Courtyard: a `flex-row items-end justify-between` header: the date (`label`) and the
  greeting (`display text-4xl`), then a `h-20 w-16` arch frame with the property photo. The
  star band. The lead card: a `View` (its button is the action), `overflow-hidden rounded-3xl
  bg-linear-to-br from-hero-start to-hero-end p-6`, the lattice, a `label` in
  `text-hero-foreground/70`, the lead number (a real 0) in `text-hero-foreground`, a primary
  button.
  The divider "Get started": 3 rows, each a 28 px outline star with the step number inside;
  a done step fills the star. Last, a row of arch cards `w-40`; with zero rows, one dashed
  arch `h-52 w-40 rounded-t-full border border-dashed border-brass` with `add-outline`.
- H2 Arcade grid: a `title`, a search pill, chips from real categories, then a 2-column grid
  (`flex-row flex-wrap justify-between gap-y-6`, items `w-[47%]`) of arch frames, each with
  the name in `carved` and a `label`. First run: a dashed arch "Add a room" and a card "0 of 3
  steps" with three stars.

**Lists**: `AppListGroup` on `bg-surface`. Leading: a mini arch `h-14 w-11 overflow-hidden
rounded-t-full` with the photo, else `carved` initials on `bg-surface-tertiary`. Trailing: a
number, or a status word in the `label` role (`text-success`, `text-danger`).

**Detail**: the arch frame at `mx-5 h-[420px]` (photo from data), the star band, the name in
`display text-4xl`, the place as a `label`. Facts: 3 cells split by `border-s border-brass/40
ps-4`, only fields that exist. A `View className="flex-1"` holds `Screen`, then the bottom
bar: `AppSafeAreaView edges={["bottom"]}` with `border-t border-border bg-surface px-5 py-3`
and the primary button. A price only from data.

**Empty state art**: an arch `h-36 w-28 rounded-t-full border border-brass p-2`, an inner
`flex-1 self-stretch items-center justify-center rounded-t-full bg-surface-tertiary` with the
outline icon (`colorClassName="accent-accent"`), and a `h-px w-36 bg-brass` floor line.

**Tab bar**: `tabBarStyle` with `backgroundColor` from `useThemeColor("surface")`,
`borderTopWidth: 1`, and the `brass` value as `borderTopColor`. Active tint: the accent. Each
icon sits in a `h-9 w-12 items-center justify-end pb-1 rounded-t-full` View; when `focused`,
it adds `bg-accent/15` (a small arch of light) and the icon is the filled name, else
`<name>-outline`. Labels: Work Sans medium, 11 px, no uppercase.

## 7. Motion

Slow and warm, like shade that moves across a courtyard.

- Entry: `FadeInUp.duration(700).delay(index * 90)` on the first 4 blocks; the star band
  `FadeIn.duration(900).delay(300)`.
- Arch reveal: an `Animated.View className="size-full"` around the photo runs a one-shot CSS
  animation in `style`: `animationName: { from: { transform: [{ scale: 1.06 }] }, to: {
  transform: [{ scale: 1 }] } }`, `animationDuration: "1600ms"`, `animationTimingFunction:
  "ease-out"`. Reduced motion: no animation.
- Lantern (W3): an `Animated.View` around the glow loops in `style`: `animationName: { from:
  { opacity: 0.55 }, to: { opacity: 0.9 } }`, `animationDuration: "4s"`,
  `animationIterationCount: "infinite"`, `animationDirection: "alternate"`,
  `animationTimingFunction: "ease-in-out"`. Reduced motion: no animation, opacity 0.75.
- Press: `animation={{ scale: { value: 0.97 } }}` on cards and arches. `tapFeedback()` on a
  chip; `successFeedback()` after a booking request or a save.
- Never: bouncy springs, rotation, side slides, a loop on a data screen.

## 8. Imagery

`generate_image`, `aspect` `2:3`, path `src/assets/<name>.png`, then
`require("../../../assets/<name>.png")` from a screen.

Prompt model: "Warm architectural photograph of [subject of the app: a tiled courtyard with a
fountain and an orange tree / a carved cedar door in a lime-plaster wall / a roof terrace at
dusk], soft late-afternoon light, lime plaster, terracotta, deep blue shadows, calm and empty,
subject centered with space above it for an arch crop, vertical framing, no people, no text,
no logos, no watermark."

- At most 2 images in the first build: the welcome arch and one detail or empty-state arch.
- A generated image is mood only. It shows the user's house, room, or tour only when the user
  picks generated images for it.
- Never: camels, costumes, fake Arabic lettering, sunset silhouettes, stock smiles.

## 9. Bans

- No purple or neon gradient, no glass blur, no second accent, no grey dark mode.
- No square photo, no text on a photo, no brass text, no italics, no emoji.
- No second star band on a screen. No capitals outside the carved name and `label`.

## 10. Self-check

1. Sand by day, indigo by night; brass only on lines and stars.
2. Marcellus comes only from the `display`, `title`, and `carved` roles; the rest is Work Sans.
3. Every photo sits in an arch with the thin brass gap.
4. At most one star band per screen; section heads use the divider; SVG ids come from `useId()`.
5. Every text on an indigo block is `text-hero-foreground` (a `label` there: `/70`).
6. The welcome is W1, W2, or W3 (W3 in a `View` with `AppSafeAreaView`); the home is H1 or H2,
   with real zeros and the steps on the first run (H1 rows, H2 "0 of 3 steps" card).
7. Reduced motion removes the arch zoom and holds the lantern still at 0.75.
