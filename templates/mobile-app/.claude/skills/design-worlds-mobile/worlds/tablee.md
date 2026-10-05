# Tablée — a set table at noon, seen from above

`tablee` · medium · light and dark (espresso) · best for: restaurant, food delivery, cafe,
bakery, catering, recipes, meal planning · avoid for: finance, clinic, gym, dev tools, nightlife

## 1. Feel

A table at noon, seen from above. Cream linen, a tomato napkin, a saffron plate. The food is
the hero: each dish sits on a round color plate. Headlines are Young Serif, round and warm,
like a painted shop sign. The menu reads like a bistro card: a name, a row of dots, a value.
At night the app turns to espresso brown with cream text. It is generous, never slick or cold.

Voice: a good host. "Today's table", "Add to order", "Ready at 12:40". Food verbs: cook,
serve, order, pick up. No exclamation marks, no emoji, no puns on buttons.

## 2. World law and client choices

World law:

- Cream ground, espresso ink, one tomato accent, saffron as the second color. Tomato marks the
  primary action, the active tab, the `label`, and one name in a headline (section 4). Saffron
  fills plates, step discs, and the "in progress" chip. Never tomato text on saffron.
- Young Serif for `display`, `title`, `heading`, and big numbers. DM Sans for the rest.
  Sentence case everywhere.
- Round shapes: plates and chips are `rounded-full`. `--radius: 0.625rem` gives cards and
  pill buttons 30 px (HeroUI multiplies it by 3), fields 17.5 px. Own cards: `rounded-[30px]`.

Client choices: the welcome (W1, W2, W3), the home (H1 or H2), the plate tone of each category
(saffron, blush, herb; fixed on every screen), and the three dishes of the images. Two Tablée
apps never share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.625rem;
}

@theme static {
	--font-normal: "DMSans_400Regular";
	--font-medium: "DMSans_500Medium";
	--font-semibold: "DMSans_600SemiBold";
	--font-bold: "DMSans_700Bold";
	--font-display: "YoungSerif_400Regular";
}

@theme static {
	--color-saffron: var(--saffron);
	--color-saffron-foreground: var(--saffron-foreground);
	--color-plate-blush: var(--plate-blush);
	--color-plate-herb: var(--plate-herb);
}

@layer theme {
	:root {
		@variant light {
			--background: #fbf3e6;
			--foreground: #2a1a12;
			--surface: #fffcf6;
			--surface-foreground: #2a1a12;
			--surface-secondary: #f4e9d8;
			--surface-tertiary: #eadbc4;
			--overlay: #fffcf6;
			--muted: #76604f;
			--accent: #c9361c;
			--accent-foreground: #fffcf6;
			--default: #f1e5d2;
			--default-foreground: #2a1a12;
			--border: #2a1a1217;
			--separator: #2a1a1212;
			--field-background: #fffcf6;
			--field-border: #2a1a122e;
			--field-placeholder: #9c8574;
			--color-default-hover: #e8d9c2;
			--success: #2e6b3f;
			--success-foreground: #fffcf6;
			--warning: #eda73a;
			--warning-foreground: #2a1a12;
			--danger: #9e1f3a;
			--danger-foreground: #fffcf6;
			--segment: #fffcf6;
			--segment-foreground: #2a1a12;
			--focus: #c9361c;
			--hero-start: #c23a1c;
			--hero-end: #8f2412;
			--hero-foreground: #fff6e8;
			--surface-shadow: 0 10px 24px -14px rgba(42, 26, 18, 0.22);
			--overlay-shadow: 0 18px 40px -12px rgba(42, 26, 18, 0.28);
			--field-shadow: 0 0 0 0 transparent inset;
			--saffron: #f2b23e;
			--saffron-foreground: #2a1a12;
			--plate-blush: #f6d2c2;
			--plate-herb: #d3dfbc;
		}

		@variant dark {
			--background: #1b120d;
			--foreground: #f7ecdd;
			--surface: #261a13;
			--surface-foreground: #f7ecdd;
			--surface-secondary: #30231a;
			--surface-tertiary: #3d2c20;
			--overlay: #2b1e16;
			--muted: #bca591;
			--accent: #f0623f;
			--accent-foreground: #1b120d;
			--default: #33251b;
			--default-foreground: #f7ecdd;
			--border: #f7ecdd17;
			--separator: #f7ecdd12;
			--field-background: #261a13;
			--field-border: #f7ecdd2e;
			--field-placeholder: #9a8473;
			--color-default-hover: #3d2c20;
			--success: #72c489;
			--success-foreground: #1b120d;
			--warning: #edaa40;
			--warning-foreground: #1b120d;
			--danger: #ff8fa0;
			--danger-foreground: #1b120d;
			--segment: #3d2c20;
			--segment-foreground: #f7ecdd;
			--focus: #f0623f;
			--hero-start: #a8341a;
			--hero-end: #5a1c0f;
			--hero-foreground: #fff6e8;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(247, 236, 221, 0.2) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--saffron: #e7a63a;
			--saffron-foreground: #1b120d;
			--plate-blush: #5a3226;
			--plate-herb: #36452d;
		}
	}
}
```

Danger is wine or rose, never the tomato. `app.json`: splash `backgroundColor` `#FBF3E6`,
`dark.backgroundColor` `#1B120D`, `android.adaptiveIcon.backgroundColor` `#FBF3E6`.

## 4. Type

`npx expo install @expo-google-fonts/young-serif @expo-google-fonts/dm-sans`

```ts
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { YoungSerif_400Regular } from "@expo-google-fonts/young-serif/400Regular";

export const appFonts = { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, YoungSerif_400Regular };
```

`appFonts` holds these five keys. Set these role strings in `app-text.tsx`:

- `display`: `font-display text-[46px] leading-[52px] tracking-[-0.5px] text-foreground`.
- `title`: `font-display text-[30px] leading-9 text-foreground`. Big numbers: `title` with
  `text-[28px] tabular-nums`. Never add `font-display` to another role.
- `heading`: `font-display text-[22px] leading-7 text-foreground`, so menu sections and the
  `EmptyState` title are Young Serif.
- Add `label`: `font-semibold text-[13px] leading-5 tracking-wide text-accent` (the kicker).
  On the hero, add `text-hero-foreground`.
- Dish names: `body` plus `font-semibold`. Prices and counts add `tabular-nums`.
- The tomato word is a name, never part of a sentence: the app name or a `{name}` parameter.
  It is a nested `AppText` with the role of its parent and `text-accent`. For the greeting,
  call `t("home.greeting")` without `name`, split the text at `{name}`, and nest it there.
- Arabic twin: `npx expo install @expo-google-fonts/changa`. `--font-display` is
  `Changa_800ExtraBold`; the four weights are `Changa_400Regular`, `Changa_500Medium`,
  `Changa_600SemiBold`, `Changa_700Bold`. Drop every `tracking-*` class: it breaks the joins.

```ts
import { Changa_400Regular } from "@expo-google-fonts/changa/400Regular";
import { Changa_500Medium } from "@expo-google-fonts/changa/500Medium";
import { Changa_600SemiBold } from "@expo-google-fonts/changa/600SemiBold";
import { Changa_700Bold } from "@expo-google-fonts/changa/700Bold";
import { Changa_800ExtraBold } from "@expo-google-fonts/changa/800ExtraBold";
```

## 5. Signatures

1. **The plate.** A disc in a plate tone holds a round food photo at 86 % of its size. Build
   `src/shared/ui/plate.tsx` (`size`: a key of `plateSizes`; `tone`; `source` or `icon`). Disc:
   `items-center justify-center rounded-full` plus the size and tone classes. Photo: `<Image
   className="size-[86%] rounded-full" resizeMode="cover" />`. No photo: an `AppIcon` with
   `size={size * 0.4}` and the tone `icon` class as `colorClassName`.

```ts
// Full class strings: Tailwind skips a class that a template string builds.
const plateSizes = {
	64: "size-16",
	84: "size-[84px]",
	120: "size-[120px]",
	160: "size-40",
	180: "size-[180px]",
	220: "size-[220px]",
	300: "size-[300px]",
} as const;
// Saffron stays light in dark mode: its icon takes the saffron ink.
const plateTones = {
	saffron: { plate: "bg-saffron", icon: "accent-saffron-foreground" },
	blush: { plate: "bg-plate-blush", icon: "accent-foreground" },
	herb: { plate: "bg-plate-herb", icon: "accent-foreground" },
} as const;
```

2. **The plate rail.** Category chips in a horizontal `ScrollView` (`gap-4 px-5`). A chip is
   an `AppPressable` `w-[76px] items-center gap-2`: a 64 px `Plate` in a `rounded-full
   border-2 p-[3px]` ring (`border-accent` when selected, else `border-transparent`), then the
   name in `caption font-medium text-foreground`, one line. The last chip is "Add": a dashed
   circle (`border-2 border-dashed border-muted`) with the `add` icon.
3. **The dotted leader.** In a `flex-row items-end gap-2` row: the name, the leader, the
   value. Build `src/shared/ui/dotted-leader.tsx`: a `mb-2 h-[3px] flex-1` View with an
   `Svg height={3} width="100%"` and a `Line` from `x1={1.5}` to `x2="100%"`, `y1={1.5} y2={1.5}`,
   `strokeDasharray="0.1 6"`, `strokeLinecap="round"`, `strokeWidth={2.5}`,
   `strokeOpacity={0.6}`, stroke from `useCSSVariable(["--color-muted"])`. The value is real
   data: a price with `Intl.NumberFormat` and the real currency, a time, a count, or a
   chevron.

## 6. Screens

**Welcome** (a `flex-1 bg-background` View, not `Screen`; an `AppSafeAreaView` in it holds the
text and the buttons). Pick one:

- W1 Table from above: three `absolute` plates, cut by the edges, fill the top 56 %: 300
  saffron `-end-16 top-6`, 180 blush `-start-10 top-[200px]`, 120 herb `start-[38%] top-2`.
  Bottom block `flex-1 justify-end gap-3 px-6 pb-10`: `label`,
  the app name in `display` (its last word tomato), one promise line, a full-width primary
  button, a ghost "I have an account".
- W2 Menu card: a `mx-5 mt-24 gap-4 rounded-[30px] border border-border bg-surface px-6
  pt-20 pb-8` card, the 120 hero plate on its top edge (`absolute -top-[60px]
  self-center`). Inside: the app name as `title`, a double rule, and 3 leader rows that name
  3 real features, each ending in an accent icon. Buttons under the card.
- W3 Awning: the top 44 % is `bg-linear-to-b from-hero-start to-hero-end`; an
  `AppSafeAreaView edges={["top"]}` in it holds the name in `display text-hero-foreground`.
  Its bottom edge: `<Svg width={width} height={14}>` (`useWindowDimensions()`), fill
  `--color-hero-end`, one `a14 14 0 0 0 28 0` arc per 28 px. The 220 plate overlaps the edge
  by half. Then the promise line and the buttons.

**Sign-in and sign-up** (the order slip): `headerShown: false`, `ModalCloseButton` at the top
start. The 120 px hero plate (`self-end me-4 -mb-10 z-10`) overlaps a `gap-4 rounded-[30px]
bg-surface p-6` card: `label` (app name), `title`, one `DottedLeader` as a rule, the fields,
the error line, the full-width primary button. The ghost switch button sits under the card.

**Onboarding** (setup facts only: venue name, cuisine, opening days): at most 3 screens.
Progress marks `h-2.5 rounded-full`: done `w-2.5 bg-accent`, current `w-6 bg-saffron`, next
`w-2.5 bg-surface-tertiary`. Choices are 84 px icon plates in a 3-column grid.

**Home, first run**:

- H1 Tomato card: the date `label` and the avatar; a `title` greeting whose `{name}` is tomato.
  Hero card `min-h-[176px] gap-2 rounded-[30px] bg-linear-to-br from-hero-start to-hero-end
  p-6 pe-[150px]`, the 160 hero plate `absolute -top-5 -end-5` breaking out of the corner, a
  `heading` in `text-hero-foreground`, a cream `AppPressable` pill (`rounded-full bg-surface
  px-4 py-2.5`) for the first action. Then the plate rail (only "Add"), "Menu" as `heading`
  with the real count ("0 dishes"), and a "Get started" card (`rounded-[30px] bg-surface p-5`):
  3 leader rows, each opened by a `size-8 rounded-full bg-saffron` disc with the step number.
- H2 Place setting: a centered column. The latest dish on a 220 plate (with none: the
  place-setting art and "Add a dish"), a `title`, then 3 facts split by `h-10 w-px
  bg-separator`: a `title` number (`text-[28px]`) over a `caption` (dishes, orders today,
  categories; real zeros). Then the rail and a "Get started" list: 3 leader rows that end in
  a chevron and open the create flows.

**Lists**: rows under a `heading` per category. `AppPressable flex-row items-center gap-4
py-3`: a 64 px `Plate` in the category tone, the leader line, a one-line `caption`.
Separators `h-px bg-separator ms-[80px]`. Order status is a `rounded-full px-3 py-1` chip with
a word: preparing `bg-saffron`, ready `bg-success`, cancelled `bg-danger` (with their
`-foreground` text).

**Detail**: a centered 300 plate with the spin-in, a `title`, the facts row, `heading`
sections with leader rows. To order: a bottom bar with a round stepper and the real total.
A `flex-1` View holds `Screen` and, after it, the bar: an `AppSafeAreaView
edges={["bottom"]}` with `border-t border-border bg-surface px-5 pt-3`. It never scrolls away.

**Empty state art** (the place setting): `<Svg width={168} height={120}>`: a plate rim (`r=48`,
`--color-surface-tertiary`), an inner circle (`r=34`, `--color-surface`), a fork at the start
and a knife at the end (round-cap strokes, `--color-muted`), a tomato napkin triangle.

**Tab bar**: `borderTopWidth: 0`, background `useThemeColor("surface")`, active tint the
accent, label `fontSize: 11`. Icons: filled when focused, `-outline` when not. The active
icon sits on a `size-9 rounded-full bg-plate-blush` disc.

## 7. Motion

Warm and generous, like plates set on a table.

- Entry: `FadeInDown.duration(380)`, `.delay(index * 70)` for the first 4 blocks. Plates:
  `ZoomIn.springify().damping(15)`, 80 ms apart.
- Each transform gets its own nested `Animated.View`; the outer one holds `entering`.
- Spin-in (the signature, detail and welcome hero): a Reanimated CSS animation in `style`,
  `rotate` from `"-30deg"` to `"0deg"`, `animationDuration: "900ms"`,
  `animationTimingFunction: cubicBezier(0.34, 1.56, 0.64, 1)`: it lands like a spring.
- Turntable (W1, W3): a CSS loop, `rotate` from `"0deg"` to `"360deg"`, `animationDuration:
  "90s"`, `animationIterationCount: "infinite"`, `animationTimingFunction: "linear"`.
- W2: in each leader, an `Animated.View` around the `Svg` grows from `width: "0%"` to
  `"100%"`: a CSS animation of 600 ms, `animationDelay` `index * 120`,
  `animationFillMode: "backwards"`.
- Add to order: the press handler pops the plate to 1.08 and back (`withSequence`), then
  `successFeedback()`.
- Press: `animation={{ scale: { value: 0.96 } }}` on cards, `0.92` on chips with
  `tapFeedback()`. With `useReducedMotion()` true: no spin-in, no turntable, no leader draw.

## 8. Imagery

`generate_image`, `aspect` `1:1`, path `src/assets/dish-<name>.png`. `require()` the returned
path with a fixed string.

Prompt model, after the user picks generated images for the dishes: "Overhead photograph of
[a real dish from the brief: a margherita pizza / an almond croissant / a chicken tagine] on a plain round white ceramic plate. The plate fills
the square frame and its rim touches the four edges. Shot from directly above, soft daylight
from one side, warm true colors, crisp, appetizing. No table, no cutlery, no hands, no text,
no logos, no watermark." The round crop hides the corners.

At most 3 images in the first build: the hero dish and 2 dishes for W1 or the rail. Never:
people, hands, a menu with prices, branded packaging, a dark moody photo, an illustration.

## 9. Bans

- No cold grey, no blue, no purple, no gradient on a button.
- No square food photo: all food is round, on a plate.
- No invented price, rating, star, review count, "popular" badge, or delivery time.
- No tomato on saffron or herb. No pure black in dark mode. No all-caps.
- No emoji food. No icon in a grey circle: an icon sits on a plate.

## 10. Self-check

1. Cream by day, espresso by night. `display`, `title`, `heading` are Young Serif.
2. Every food photo is round on a plate from the literal maps; a category keeps its tone.
3. The home (H1 or H2) shows the plate rail and at least one dotted leader row.
4. Every price, time, and count is real; a first-run home shows real zeros and a "Get started"
   block of leader rows.
5. Plates scale on press; reduced motion stops the spin-in, the turntable, the leader draw.
6. The tomato word is the app name or a `{name}` parameter, never part of a sentence.
