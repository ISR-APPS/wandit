# Revue — the catalogue on a café table

`revue` · medium · both · best for: e-commerce, catalog, fashion retail, furniture, books,
concept store, lookbook · avoid for: kids, fitness, clinic, finance, food delivery, nightlife

## 1. Feel

A printed catalogue, read slowly at a café table. Ivory paper, black ink, one terracotta
stamp. Photos run edge to edge with a short caption under each one. Titles are tall
serif words, and one word in each title leans in italic, like the voice of an editor. Lists
are numbered like a table of contents. Every corner is square. The products carry the color.

Voice: an editor, not a seller. Nouns first: "New in", "The edit". Sentence case. No
exclamation marks, no countdowns. A stock line ("2 left") only from stock data.

## 2. World law and client choices

World law, the same in every Revue app:

- Ivory paper, ink, one terracotta accent. Terracotta marks the add bar, the chosen option,
  the focus ring, and the bag badge. Nothing else.
- Instrument Serif for display text, titles, and index numerals; its italic for exactly one
  word per title; Inter Tight for all other text, prices, and labels.
- Square: `--radius: 0rem`. HeroUI parts and every `rounded-*` class go square. Only a 6 px
  status dot may use `rounded-full`.
- No shadows, no card boxes: 1 px rules and white space separate content.
- Four signatures: the italic word, the plate, the index, the add bar.
- Light (ivory) and dark (ink) follow the system: `"userInterfaceStyle": "automatic"`.

Client choices: the welcome (W1, W2, W3) and the home (H1, H2); the italic word of each title
(the word with the meaning: "New *in*", "Your *bag*"); the plate ratio, `4:5` (fashion,
books) or `1:1` (furniture, objects), one per app; the subject of the editorial photos.
Two Revue apps never share the same welcome and home composition.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0rem;
}

@theme static {
	--font-normal: "InterTight_400Regular";
	--font-medium: "InterTight_500Medium";
	--font-semibold: "InterTight_600SemiBold";
	--font-bold: "InterTight_700Bold";
	--font-display: "InstrumentSerif_400Regular";
	--font-italic: "InstrumentSerif_400Regular_Italic";
}

@layer theme {
	:root {
		@variant light {
			--background: #f5f0e6;
			--foreground: #161412;
			--surface: #fbf8f2;
			--surface-foreground: #161412;
			--surface-secondary: #ece5d7;
			--surface-tertiary: #e2d9c8;
			--overlay: #fbf8f2;
			--muted: #6b6259;
			--accent: #a3461f;
			--accent-foreground: #fbf6ee;
			--default: #e9e2d4;
			--default-foreground: #161412;
			--border: #16141224;
			--separator: #1614121a;
			--field-background: #fbf8f2;
			--field-border: #16141247;
			--field-placeholder: #857c72;
			--color-default-hover: #dfd6c6;
			--success: #2f6b3f;
			--success-foreground: #fbf6ee;
			--warning: #c98a1c;
			--warning-foreground: #161412;
			--danger: #a8261c;
			--danger-foreground: #fbf6ee;
			--segment: #161412;
			--segment-foreground: #f5f0e6;
			--focus: #a3461f;
			--hero-start: #9a4424;
			--hero-end: #4e2112;
			--hero-foreground: #f6efe3;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 0 1px rgba(22, 20, 18, 0.14) inset;
			--field-shadow: 0 0 0 0 transparent inset;
		}

		@variant dark {
			--background: #12100e;
			--foreground: #f2ebdf;
			--surface: #1b1815;
			--surface-foreground: #f2ebdf;
			--surface-secondary: #25211d;
			--surface-tertiary: #2f2a25;
			--overlay: #1e1b18;
			--muted: #a79d90;
			--accent: #d7744a;
			--accent-foreground: #12100e;
			--default: #2a2521;
			--default-foreground: #f2ebdf;
			--border: #f2ebdf26;
			--separator: #f2ebdf17;
			--field-background: #1b1815;
			--field-border: #f2ebdf40;
			--field-placeholder: #847a6e;
			--color-default-hover: #342e29;
			--success: #7dbe8c;
			--success-foreground: #12100e;
			--warning: #e0ad4c;
			--warning-foreground: #12100e;
			--danger: #ef7a68;
			--danger-foreground: #12100e;
			--segment: #f2ebdf;
			--segment-foreground: #12100e;
			--focus: #d7744a;
			--hero-start: #7a3219;
			--hero-end: #2e140a;
			--hero-foreground: #f6efe3;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 0 1px rgba(242, 235, 223, 0.14) inset;
			--field-shadow: 0 0 0 0 transparent inset;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#F5F0E6`, splash `dark.backgroundColor` `#12100E`,
`android.adaptiveIcon.backgroundColor` `#F5F0E6`, `<StatusBar style="auto" />`.

## 4. Type

`npx expo install @expo-google-fonts/instrument-serif @expo-google-fonts/inter-tight`

```ts
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { InterTight_400Regular } from "@expo-google-fonts/inter-tight/400Regular";
import { InterTight_500Medium } from "@expo-google-fonts/inter-tight/500Medium";
import { InterTight_600SemiBold } from "@expo-google-fonts/inter-tight/600SemiBold";
import { InterTight_700Bold } from "@expo-google-fonts/inter-tight/700Bold";

export const appFonts = {
	InstrumentSerif_400Regular,
	InstrumentSerif_400Regular_Italic,
	InterTight_400Regular,
	InterTight_500Medium,
	InterTight_600SemiBold,
	InterTight_700Bold,
};
```

Set these roles in `app-text.tsx`, and add three:

- `display`: `font-display text-6xl leading-[64px] tracking-tight text-foreground`.
- `title`: `font-display text-4xl leading-[44px] text-foreground`.
- `heading`: `font-medium text-lg leading-7 text-foreground`.
- `body`: `font-normal text-[15px] leading-6 text-foreground`.
- New `label`: `font-semibold text-[11px] leading-4 uppercase tracking-[1.6px] text-muted`.
- New `numeral` (index numbers): `font-display text-4xl leading-[44px] tabular-nums text-muted`.
- New `italic`: `font-italic text-4xl leading-[44px] text-foreground`. Never add a face class
  to text of another role.
- The italic word is a message parameter (`"New {word}"`), so a translation can move it. The
  screen renders it as a nested `<AppText variant="italic">`; in a `display` line it adds
  `text-6xl leading-[64px] tracking-tight`. Instrument Serif has one weight: no `font-bold`.
- Prices: `font-medium tabular-nums`, from the price row through `Intl.NumberFormat`.
- Arabic twin: `npx expo install @expo-google-fonts/noto-kufi-arabic`. The four weights take
  `NotoKufiArabic_400Regular` to `_700Bold`; `--font-display` and `--font-italic` both take
  `NotoKufiArabic_300Light`. No italics in Arabic: the italic word adds `text-accent`.
  `display` drops to `text-5xl`; `label` drops `uppercase` and the tracking.

```ts
import { NotoKufiArabic_300Light } from "@expo-google-fonts/noto-kufi-arabic/300Light";
import { NotoKufiArabic_400Regular } from "@expo-google-fonts/noto-kufi-arabic/400Regular";
import { NotoKufiArabic_500Medium } from "@expo-google-fonts/noto-kufi-arabic/500Medium";
import { NotoKufiArabic_600SemiBold } from "@expo-google-fonts/noto-kufi-arabic/600SemiBold";
import { NotoKufiArabic_700Bold } from "@expo-google-fonts/noto-kufi-arabic/700Bold";
```

## 5. Signatures

1. **The italic word.** Each section opens with a `title` that holds one italic word, on a
   1 px ink rule: `flex-row items-end justify-between border-b border-foreground pb-2`, a
   `label` link ("See all") at the end. Never two italic words.
2. **The plate.** Photos run edge to edge: no corner, no border, no text on them. Leave the
   `Screen` padding with `-mx-5`: `<Image className="aspect-[4/5] w-full bg-surface-secondary"
   resizeMode="cover" />` (`aspect-square` for the 1:1 ratio). The caption sits under it,
   `mt-3 flex-row gap-3`: the index in `label` ("01"), the name in `font-medium` with one
   `caption` line from the data, the price at the end. Rail: horizontal `FlatList`, `gap-2`,
   off the end edge; items `style={{ width: width * 0.68 }}`, `width` from
   `useWindowDimensions()` (a percent width collapses in a horizontal list). Grid: 2 columns,
   `gap-px` over `bg-border`, cells `bg-background`, caption `px-3 pb-4`.
3. **The index.** Departments and orders read like a table of contents. Build each row from
   `AppPressable` and `AppText` (the HeroUI list row keeps its own padding on the web):
   `flex-row items-center gap-3 border-b border-border py-4`. Prefix:
   `String(index + 1).padStart(2, "0")` in `numeral` with `w-14`; the name in `heading`; a
   real count in `caption`; `arrow-forward` (`accent-muted`) at the end, flipped in RTL.
4. **The add bar.** On a product screen, a terracotta bar on the bottom edge, outside the
   scroll view: `AppSafeAreaView edges={["bottom"]}` with `absolute inset-x-0 bottom-0` and
   the bar class of its state, holding an `AppPressable` `h-16 flex-row items-center
   justify-between px-5`: "Add to bag" (`font-semibold`), the chosen option in `label`, the
   price. Scroll content gets `pb-32`. One object maps each state to full classes (bar, text);
   every text on the bar, `label` too, takes the state text class. Ready: `bg-accent`,
   `text-accent-foreground`. No option chosen: `bg-default`, `text-default-foreground`,
   "Choose a size". Out of stock (from data): `bg-surface-secondary`, `text-muted`, "Sold out",
   `isDisabled`. The product route
   lives in the root stack (`src/app/product/[id].tsx`), so the tab bar hides.

## 6. Screens

**Welcome**: a `View className="flex-1 bg-background"`, not `Screen`, with `AppSafeAreaView`
inside for the text and the buttons. Pick one:

- W1 Cover: a masthead band on the paper, above the photo: the name in `display` with
  `text-7xl leading-[72px]`, the month and year in `label` (`Intl.DateTimeFormat`), a 2 px ink
  rule. Under it, a photo fills the free height edge to edge (`flex-1 w-full`,
  `resizeMode="cover"`). At the bottom, a `px-5 pb-8` band with one line, a primary button,
  and a ghost button. No text on the photo.
- W2 Index page: no photo. A `display` title on 3 lines with one italic word ("Things
  *worth* keeping"), a 2 px ink rule, the real departments from the brief numbered 01 to 04.
- W3 Contact sheet: over the top 62 %, a `2:3` photo (60 % wide) and two stacked `1:1`
  photos with 1 px gutters (`gap-px bg-border`). The title and the buttons under it.

**Sign-in and sign-up**: header hidden, `ModalCloseButton` at the top end. A `3:2` photo band
on top, edge to edge (a reused image). Then the app name in `label`, a `title` ("Sign *in*"),
square fields with `label` text, the error line, a primary button, and a ghost switch button.

**Onboarding** (setup facts only, at most 3 screens): "01 / 03" in `numeral` (`text-2xl
leading-8 text-foreground`), the question as a `title`, options as index rows with a square
box (`size-5 border border-foreground`; checked: `bg-accent` with a `checkmark` in
`accent-accent-foreground`).

**Home, first run** (no products yet):

- H1 Front page: a masthead row (the name in `title`, the bag icon at the end), a double rule
  (`border-t-2 border-foreground`, then `mt-0.5 border-t`), the date in `label`. Then the
  lead plate, "New *in*" with a rail, and "The *index*". With no photo, the lead is a hero
  gradient block with a `display` line in `text-hero-foreground` (its italic word too).
  First run: "New *in*" holds a get-started index ("01 Add your first product", "02 Add a
  department", "03 Set your shipping") that opens the create flows, and a `label` line "0
  products · 0 orders".
- H2 Catalogue: the title, a text tab row of departments (`label` style; the active one
  `text-foreground` with a `h-0.5 bg-foreground` line; one object maps the two states), then
  the plate grid. First run: a `label` line "0 products", and 4 empty `bg-surface-secondary`
  cells numbered 01 to 04 in `numeral` (`text-5xl leading-[52px]`); the first holds an `add`
  icon and "Add a product" and opens the create flow.

**Lists**: the index, or product rows with a `w-[72px]` plate photo, a 1 px rule between.

**Detail**: a paged `FlatList` of edge-to-edge photos with "1 / 4" in `label`, the name in
`title`, the price, the options as square boxes (`h-12 min-w-12 border border-border`;
chosen: box `bg-accent`, text `text-accent-foreground`), the description, "Details" and "Fit"
as index rows, then the add bar. **Bag**: index rows with a square stepper (`size-9 border`),
a totals table with 1 px rules, and the bar for "Checkout" with the real total.

**Empty state art**: the blank plate, an `Svg` of 120 x 150: a 1 px ink `Rect`, two
diagonals at `strokeOpacity={0.18}`, a 10 px terracotta square at the top end corner, and the
outline icon on a `size-12 bg-background` square in the center.

**Tab bar**: `tabBarStyle: { borderTopWidth: StyleSheet.hairlineWidth }`, active tint
`foreground`, `tabBarLabelStyle: { textTransform: "uppercase", letterSpacing: 1.4,
fontSize: 11 }`; in Arabic (`useT().dir === "rtl"`) only `{ fontSize: 11 }`. The active icon
is the filled name, the inactive one `<name>-outline`. The bag tab: a square `accent` badge
with the real count in `accent-foreground`, none at 0.

## 7. Motion

Slow and quiet, like a page that turns. No bounce.

- Entry: `FadeIn.duration(420)` on text blocks, `.delay(index * 80)` for the first 3 only.
- Plate reveal: an `Animated.View` `absolute inset-x-0 bottom-0 bg-background` covers the
  photo. A CSS animation in its `style` shrinks its `height` from `"100%"` to `"0%"`,
  `"700ms"`, `"ease-in-out"`. No effect hook. Only the first 2 plates of a screen. W1: the
  photo fades in over 900 ms. No zoom.
- Plates: `AppPressable` with scale `0.98`.
- Add bar: `SlideInDown.duration(360)` on an outer `Animated.View`. On add:
  `successFeedback()`, and the label swaps to "Added" with a `checkmark` for 1600 ms (`FadeIn`,
  `FadeOut`; the add handler starts the timeout). A size: `tapFeedback()`.
- `useReducedMotion()` true: no cover View, no slide, only `FadeIn.duration(200)`.

## 8. Imagery

`generate_image` with `aspect` `2:3` (cover), `4:5` or `1:1` (plate), `3:2` (band); path
`src/assets/<name>.png`, then `require()` the returned path with a fixed relative string.

Prompt model: "Editorial still-life photograph of [the subject of the store: a stack of
clothbound books / a wool coat folded on a wooden stool], on an ivory paper backdrop, soft
side daylight, one long soft shadow, muted palette with one terracotta object, medium format
film look, no people, no text, no logos."

- At most 3 images in the first build. W3 uses all 3; H1 reuses one.
- Generated images are mood only: never generate a product to sell. No close-up faces.

## 9. Bans

- No rounded corners, pills, shadows, or card boxes around products.
- No text on a photo. No price, discount, rating, or "bestseller" tag the data does not hold.
- No second accent, no gradient on a button, no sale red.
- No bold serif, no italic line, no second italic word, no italic in Arabic.
- No emoji, no icon in a circle. No real store or magazine name, masthead, or layout.

## 10. Self-check

1. Light is ivory with ink; dark is warm ink with ivory text. Every corner is square.
2. Every title is Instrument Serif with one `italic` word; index numbers use `numeral`; all
   other UI text is Inter Tight.
3. Photos run edge to edge with the caption under them, never on them.
4. Departments and orders are numbered 01, 02, 03.
5. The product screen has the terracotta add bar with the real price.
6. The home uses H1 or H2 with real numbers only; the first run shows the get-started index
   or the numbered empty cells.
