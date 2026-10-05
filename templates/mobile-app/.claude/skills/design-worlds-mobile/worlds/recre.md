# Récré — the school yard when the bell rings

`recre` · loud · light only · best for: education, school, kids learning, language learning,
quizzes, tutoring, flashcards · avoid for: finance, clinic, luxury, nightlife, beauty

## 1. Feel

The bell rings and the yard fills with sun. A bright sky page holds blocks that a thumb wants
to press: every button has a thick edge and sinks under the finger. Stickers sit tilted
on the cards, like on a school folder. A timetable card fills with teacher stamps, one lesson
at a time. Sky, sunflower, and grass, with navy ink. Loud and happy, never messy.

Voice: a kind teacher. A verb first ("Start lesson", "Check", "Try again"). Short, true
praise ("8 of 10 right"). One exclamation mark at most, on a success.

## 2. World law and client choices

World law, the same in every Récré app:

- Pale sky page, white blocks (`bg-surface`), navy ink. Sky (`accent`) marks the primary
  action and the current step, sunflower marks rewards, grass marks done. Red only for errors.
- Baloo 2 for all text: 800 for display and numbers, 700 for buttons and headings.
- Chunky material: a 2 px border and a 4 px lower edge in a darker tone. Corners 20 px on
  cards and buttons. `--radius` is `0.4rem`: HeroUI multiplies it by 3, and the `rounded-*`
  scale follows it, so screens write `rounded-[20px]`.
- Signatures: the chunky press, the tilted sticker, the timetable with stamps, and the pencil
  buddy (optional).
- Light only: `"userInterfaceStyle": "light"`. The dark block holds the light values.

Client choices: the welcome (W1, W2, W3) and the home (H1, H2); the pencil buddy on or off (a
name only from the brief); the subject icons (`book`, `calculator`, `globe`, `musical-notes`,
`flask`, `language`); the step word (lesson, level, chapter, week).
Two Récré apps never share the same welcome and home composition.

## 3. Tokens

```css
@theme {
	--field-border-width: 2px;
	--radius: 0.4rem;
}

@theme static {
	--font-normal: "Baloo2_400Regular";
	--font-medium: "Baloo2_500Medium";
	--font-semibold: "Baloo2_600SemiBold";
	--font-bold: "Baloo2_700Bold";
	--font-display: "Baloo2_800ExtraBold";
}

@theme static {
	--color-sky-edge: var(--sky-edge);
	--color-sun: var(--sun);
	--color-sun-edge: var(--sun-edge);
	--color-grass: var(--grass);
	--color-grass-edge: var(--grass-edge);
}

@layer theme {
	:root {
		@variant light {
			--background: #f1f8ff;
			--foreground: #0f2747;
			--surface: #ffffff;
			--surface-foreground: #0f2747;
			--surface-secondary: #e4f1fc;
			--surface-tertiary: #d3e6f7;
			--overlay: #ffffff;
			--muted: #4a6382;
			--accent: #0a72cc;
			--accent-foreground: #ffffff;
			--default: #e4eef8;
			--default-foreground: #0f2747;
			--border: #cfe0f0;
			--separator: #e1ecf6;
			--field-background: #ffffff;
			--field-border: #bfd5ea;
			--field-placeholder: #7890ab;
			--color-default-hover: #d7e5f3;
			--success: #16803c;
			--success-foreground: #ffffff;
			--warning: #ffc531;
			--warning-foreground: #3d2a00;
			--danger: #d7263d;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #0f2747;
			--focus: #0a72cc;
			--hero-start: #8ad4ff;
			--hero-end: #3db2f5;
			--hero-foreground: #0f2747;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 4px 0 0 rgba(15, 39, 71, 0.12);
			--field-shadow: 0 0 0 0 transparent inset;
			--sky-edge: #08589e;
			--sun: #ffc531;
			--sun-edge: #d9970b;
			--grass: #45c35f;
			--grass-edge: #2c9a45;
		}

		@variant dark {
			--background: #f1f8ff;
			--foreground: #0f2747;
			--surface: #ffffff;
			--surface-foreground: #0f2747;
			--surface-secondary: #e4f1fc;
			--surface-tertiary: #d3e6f7;
			--overlay: #ffffff;
			--muted: #4a6382;
			--accent: #0a72cc;
			--accent-foreground: #ffffff;
			--default: #e4eef8;
			--default-foreground: #0f2747;
			--border: #cfe0f0;
			--separator: #e1ecf6;
			--field-background: #ffffff;
			--field-border: #bfd5ea;
			--field-placeholder: #7890ab;
			--color-default-hover: #d7e5f3;
			--success: #16803c;
			--success-foreground: #ffffff;
			--warning: #ffc531;
			--warning-foreground: #3d2a00;
			--danger: #d7263d;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #0f2747;
			--focus: #0a72cc;
			--hero-start: #8ad4ff;
			--hero-end: #3db2f5;
			--hero-foreground: #0f2747;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 4px 0 0 rgba(15, 39, 71, 0.12);
			--field-shadow: 0 0 0 0 transparent inset;
			--sky-edge: #08589e;
			--sun: #ffc531;
			--sun-edge: #d9970b;
			--grass: #45c35f;
			--grass-edge: #2c9a45;
		}
	}
}
```

Text on `bg-sun` and `bg-grass` is `text-foreground`. Text on `bg-accent`, `bg-success`, and
the hero is `text-accent-foreground`, `text-success-foreground`, and `text-hero-foreground`.
`app.json`: splash and adaptive icon `backgroundColor` `#F1F8FF`, `<StatusBar style="dark" />`.

## 4. Type

`npx expo install @expo-google-fonts/baloo-2`

```ts
import { Baloo2_400Regular } from "@expo-google-fonts/baloo-2/400Regular";
import { Baloo2_500Medium } from "@expo-google-fonts/baloo-2/500Medium";
import { Baloo2_600SemiBold } from "@expo-google-fonts/baloo-2/600SemiBold";
import { Baloo2_700Bold } from "@expo-google-fonts/baloo-2/700Bold";
import { Baloo2_800ExtraBold } from "@expo-google-fonts/baloo-2/800ExtraBold";

export const appFonts = {
	Baloo2_400Regular,
	Baloo2_500Medium,
	Baloo2_600SemiBold,
	Baloo2_700Bold,
	Baloo2_800ExtraBold,
};
```

Set these roles in `app-text.tsx`. Line height is 1.2 times the size or more: Android cuts the
tall Baloo letters.

- `display`: `font-display text-5xl leading-[58px] tracking-tight text-foreground`.
- `title`: `font-display text-[32px] leading-[40px] tracking-tight text-foreground`.
- `heading`: `font-bold text-xl leading-7 text-foreground`.
- `body`: `font-normal text-[17px] leading-7 text-foreground`.
- New `label`: `font-bold text-[13px] leading-5 uppercase tracking-wider text-muted`.
- New `numeral` for every count, score, and step number: `font-display text-2xl leading-8
  tabular-nums text-foreground`. Never add `font-display` to text of another role.
- Arabic twin: `npx expo install @expo-google-fonts/baloo-bhaijaan-2`. The four weights take
  `BalooBhaijaan2_400Regular` to `_700Bold`; `--font-display` takes
  `BalooBhaijaan2_800ExtraBold`. Drop `uppercase` and `tracking-wider` from `label` in Arabic.

```ts
import { BalooBhaijaan2_400Regular } from "@expo-google-fonts/baloo-bhaijaan-2/400Regular";
import { BalooBhaijaan2_500Medium } from "@expo-google-fonts/baloo-bhaijaan-2/500Medium";
import { BalooBhaijaan2_600SemiBold } from "@expo-google-fonts/baloo-bhaijaan-2/600SemiBold";
import { BalooBhaijaan2_700Bold } from "@expo-google-fonts/baloo-bhaijaan-2/700Bold";
import { BalooBhaijaan2_800ExtraBold } from "@expo-google-fonts/baloo-bhaijaan-2/800ExtraBold";
```

## 5. Signatures

1. **The chunky press.** Add `AppChunkyButton` (`src/shared/ui/chunky-button.tsx`): an
   `AppPressable` with `animation={false}` and `h-[60px]`. Inside: the edge `absolute
   inset-x-0 top-1 bottom-0 rounded-[20px]`, and the face `Animated.View` `h-14 items-center
   justify-center rounded-[20px] px-6` with `translateY: drop.value * 4`. `onPressIn`:
   `withTiming(1, { duration: 60 })` and `tapFeedback()`; `onPressOut`: back to 0 in 120 ms.
   One object maps each tone to full classes, face / edge / label: sky `bg-accent` /
   `bg-sky-edge` / `text-accent-foreground`; sun `bg-sun` / `bg-sun-edge` / `text-foreground`;
   grass `bg-grass` / `bg-grass-edge` / `text-foreground`; plain `bg-surface border-2
   border-border` / `bg-border` / `text-accent`; disabled (`isDisabled`) `bg-default` /
   `bg-border` / `text-muted`. Static chunky card: `rounded-[20px] border-2 border-b-4
   border-border bg-surface`.
2. **The tilted sticker.** Outer `self-start rotate-[-6deg] rounded-[14px] bg-sun-edge
   pb-[3px]`, inner `rounded-[14px] border-[3px] border-surface bg-sun px-3 py-0.5`, text
   `font-bold text-sm`. One real word, number, or icon. Tilt `rotate-[-6deg]`, `rotate-[4deg]`,
   or `rotate-[-3deg]`. At most 2 per screen. On a card corner: `absolute -top-3 end-3` in a
   `relative` wrapper View, beside the card. Never inside an `AppPressable`: its root clips
   (`overflow: hidden`).
3. **The timetable.** The steps of a unit on a static chunky card. Header: the unit in
   `label`, a real count ("2 / 6") in `numeral`. Each row is an `AppPressable` `flex-row
   items-center gap-3 px-4 py-3` that opens its step, split by `h-0.5 bg-separator`: a square
   `size-12 items-center justify-center rounded-[14px]` with the number in `numeral`, the title
   in `heading` over a real `caption` ("8 questions"), an end mark. One object maps each state
   to full classes. Done: `bg-grass` square, the stamp. Current: row `bg-accent/10`,
   `bg-accent` square with `text-accent-foreground`, "Start" in `label` `text-accent`. Locked:
   `bg-default` square, `text-muted`, `lock-closed` (`accent-muted`), `isDisabled`. The stamp:
   `Svg width={44} height={44}` in a `rotate-[-12deg]` View: rings r 20 and r 15 (dashed) and
   a check, in grass-edge.
4. **The pencil buddy (optional).** `PencilBuddy` (`src/shared/ui/pencil-buddy.tsx`), props
   `mood` (`idle`, `happy`, `thinking`, `shy`) and `size` (height). `Svg height={size}
   width={(size * 4) / 7}`, `viewBox="0 0 80 140"`. Body `Rect` 52 x 86 at (14, 22), rx 12,
   sun over a sun-edge copy 5 px lower. Eraser 52 x 24 at (14, 4), rx 12, grass, with an 8 px
   grass-edge band at y 22. A paper tip (y 104 to 138) with an ink lead. Paper eyes 16 x 18
   at (29, 54) and (51, 54), ink pupils r 4.5: thinking lifts them 4 px, happy draws arcs, shy
   draws 12 px lines. Mouth `M32 74Q40 81 48 74`, stroke 4; happy fills a wide smile. Colors:
   `useCSSVariable(["--color-sun", "--color-sun-edge", "--color-grass", "--color-grass-edge",
   "--color-surface", "--color-foreground"])`; paper is surface, ink is foreground. Buddy off:
   each recipe puts a block of the same height there (`aspect-square rounded-[28px] bg-sun`
   with the subject icon).

## 6. Screens

**Welcome**: a `View className="flex-1 bg-background"`, not `Screen`, with an
`AppSafeAreaView` inside for the text and the buttons. Pick one:

- W1 Sky stage: the top 58 % is a panel `rounded-b-[40px] bg-linear-to-b from-hero-start
  to-hero-end` with 2 SVG clouds and a grass hill. The buddy (168 px) stands on the hill
  between 2 stickers. Below: the name in `display`, one line, a sky "Get started", and a
  plain "I have an account".
- W2 Timetable teaser: a timetable card at `rotate-[-3deg]`, 3 rows of art (done, current,
  locked; icons and `h-3 rounded-full bg-surface-tertiary` bars, no text), the buddy (96 px)
  at its end. Then the `display` title; one phrase is a message parameter on a highlighter
  (a nested `<AppText variant="display" className="bg-sun">`).
- W3 Pencil case: on `bg-surface-secondary`, 3 chunky bars (`h-[72px]`, 5 px edge) cross the
  top half at `rotate-[-10deg]` and run off both sides (`-mx-10`): sky with the subject icons,
  sunflower with SVG ruler ticks every 12 px, grass with the buddy peeking over it.

**Sign-in and sign-up**: header hidden, `ModalCloseButton` at the top end. A `h-[200px]`
hero panel (`rounded-b-[32px]`) holds the buddy (112 px): `thinking` on the email field,
`shy` on a password field, `happy` after sign-in. Then a `title`, the fields with `label`
text, the error line, a sky chunky button, and a plain chunky switch.

**Onboarding** (setup facts only: name, level, daily goal): at most 3 screens. On top, the
goal bar `h-4 rounded-full bg-default` with a `bg-grass` fill. The buddy (64 px) asks in a
bubble `rounded-[20px] border-2 border-border bg-surface p-4`. Answers are plain chunky
cards; the chosen one gets `border-accent bg-accent/10`.

**Home, first run** (no rows yet):

- H1 Timetable home: 2 stickers with real values (stars, steps done; 0 at first), then the
  timetable. With no lessons yet, it holds 3 setup steps ("Add a class", "Add a student",
  "Plan a lesson"); the first is current, and each opens its create flow.
- H2 Desk: a hero `View` `rounded-[28px] bg-linear-to-br from-hero-start to-hero-end p-5`:
  the date (`caption`) and a greeting (`title`), both `text-hero-foreground`, and the goal
  bar ("0 / 3" from data). The buddy (88 px) peeks at `absolute -bottom-4 end-2`, inner
  `rotate-[8deg]`. Below, chunky subject tiles (a 48 px colored square, the name, a `numeral`
  count). First run: an "Add a subject" tile and a "Get started" card with 3 numbered rows.

**Quiz**: the goal bar, the question in `title`, chunky answer cards, a pinned "Check". The
chosen card shows the result: right `border-grass bg-grass/15` and "Correct" in
`text-success`; wrong `border-danger bg-danger/10`, and the right card turns grass. "Check"
becomes "Continue". **Result**: the happy buddy, the real score in `numeral`, and 2 stickers.

**Lists**: `AppListGroup` rows, each with a `size-12 rounded-[14px]` subject-color square. **Detail**: a hero panel with a `size-28` sticker, the timetable, a pinned "Start".

**Empty state art**: two SVG books (`Rect` 110 x 22, rx 6), sky at -6 deg and grass at 4 deg,
with the `thinking` buddy (96 px) on top.

**Tab bar**: `tabBarStyle: { borderTopWidth: 2 }`, `borderTopColor` from
`useThemeColor("border")`, `tabBarLabelStyle: { fontSize: 13 }`. The focused icon is the
filled name on `rounded-[14px] bg-accent/10 px-4 py-1`; the others are `<name>-outline`.

## 7. Motion

- Entry: `FadeInUp.springify().damping(14)`, `.delay(index * 70)` for the first 5 blocks.
  Stickers and a new stamp: `ZoomIn.springify().damping(10)`. A tilted block takes two views:
  the outer `Animated.View` gets `entering` or a loop, the inner View keeps `rotate-*`.
- Buddy bob: a CSS animation in `style` (`translateY` 0 to -6 px, `"1800ms"`, `"infinite"`,
  `"alternate"`, `"ease-in-out"`). Happy swaps the keyframes for one jump (0, -24, 0, -6, 0
  px, 700 ms, 1 iteration); its handler calls `successFeedback()`. W1 clouds: the same loop
  on `translateX`, -12 to 12 px, 6000 ms.
- Wrong answer: one shake (-8, 8, -6, 6, 0 px, 50 ms each), `withSequence` in the "Check"
  handler. Tiles: `AppPressable` scale `0.96`.
- `useReducedMotion()` true: no bob, cloud drift, shake, or jump. The chunky drop stays.

## 8. Imagery

SVG first. `generate_image` only for subject art on a detail panel: `aspect` `1:1`, path
`src/assets/<name>.png`, then `require()` the returned path with a fixed relative string.

Prompt model: "Flat die-cut sticker illustration of [subject of the app: an open book with a
pencil / a globe with a speech bubble], thick white outline, flat sky blue, sunflower yellow
and grass green fills, navy lines, plain white background, no text, no letters, no logos."

- At most 2 images in the first build. No photos of children, no 3D renders.

## 9. Bans

- No dark mode, no gradient on a button, no glass, no soft shadow: the edge replaces it.
- No owl, bird, animal, or blob mascot. No winding path of lesson nodes, no round coin nodes,
  no streak flame. No copy of a known learning app.
- No icon in a grey circle, no emoji, no text under 13 px.
- No fake streaks, scores, or ranks: every number comes from the data, and 0 is fine.

## 10. Self-check

1. The app opens light, also on a phone in dark mode. All text is Baloo 2, through the roles.
2. Every primary action is a chunky button that sinks 4 px under the finger.
3. Each screen has at most 2 stickers, tilted 3 to 6 deg, never inside a pressable.
4. The home uses H1 or H2 with real numbers and 0 at first; the first run shows the 3 setup
   rows of the timetable or the "Get started" card.
5. Progress is the timetable with stamps. When the buddy is on, its mood follows the screen
   state. Reduced motion stops every loop.
