# Registre — the back office at five to nine

`registre` · medium · light + dark · best for: CRM, stock, staff rota, point of sale, bookings
admin, gym or shop management · avoid for: meditation, kids, nightlife, food menus, beauty

## 1. Feel

The front counter before the doors open: cool paper, blue-black ink, one cobalt pen. The app is
the register of the owner. Each screen answers "what needs me today" in one look. Numbers sit in
tidy tiles, each with a small line for the week. Dark mode is the same desk at night: deep
ink and a cobalt lamp.

Voice: a precise assistant. Numbers first ("3 bookings today", "2 items low"), a verb on each
button ("Mark as paid"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Registre app:

- Paper ground, white tiles, ink text. Cobalt marks the primary action, the active tab, the
  lead tile, sparklines, and the now line.
- Plus Jakarta Sans for all text. Every number has `tabular-nums`.
- `--radius: 0.5rem`: cards and buttons 24 px, fields 14 px. Tiles use `rounded-2xl` (16 px).
- Four signatures: the KPI bento, the status chip, the segmented bar, the now line (section 5).
- The only gradient is cobalt to ink.

Client choices: the welcome (W1, W2, W3), the home (H1, H2), the lead KPI (bookings today,
items in stock, members in), 2 to 4 other KPIs, and the status words.
Two Registre apps must never share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.5rem;
}

@theme static {
	--font-normal: "PlusJakartaSans_400Regular";
	--font-medium: "PlusJakartaSans_500Medium";
	--font-semibold: "PlusJakartaSans_600SemiBold";
	--font-bold: "PlusJakartaSans_700Bold";
	--font-display: "PlusJakartaSans_800ExtraBold";
}

@layer theme {
	:root {
		@variant light {
			--background: #f3f5f9;
			--foreground: #0f1a2e;
			--surface: #ffffff;
			--surface-foreground: #0f1a2e;
			--surface-secondary: #ebeff5;
			--surface-tertiary: #dfe5ee;
			--overlay: #ffffff;
			--muted: #566176;
			--accent: #1e4bd2;
			--accent-foreground: #ffffff;
			--default: #e6eaf1;
			--default-foreground: #0f1a2e;
			--border: #0f1a2e17;
			--separator: #0f1a2e10;
			--field-background: #ffffff;
			--field-border: #0f1a2e29;
			--field-placeholder: #8a93a5;
			--color-default-hover: #dce1ea;
			--success: #12784a;
			--success-foreground: #ffffff;
			--warning: #f2a93b;
			--warning-foreground: #1a1300;
			--danger: #c2352b;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #0f1a2e;
			--focus: #1e4bd2;
			--hero-start: #1e4bd2;
			--hero-end: #0b1630;
			--hero-foreground: #ffffff;
			--surface-shadow: 0 1px 2px 0 rgba(15, 26, 46, 0.06);
			--overlay-shadow: 0 12px 32px 0 rgba(15, 26, 46, 0.16);
			--field-shadow: 0 0 0 0 transparent inset;
		}

		@variant dark {
			--background: #0b1220;
			--foreground: #e8edf6;
			--surface: #121b2e;
			--surface-foreground: #e8edf6;
			--surface-secondary: #18233a;
			--surface-tertiary: #22304b;
			--overlay: #16203a;
			--muted: #97a3ba;
			--accent: #7396ff;
			--accent-foreground: #0b1220;
			--default: #1c2740;
			--default-foreground: #e8edf6;
			--border: #ffffff14;
			--separator: #ffffff0f;
			--field-background: #121b2e;
			--field-border: #ffffff24;
			--field-placeholder: #6c7891;
			--color-default-hover: #25324f;
			--success: #3ccb8a;
			--success-foreground: #0b1220;
			--warning: #f5b851;
			--warning-foreground: #0b1220;
			--danger: #ff6f62;
			--danger-foreground: #0b1220;
			--segment: #22304b;
			--segment-foreground: #e8edf6;
			--focus: #7396ff;
			--hero-start: #2549d0;
			--hero-end: #08112a;
			--hero-foreground: #ffffff;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#F3F5F9` (light) and `#0B1220` (dark),
`android.adaptiveIcon.backgroundColor` `#F3F5F9`, `"userInterfaceStyle": "automatic"`.

## 4. Type

`npx expo install @expo-google-fonts/plus-jakarta-sans`. The template `fonts.ts` already
holds these imports. Keep them:

```ts
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";

export const appFonts = {
	PlusJakartaSans_400Regular,
	PlusJakartaSans_500Medium,
	PlusJakartaSans_600SemiBold,
	PlusJakartaSans_700Bold,
	PlusJakartaSans_800ExtraBold,
};
```

Keep the template roles in `app-text.tsx` and add two:

- `label`: `font-semibold text-xs leading-4 text-muted`, sentence case.
- `numeral` for KPI values, stats, and big date numbers: `font-display text-3xl leading-9
  tabular-nums tracking-tight text-foreground`. The lead number adds `text-6xl leading-none
  tracking-tighter`. Never add `font-display` to text of another role.
- Format counts with `Intl.NumberFormat(locale)`. Money uses the currency of the business
  settings (`style: "currency"`); never assume one. Times use `Intl.DateTimeFormat`.
- Arabic twin: `npx expo install @expo-google-fonts/ibm-plex-sans-arabic`. Tokens: normal
  `IBMPlexSansArabic_400Regular`, medium `_500Medium`, semibold `_600SemiBold`, bold and display
  `_700Bold`. Drop `tracking-*` in Arabic.

```ts
import { IBMPlexSansArabic_400Regular } from "@expo-google-fonts/ibm-plex-sans-arabic/400Regular";
import { IBMPlexSansArabic_500Medium } from "@expo-google-fonts/ibm-plex-sans-arabic/500Medium";
import { IBMPlexSansArabic_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold";
import { IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic/700Bold";
```

## 5. Signatures

1. **The KPI bento.** A tile is an `AppPressable`: `flex-1 gap-3 rounded-2xl border
   border-border bg-surface p-4`. Top row: the `label`, then a trend icon (`trending-up` with
   `colorClassName="accent-success"`, `trending-down` with `accent-danger`) and `+12 %` in
   `text-xs`, only when the previous period has rows. Then the value in `numeral`. Last, a
   sparkline: `Svg width={w} height={32}`, `w` from `onLayout` of a View around it. A `Path`
   through the last 7 or 14 real values (accent, width 2, round caps) over an area with a
   `LinearGradient` (accent, `stopOpacity` 0.18 to 0; id from `useId()`, colons removed).
   Under 2 values or all zero: one dashed base line (`strokeDasharray="4 4"`, muted). Colors:
   `useCSSVariable(["--color-accent", "--color-muted"])`. RTL: `x = w - x`. The lead tile
   spans the row: `bg-linear-to-br from-hero-start to-hero-end`, text `text-hero-foreground`
   (the `label` `text-hero-foreground/80`), line `--color-hero-foreground`.
2. **The status chip.** `flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1`.
   Tones: done `bg-success/15`, waiting `bg-warning/20`, problem `bg-danger/15`, scheduled
   `bg-accent/10`, draft `bg-default`. A `size-1.5 rounded-full` dot in the tone color
   (`bg-muted` for draft), then the word in `label` with `text-foreground`. One `statusTone`
   object in the feature `lib/` maps each status to full class strings (chip and dot).
3. **The segmented bar.** `flex-row gap-1 rounded-xl bg-surface-secondary p-1`, 2 to 4
   segments. Each is an `AppPressable` `min-h-10 flex-1 flex-row items-center justify-center
   gap-1.5 rounded-lg`. One object maps the two states to full classes. Selected: `bg-segment
   border border-border`, text `font-semibold text-segment-foreground`; others `text-muted`.
   A real count follows the word (`text-xs tabular-nums`), hidden while loading.
4. **The now line.** Agenda rows sorted by start: `flex-row gap-3 py-3`, a time column `w-14`
   (start `font-semibold text-sm tabular-nums`, end `caption`), a rail `w-1 self-stretch
   rounded-full` in the tone color, then the title, a `caption` name, and the chip. Past rows
   get `opacity-60`. Between the last past row and the next row: a `size-2 rounded-full
   bg-accent` dot, a `h-px flex-1 bg-accent` line, and the time in `text-xs font-semibold
   text-accent`. Compute "now" in render; `subscribed: useIsFocused()` refreshes it.

## 6. Screens

**Welcome**: a `View className="flex-1 bg-background"`, not `Screen`, with `AppSafeAreaView`
inside for the text and the buttons. Pick one:

- W1 Tile stack: the top 60 % is `overflow-hidden rounded-b-[40px] bg-linear-to-b
  from-hero-start to-hero-end`. In it, 3 glass tiles (`h-28 w-[72%] rounded-2xl border
  border-hero-foreground/20 bg-hero-foreground/10`), overlapped `-mt-14`, turned
  `rotate-[-6deg]`, `rotate-0`, `rotate-[5deg]` (inner View; see Motion). Each holds a fixed
  line and two bars (`h-2 rounded-full bg-hero-foreground/30`). No digits: it is art, not
  data. Below, a `flex-1 gap-3 px-6 pt-8 pb-10` panel: the name in `display`, a promise in
  `text-muted`, then at `mt-auto` a primary button ("Get started") and a ghost button.
- W2 Ledger grid: an SVG grid of 24 px squares fills the screen (stroke foreground, opacity
  0.05, every 4th line 0.09). Top start: the app mark, a `size-11 rounded-xl bg-accent` square
  with the initial in `numeral` (`text-xl leading-7 text-accent-foreground`). At 28 % height:
  the name in `display text-6xl`; its last word is a message parameter in a nested
  `<AppText variant="display" className="text-6xl text-accent">`. Then 3 rows for the real
  modules (`border-b border-separator py-3`: accent outline icon, `heading`, `caption`).
- W3 Day sheet: the gradient fills the top 46 % and shows today from `Intl`: the weekday as
  `label` (`text-hero-foreground/80`), the day number in `numeral` (`text-[120px] leading-none
  text-hero-foreground`), the month as `heading` (`text-hero-foreground`), and the now line in
  `bg-hero-foreground/50` with the real time. A panel `-mt-6 rounded-t-3xl bg-background px-6
  pt-7 pb-10` holds the name, the promise, and buttons.

**Sign-in and sign-up**: `headerShown: false`, `ModalCloseButton` at the top end. The app mark
and name over the W2 grid (top 240 px, half opacity), a `title`, the fields in one `rounded-3xl
border border-border bg-surface p-4 gap-4` card, the primary button, and a ghost switch link.

**Onboarding** (only for setup facts: business name, currency, opening days): at most 3 screens.
"Step 1 of 3" as `label` over a `h-1 rounded-full bg-surface-tertiary` track with a `bg-accent`
fill. The question is a `title`. Choice cards: `rounded-2xl border border-border bg-surface p-4`;
selected adds `border-2 border-accent` and a `checkmark-circle` (`accent-accent`). "Next" is
pinned.

**Home, first run** (no rows). Pick one:

- H1 Bento board: the date (`label`), the business name (`title`), `AppAvatar` at the end. The
  lead tile (a real 0 and a dashed line), then 2 rows of 2 tiles. Then a "Set up your workspace"
  card: a `0/3` count, a track, and 3 `AppListGroup` rows that open the create flows.
- H2 Day sheet: the title, the segmented bar (Today, Week, Month), a strip of 3 tiles
  (`w-40`, `numeral` `text-2xl`), then "Today" and the agenda. First run: zeros in the tiles,
  hour marks from the opening time (`h-14 border-t border-separator`), and 3 dashed slots
  (`rounded-2xl border border-dashed border-accent/40`) at the next hours that open the create
  flows ("Add a booking", "Add a client", "Add a service").

**Lists**: a title row (`title`, and an `AppButton size="sm" isIconOnly` with `add`), the
segmented bar, a search `AppTextField`, then a `SectionList` with `label` headers. Rows:
`AppPressable` `flex-row items-center gap-3 bg-surface px-4 py-3`, separator
`h-px bg-separator ms-[68px]`. Leading: a `size-10 rounded-xl bg-accent/10` square with initials
in `font-bold text-sm text-accent`, or `AppAvatar`. Trailing: the chip, or a number over a caption.

**Detail**: a `bg-surface` header (initials square `size-14`, `title`, chip, 3 stats in
`numeral` `text-2xl leading-8` split by `border-s border-separator ps-4`), the segmented bar,
key-value rows in `AppListGroup`, and a bottom bar `absolute inset-x-0 bottom-0 bg-surface p-5`.

**Empty state art**: an SVG 160 x 120 card (`Rect` `rx` 16, fill surface, stroke border) with 3
rows (`Circle` r 4 and `Rect` h 6, fill surface-tertiary). A dashed accent line rises over its
top end. An accent `Circle` r 14 at the bottom end holds a plus.

**Tab bar**: classic. `tabBarStyle: { backgroundColor: surface, borderTopColor: separator }`
from `useThemeColor`, active tint accent, `tabBarLabelStyle: { fontSize: 11 }`, no uppercase.
The active icon is the filled Ionicons name, the inactive one `<name>-outline`.

## 7. Motion

- Entry: `FadeInDown.duration(260)` per block; tiles `.delay(index * 50)`.
- Sparklines draw once: a CSS animation in the `style` of an
  `Animated.createAnimatedComponent(Path)`, `strokeDashoffset` from the path length (sum of
  segments, also the `strokeDasharray`) to 0, `"600ms"`, `"ease-out"`. No effect hook.
  Reduced motion: no dash, no animation.
- A status change remounts the chip (`key={status}`) with `ZoomIn.duration(180)`.
- Press: `AppPressable animation={{ scale: { value: 0.98 } }}` on tiles and rows.
  `tapFeedback()` on a segment or status change, `successFeedback()` after a save.
- W1 tiles: `FadeInDown.springify().damping(18).delay(index * 90)` on an outer
  `Animated.View`; the rotate class stays on the inner tile. W3: the now line grows by a CSS
  animation of `width`, `"0%"` to `"100%"`, 700 ms; reduced motion shows it full.
- Never: loops on a data screen, parallax, count-up tickers.

## 8. Imagery

SVG first. A photo is optional: at most 1 in the first build, only for an app about a place,
on W3 or a detail band. `generate_image` with `aspect` `3:2`, path `src/assets/<name>.png`,
then `require()` the returned path with a fixed string.

Prompt model: "Photograph of [the place: a tidy shop shelf / an empty gym floor at opening / a
salon chair by a window], cool morning daylight, clean lines, muted blue-grey tones, no people,
no text, no logos, no watermark." Never generate charts, screens, laptops, handshakes, or money.

## 9. Bans

- No purple or violet gradient, no second brand color, no pastel tiles.
- No uppercase labels, no mono font. No chart, trend, or delta without a real series.
- No status in color only. No icon in a grey circle. No emoji. No photo on a data screen.
- No heavy shadow. No glass outside the W1 stage.

## 10. Self-check

1. Every screen works in light and in dark mode.
2. All text is Plus Jakarta Sans; numbers are `tabular-nums` (`numeral` role) and use `Intl`.
3. The first-run home shows real zeros, dashed lines, and the setup card (H1) or the 3 dashed
   slots (H2).
4. Every status shows a dot and a word through one `statusTone` map.
5. Every list opens with the segmented bar and real counts.
6. The welcome is W1, W2, or W3; the home is H1 or H2.
7. Sparklines run start to end in RTL and draw at once under reduced motion.
