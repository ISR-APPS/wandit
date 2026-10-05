# Potager — a kitchen garden at first light

`potager` · quiet · light and dark (forest) · best for: plants, gardening, eco shop, farm to
table, organic grocery, healthy recipes, calm habits · avoid for: nightlife, finance, gym, dev
tools, clinic

## 1. Feel

A kitchen garden at dawn: seed-packet paper, sage leaves, clay pots, dark soil. Shapes are soft
and uneven, like pebbles and leaves. Bricolage Grotesque headlines are warm and a little quirky;
Outfit sets the rest. At night the app is a forest at dusk. Nothing shines.

Voice: a patient gardener. A verb first: "Water today", "Sow in March", "3 to harvest". No
exclamation marks, no emoji, no plant puns.

## 2. World law and client choices

- Cream ground, forest ink, a leaf-green accent, clay as the second color. Green marks the primary
  action, the active tab, the `label`, the sprig. Clay marks one headline word, the berry, the
  pot, harvest months, never an error.
- Bricolage for `display`, `title`, `heading`, and numbers (the roles of section 4), in sentence
  case. Outfit for the rest.
- `--radius: 0.5rem`: cards and buttons 24 px, fields 14 px. Own blocks use the leaf corner
  `rounded-[20px] rounded-ss-[56px] rounded-ee-[56px]` (it mirrors in Arabic). Photos sit only in
  a leaf frame.

Client choices: W1 or W2, H1 or H2, seasons or months, the photo subject, the lead blob tone. Two
Potager apps never share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.5rem;
}

@theme static {
	--font-normal: "Outfit_400Regular";
	--font-medium: "Outfit_500Medium";
	--font-semibold: "Outfit_600SemiBold";
	--font-bold: "Outfit_700Bold";
	--font-display: "BricolageGrotesque_800ExtraBold";
	--font-heading: "BricolageGrotesque_600SemiBold";
}

@theme static {
	--color-sage: var(--sage);
	--color-wheat: var(--wheat);
	--color-clay: var(--clay);
	--color-clay-soft: var(--clay-soft);
	--color-frost: var(--frost);
}

@layer theme {
	:root {
		@variant light {
			--background: #f5f0e3;
			--foreground: #1e2a1f;
			--surface: #fffcf4;
			--surface-foreground: #1e2a1f;
			--surface-secondary: #ede6d3;
			--surface-tertiary: #e2d9c2;
			--overlay: #fffcf4;
			--muted: #5c6955;
			--accent: #3d6b47;
			--accent-foreground: #fffcf4;
			--default: #ebe4d0;
			--default-foreground: #1e2a1f;
			--border: #1e2a1f17;
			--separator: #1e2a1f12;
			--field-background: #fffcf4;
			--field-border: #1e2a1f2e;
			--field-placeholder: #8a9283;
			--color-default-hover: #e2dac4;
			--success: #2c7a5c;
			--success-foreground: #fffcf4;
			--warning: #d9a23c;
			--warning-foreground: #1e2a1f;
			--danger: #a3263f;
			--danger-foreground: #fffcf4;
			--segment: #fffcf4;
			--segment-foreground: #1e2a1f;
			--focus: #3d6b47;
			--hero-start: #4a7351;
			--hero-end: #24402c;
			--hero-foreground: #fbf6e8;
			--surface-shadow: 0 10px 28px -18px rgba(30, 42, 31, 0.28);
			--overlay-shadow: 0 18px 40px -14px rgba(30, 42, 31, 0.3);
			--field-shadow: 0 0 0 0 transparent inset;
			--sage: #d3dec3;
			--wheat: #f0dda4;
			--clay: #a94e32;
			--clay-soft: #efc9b4;
			--frost: #d4e0e2;
		}

		@variant dark {
			--background: #111a13;
			--foreground: #eee8d5;
			--surface: #19241b;
			--surface-foreground: #eee8d5;
			--surface-secondary: #213024;
			--surface-tertiary: #2a3b2d;
			--overlay: #1d2a20;
			--muted: #a3af98;
			--accent: #9dc98a;
			--accent-foreground: #111a13;
			--default: #233226;
			--default-foreground: #eee8d5;
			--border: #eee8d517;
			--separator: #eee8d512;
			--field-background: #19241b;
			--field-border: #eee8d52e;
			--field-placeholder: #7f8b78;
			--color-default-hover: #2d3e30;
			--success: #7fd0b2;
			--success-foreground: #111a13;
			--warning: #e4b456;
			--warning-foreground: #111a13;
			--danger: #f2909c;
			--danger-foreground: #111a13;
			--segment: #2a3b2d;
			--segment-foreground: #eee8d5;
			--focus: #9dc98a;
			--hero-start: #31503a;
			--hero-end: #15241a;
			--hero-foreground: #f3eedc;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(238, 232, 213, 0.2) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--sage: #2c4430;
			--wheat: #463d22;
			--clay: #e08b66;
			--clay-soft: #4a2e23;
			--frost: #283a40;
		}
	}
}
```

Seasons: spring `sage`, summer `wheat`, autumn `clay-soft`, winter `frost`, with `text-foreground`
on them. `app.json`: splash `#f5f0e3`, `dark.backgroundColor` `#111a13`.

## 4. Type

`npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/outfit`

```ts
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque/800ExtraBold";
import { Outfit_400Regular } from "@expo-google-fonts/outfit/400Regular";
import { Outfit_500Medium } from "@expo-google-fonts/outfit/500Medium";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit/600SemiBold";
import { Outfit_700Bold } from "@expo-google-fonts/outfit/700Bold";

export const appFonts = {
	BricolageGrotesque_600SemiBold,
	BricolageGrotesque_800ExtraBold,
	Outfit_400Regular,
	Outfit_500Medium,
	Outfit_600SemiBold,
	Outfit_700Bold,
};
```

- Change these roles in `app-text.tsx`. Never add a face class at a use: two `font-*` conflict.
  `display`: `font-display text-[50px] leading-[52px] tracking-[-1.5px] text-foreground`.
  `title`: `font-display text-[32px] leading-9 tracking-[-0.8px] text-foreground`. `heading`:
  `font-heading text-[21px] leading-7 text-foreground`. New `label`: `font-medium text-[13px]
  leading-5 text-accent`.
- A number is `display` with a size and `leading-none` (`text-4xl leading-none`).
- A clay word is a message parameter (`t("home.hello", { name })`) in a nested `AppText` with
  the role of its line: `<AppText variant="display" className="text-clay">`.
- Arabic twin: `npx expo install @expo-google-fonts/alexandria`. `--font-display`:
  `Alexandria_800ExtraBold`; `--font-heading`: `Alexandria_600SemiBold`; the four weights: 400 to
  700. Drop every `tracking-*` class.

```ts
import { Alexandria_400Regular } from "@expo-google-fonts/alexandria/400Regular";
import { Alexandria_500Medium } from "@expo-google-fonts/alexandria/500Medium";
import { Alexandria_600SemiBold } from "@expo-google-fonts/alexandria/600SemiBold";
import { Alexandria_700Bold } from "@expo-google-fonts/alexandria/700Bold";
import { Alexandria_800ExtraBold } from "@expo-google-fonts/alexandria/800ExtraBold";
```

## 5. Signatures

1. **The soil blob.** `src/shared/ui/garden-blob.tsx`: `GardenBlob` (`size`, `tone`,
   `shape` 0 or 1): an `Svg width={size} height={size} viewBox="0 0 100 100"` with one `Path`,
   fill from `useCSSVariable` (a literal map from tone to `--color-<tone>`).
   - 0 `M50 8C64 2 81 7 88 20C94 31 86 42 91 54C97 69 88 86 71 92C55 98 45 89 31 92C16 95 4 84 6 68C8 55 1 45 5 32C10 16 33 15 50 8Z`
   - 1 `M35 10C52 1 79 4 91 22C100 39 95 59 84 73C72 88 53 98 35 93C18 88 3 74 4 54C5 43 14 38 15 29C16 20 23 16 35 10Z`

   It sits behind a frame (20 % bigger, up and to the end), a number, or a tab icon. At most 3
   per screen.
2. **The sprig.** `src/shared/ui/sprig.tsx`: `Sprig` (`width`, `tone`, `draw`), an `Svg` with
   `width` and `height={width * 0.3}`, `viewBox="0 0 160 48"`, no fill, `strokeWidth={1.5}`, round
   caps, stroke `--color-accent` (on a hero: `--color-hero-foreground`). Stem `M4 38C44 34 96 28 154
   12`; leaves `M27 36C35 36 42 26 40 16C31 18 24 28 27 36Z`, `M49 33C50 41 61 46 70 43C67 34 56 29
   49 33Z`, `M75 29C83 30 90 21 89 12C80 13 73 21 75 29Z`, `M100 25C102 32 112 36 120 32C116 23 107
   20 100 25Z`, `M127 19C132 20 138 15 138 8C131 7 125 13 127 19Z`; a clay berry `Circle cx={154}
   cy={12} r={3}`. Widths: 64 as a divider, 96 by a name, 120 in a card hero, 200 in a welcome or
   sign-in hero. Without `draw` it is complete at once. RTL: the wrapper `View`
   gets `transform: [{ scaleX: -1 }]`.
3. **The season chips.** `flex-row items-center gap-1.5 rounded-full border-2 border-transparent
   px-3 py-1.5` with a literal tone class (`bg-sage`, `bg-wheat`, `bg-clay-soft`, `bg-frost`), a 12
   px `leaf` `AppIcon` (`accent-accent`), and a `caption font-medium` word. The season comes from
   the row; "this season" needs the hemisphere, else show the month. A filter row: "All" and seasons
   with real counts, selected `border-accent`. **Season strip**: 12 cells `h-2 flex-1 rounded-full`
   (`flex-row gap-1`): sow months `bg-accent`, harvest `bg-clay`, others `bg-surface-tertiary`;
   narrow month names (`Intl`) under it, a dot under today.

## 6. Screens

**Welcome**: a `flex-1 bg-background` `View`, with `AppSafeAreaView` inside for the text and the
buttons. Not `Screen`. Pick one:

- W1 Leaf window: a frame `mx-6 mt-4 h-[56%] overflow-hidden rounded-[28px] rounded-ss-[150px]
  rounded-ee-[150px]` with the 4:5 photo, a sage blob (0, 300) behind it at `absolute -end-16
  -top-6`. Bottom `flex-1 justify-end gap-3 px-6 pb-10`: the 96 sprig, the name in `display`
  (one clay word, section 4), a `text-muted` promise, a primary button, a ghost "I have an account".
- W2 Seed packet: no photo. A packet `mt-16 w-[80%] self-center overflow-hidden rounded-[24px]
  bg-surface shadow-surface`: the top 55 % is the hero gradient with a clay-soft blob (1, 170,
  `opacity-30`) and the 200 sprig; a tear line `border-t border-dashed border-border`; then `gap-3
  p-5`: the name (`title`), a `caption`, the strip with only today. Buttons below.

**Sign-in and sign-up**: full screen, `headerShown: false`, `ModalCloseButton` in the modal case.
Hero `mx-4 mt-2 h-[200px] justify-end overflow-hidden rounded-[24px] rounded-ee-[96px]
bg-linear-to-br from-hero-start to-hero-end p-6` with the 200 sprig (`absolute -end-6 top-6
opacity-60`) and the `title` in `text-hero-foreground`. Then `gap-4 px-6 pt-6`: fields with a
`label` above, the error line, the primary button, the ghost switch.

**Onboarding** (setup facts only, such as the hemisphere), at most 3 screens. Progress: 3 icons,
done `leaf` in `accent-accent`, next `leaf-outline` in `accent-muted`. A `title` question,
leaf-corner rows `AppPressable flex-row items-center gap-4 border-2 border-transparent
bg-surface p-4` with a 44 px blob behind the icon; selected: `border-accent` and a
`checkmark-circle` (`ZoomIn`). "Next" is pinned.

**Home, first run**:

- H1 Garden today: the date `label`, `AppAvatar`, a `title` greeting with a clay name (section
  4). Hero `min-h-[200px] gap-2 overflow-hidden rounded-[24px] rounded-ss-[72px]
  rounded-ee-[72px] bg-linear-to-br from-hero-start to-hero-end p-6`: a sage blob (1, 220,
  `opacity-25`, `absolute -end-14 -bottom-16`), the 120 sprig, today's real task count
  (`display`, `text-7xl leading-none text-hero-foreground`), a `caption` in
  `text-hero-foreground/80`, an `AppPressable` pill `rounded-full bg-hero-foreground px-4 py-2.5`
  (text `font-semibold text-hero-start`) to the create flow. Then the season filter (zeros) and
  "Get started" (`rounded-[24px] bg-surface p-5`): 3 rows, each a 36 px blob with the step
  number, a chevron that flips in Arabic.
- H2 Almanac: today's month (`Intl`) in `display`, the year, the sprig, the strip. Then 3 blob stats
  (`flex-row justify-between`): a `size-[104px] items-center justify-center` View, a 104 blob (sage
  0, wheat 1, clay-soft 0 `rotate-[140deg]`) `absolute` behind a real number (`display`, `text-4xl
  leading-none`), a `caption` under it (plants, due this week, harvested). Then "This month" (real
  count); on first run a dashed leaf frame (`h-28 border-2 border-dashed border-accent`), the `add`
  icon, and "Plant the first one".

**Lists**: `FlatList` rows `AppPressable flex-row items-center gap-4 py-3`: a `size-14
overflow-hidden rounded-ss-[28px] rounded-ee-[28px]` leaf thumb (photo, or a blob with the
initial), the name `font-semibold`, a real-fact `caption` ("Sown 12 March"), a season chip or a
status chip (`rounded-full bg-surface-secondary px-2.5 py-1`: a `size-2` dot in `bg-success`,
`bg-warning`, or `bg-danger`, and a word). Separators `ms-[72px]`.

**Detail**: a leaf frame `mx-5 h-[340px]` with a 260 sage blob behind. The `title`, chips, the
strip with a "Sow" and "Harvest" legend, 3 real facts split by `w-px bg-separator`, sections
opened by the sprig and a `heading`, the main action pinned.

**Empty state art**: `Svg width={160} height={120}`: blob 0 in `G transform="translate(26 8)
scale(1.08)"`; a clay pot `M58 80L102 80L97 112L63 112Z` and `Rect x={53} y={72} width={54}
height={10} rx={3}`; an accent sprout: stem `M80 72V46` (width 2.5), leaves `M80 56C72 56 64 50 62
42C70 42 78 48 80 56Z`, `M80 49C88 49 95 43 97 35C89 35 82 41 80 49Z`.

**Tab bar**: `{ backgroundColor: background, borderTopWidth: 0 }`, accent tint, label
`fontSize: 11`. The focused icon sits on a 40 px sage blob (`absolute`, in a
`size-10 items-center justify-center` View).

## 7. Motion

Slow and soft, like growth.

- Entry: `FadeInUp.duration(520).delay(index * 80)`, first 4 blocks. Blobs: `ZoomIn.duration(700)`
  on an outer `Animated.View`; a `rotate-*` class or the sway on an inner view.
- Sprig draw (`draw`; welcome, sign-in, home hero): an animated stem `Path` with
  `strokeDasharray={[180, 180]}` and `strokeDashoffset` from `useAnimatedProps`. The `onLayout`
  of the wrapper starts it: offset 180 to 0 (`withTiming`, 1100 ms, `Easing.out(Easing.cubic)`),
  and a `leaves` value 0 to 5 (`withDelay(1100, withTiming(5, { duration: 450 }))`). Each leaf
  is a `SprigLeaf`, an animated `Path` with `opacity: clamp(leaves.value - index, 0, 1)`
  (`clamp` from Reanimated). No effect.
- Sway: one hero blob turns from -3 to 3 deg, a CSS animation in `style`: `animationName`
  (`from` and `to` with `transform: [{ rotate }]`), `animationDuration: "7s"`,
  `animationIterationCount: "infinite"`, `animationDirection: "alternate"`,
  `animationTimingFunction: "ease-in-out"`.
- A done task: a `leaf` icon with `ZoomIn.springify().damping(14)`, then `successFeedback()`.
  Press scale: 0.97 on cards, 0.94 on chips with `tapFeedback()`.
- `useReducedMotion()` true: the sprig starts complete (offset 0, leaves 5); the blob does not
  sway.

## 8. Imagery

`generate_image`: `4:5` for leaf frames, `1:1` for thumbs, path `src/assets/<name>.png`, then
`require()` the returned path with a fixed string. Prompt model: "Natural-light photograph of [the
app subject: a basil plant in a terracotta pot / carrots just pulled from the soil], soft morning
side light, muted sage, cream, and clay tones, shallow depth of field, plain background, no
people, no text, no logos, no watermark." At most 3 images in the first build. Never: glossy
stock, neon green, faces, brand packaging, illustrations.

## 9. Bans

- No pure white or black ground, no neon green, no cold grey, no glow, no glass.
- No gradient on a button, no icon in a grey circle, no all-caps display.
- No invented harvest date, price, rating, eco score, or "organic" claim.

## 10. Self-check

1. Light is cream, dark is forest; the `display`, `title`, `heading` roles are Bricolage.
2. No text has two `font-*` classes; numbers and clay words use the role of their line.
3. Each main screen has a blob, a sprig, and season chips or the strip.
4. Every photo sits in a leaf frame.
5. Dates, counts, and seasons are real; a first-run home shows zeros and a start device.
6. Reduced motion shows the sprig complete and gives the blob no sway.
