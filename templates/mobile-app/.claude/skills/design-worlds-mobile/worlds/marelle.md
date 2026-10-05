# Marelle — stickers on the fridge door

`marelle` · loud · light and dark · best for: kids activities, family organizer, parents,
daycare, babysitting, pets, pet care, birthdays, party planning · avoid for: finance, clinic,
legal, luxury, nightlife, back-office

## 1. Feel

A fridge door full of stickers, a hopscotch in chalk. Bubblegum, mint, and lemon on milk
white, every word in plum ink. Faces and pets are round stickers with a thick white edge, a
little crooked, as a child sticks them. Lines wave. Things bounce in. At night: deep plum,
and the candy glows.

Voice: a kind older sibling. Short, warm, concrete: "Who does pickup today?", "Add a
birthday". No baby talk, no emoji (Ionicons only).

## 2. World law and client choices

World law, the same in every Marelle app:

- Milk ground, plum ink, one bubblegum accent for actions. The candy fills (bubblegum, mint,
  lemon) color tiles, stickers, and confetti only.
- Fredoka for every text. Display and big numbers in Fredoka bold.
- Soft and round: `--radius: 0.625rem` (cards 30 px, fields 17.5 px, buttons are pills).
- Signatures: the sticker, the wave, the confetti (section 5), and bouncy springs.
- `"userInterfaceStyle": "automatic"`. Dark mode is deep plum, never grey or black.

Client choices, decided fresh for each app: the welcome (W1, W2, W3), the home (H1, H2), the
lead number (plans today, tasks left), and the sticker icons (paw, gift, school).

Two Marelle apps never share the same welcome and home composition.

## 3. Tokens

Keep the imports and the hero `@theme static` color block of the template. Replace the rest:

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.625rem;
}

@theme static {
	--font-normal: "Fredoka_400Regular";
	--font-medium: "Fredoka_500Medium";
	--font-semibold: "Fredoka_600SemiBold";
	--font-bold: "Fredoka_700Bold";
	--font-display: "Fredoka_700Bold";
}

/* Candy fills, their ink, and the sticker edge. */
@theme static {
	--color-bubblegum: var(--bubblegum);
	--color-mint: var(--mint);
	--color-lemon: var(--lemon);
	--color-tile-ink: var(--tile-ink);
	--color-sticker: var(--sticker);
}

@layer theme {
	:root {
		@variant light {
			--background: #fff8f3;
			--foreground: #3a1c4a;
			--surface: #ffffff;
			--surface-foreground: #3a1c4a;
			--surface-secondary: #fdefea;
			--surface-tertiary: #f8e3ec;
			--overlay: #ffffff;
			--muted: #7a5c86;
			--accent: #c8296a;
			--accent-foreground: #ffffff;
			--default: #f6e6f0;
			--default-foreground: #3a1c4a;
			--border: #3a1c4a1a;
			--separator: #3a1c4a12;
			--field-background: #ffffff;
			--field-border: #3a1c4a2e;
			--field-placeholder: #a58fae;
			--color-default-hover: #efd9e7;
			--success: #6fd6a8;
			--success-foreground: #3a1c4a;
			--warning: #ffd84d;
			--warning-foreground: #3a1c4a;
			--danger: #c0392b;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #3a1c4a;
			--focus: #c8296a;
			--hero-start: #ffc2d9;
			--hero-end: #ffe58f;
			--hero-foreground: #3a1c4a;
			--surface-shadow: 0 12px 24px -14px rgba(200, 41, 106, 0.28);
			--overlay-shadow: 0 16px 36px -14px rgba(58, 28, 74, 0.3);
			--field-shadow: 0 0 0 0 transparent inset;
			--bubblegum: #ffc9dd;
			--mint: #bff0d9;
			--lemon: #ffeb99;
			--tile-ink: #3a1c4a;
			--sticker: #ffffff;
		}

		@variant dark {
			--background: #1f0f2a;
			--foreground: #ffeff6;
			--surface: #2a1638;
			--surface-foreground: #ffeff6;
			--surface-secondary: #331c44;
			--surface-tertiary: #3e2452;
			--overlay: #2e1940;
			--muted: #c7a9d2;
			--accent: #ff8fb8;
			--accent-foreground: #1f0f2a;
			--default: #3a2150;
			--default-foreground: #ffeff6;
			--border: #ffeff61a;
			--separator: #ffeff612;
			--field-background: #2a1638;
			--field-border: #ffeff62e;
			--field-placeholder: #9f86ab;
			--color-default-hover: #452a5c;
			--success: #7fe0b8;
			--success-foreground: #1f0f2a;
			--warning: #ffe07a;
			--warning-foreground: #1f0f2a;
			--danger: #ff7a59;
			--danger-foreground: #1f0f2a;
			--segment: #46295e;
			--segment-foreground: #ffeff6;
			--focus: #ff8fb8;
			--hero-start: #5a2a6e;
			--hero-end: #2b1240;
			--hero-foreground: #ffeff6;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 239, 246, 0.18) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--bubblegum: #ffa6c9;
			--mint: #9de8c6;
			--lemon: #ffe27a;
			--tile-ink: #2a1236;
			--sticker: #fff4f9;
		}
	}
}
```

Candy fills take `text-tile-ink` (9:1). `app.json`: splash
`backgroundColor` `#FFF8F3`, dark splash `#1F0F2A`, `android.adaptiveIcon.backgroundColor` `#FFF8F3`.

## 4. Type

`npx expo install @expo-google-fonts/fredoka`

```ts
import { Fredoka_400Regular } from "@expo-google-fonts/fredoka/400Regular";
import { Fredoka_500Medium } from "@expo-google-fonts/fredoka/500Medium";
import { Fredoka_600SemiBold } from "@expo-google-fonts/fredoka/600SemiBold";
import { Fredoka_700Bold } from "@expo-google-fonts/fredoka/700Bold";

export const appFonts = {
	Fredoka_400Regular,
	Fredoka_500Medium,
	Fredoka_600SemiBold,
	Fredoka_700Bold,
};
```

- `display` in `app-text.tsx`: `font-display text-5xl leading-[1.05] tracking-tight
  text-foreground`. `title` keeps the template string (`text-3xl`).
- Add a `label` role: `font-semibold text-[13px] tracking-wide text-muted`. No capitals.
- The lead number: `display` with `text-7xl leading-none tabular-nums`.
- Arabic twin: `npx expo install @expo-google-fonts/marhey @expo-google-fonts/baloo-bhaijaan-2`.
  `--font-display` is `Marhey_700Bold`; `--font-normal` to `--font-bold` take the Baloo
  Bhaijaan 2 400 to 700 keys below. Drop `tracking-*` in Arabic.

```ts
import { BalooBhaijaan2_400Regular } from "@expo-google-fonts/baloo-bhaijaan-2/400Regular";
import { BalooBhaijaan2_500Medium } from "@expo-google-fonts/baloo-bhaijaan-2/500Medium";
import { BalooBhaijaan2_600SemiBold } from "@expo-google-fonts/baloo-bhaijaan-2/600SemiBold";
import { BalooBhaijaan2_700Bold } from "@expo-google-fonts/baloo-bhaijaan-2/700Bold";
import { Marhey_700Bold } from "@expo-google-fonts/marhey/700Bold";
```

## 5. Signatures

Write every class in full: Uniwind finds only complete class strings in the source.

```ts
/** Picked by row index: index % length. */
const TILTS = ["-rotate-6", "rotate-3", "-rotate-2", "rotate-6"] as const;
const CANDY = ["bg-bubblegum", "bg-mint", "bg-lemon"] as const;
```

1. **The sticker.** A round View `rounded-full border-4 border-sticker shadow-surface`, tilted
   from `TILTS`. Inside: the real photo (`<Image className="size-full rounded-full"
   resizeMode="cover" />`) or `initialsOf(name)` as `display` text in `text-tile-ink` (size to
   fit: `text-base` on `size-11`) on a `CANDY` fill. Sizes: `size-11` on rows (`border-[3px]`),
   `size-14` in headers, `size-28` and up on heroes (`border-[6px]`). People, pets, and
   categories are stickers.
2. **The wave.** The wave edge ends a hero: `<View className="absolute inset-x-0 bottom-0
   h-[18px]">`, `<Svg width="100%" height={18} viewBox="0 0 240 18" preserveAspectRatio="none">`,
   `<Path d={"M0 9 q6 -9 12 0" + " t12 0".repeat(19) + " V18 H0 Z"} fill={background} />`
   (`useThemeColor("background")`). The wavy underline: an `Svg` `width={120} height={10}`
   under a section title, `d={"M2 5 q5 -5 10 0" + " t10 0".repeat(10)}`, `strokeWidth={3}`,
   round caps, no fill, a candy stroke from `useCSSVariable(["--color-mint"])`.
3. **The confetti.** 10 to 14 fixed pieces on a hero, never random: a layer `absolute inset-0`
   with `pointerEvents="none"` and pieces from one constant list, for example
   `"start-[8%] top-[14%] size-2.5 rounded-full bg-accent"` and
   `"start-[40%] top-[6%] h-1.5 w-4 rotate-[30deg] rounded-full bg-lemon"`.

## 6. Screens

**Welcome**: a `flex-1` View, not `Screen`, with an `AppSafeAreaView` inside for the text and
the buttons. Pick one:

- W1 Sticker pile: a hero `flex-1 min-h-[380px] bg-linear-to-b from-hero-start to-hero-end`
  with confetti and the wave edge. In it, 4 overlapped icon stickers placed absolute
  (`size-24` to `size-36`, `border-[6px]`, candy fills, tilts), each an Ionicons glyph of the
  app (`colorClassName="accent-tile-ink"`). Below, `px-6 pb-10 gap-3`: the app
  name as `display`, the wavy underline, one `text-muted` line, the primary button, and a
  ghost "I have an account".
- W2 Hopscotch: centered. From the top: a "sky" tile `h-[72px] w-[152px]
  rounded-t-full bg-accent` with a `heart` icon, then rows [4], [2 3], [1] of `size-[72px]
  rounded-[22px]` candy tiles with small tilts and the digit in `display text-3xl
  text-tile-ink`. Then the app name, the wavy underline, the promise, and the buttons.
- W3 Big sticker: confetti on the top half, a `size-64 self-center -rotate-6 border-8
  shadow-overlay` sticker with the generated image, and a `size-20 rotate-12 bg-lemon` star
  sticker on its corner (`absolute -end-2 -top-2`). Then the title and the buttons.

**Sign-in and sign-up**: `Screen` with `gap-5`: three overlapped icon stickers `size-14`
(`-ms-3` from the second), the `display` title, the wavy underline, the fields, the primary
pill, and the ghost switch.

**Onboarding** (setup facts only, for example the members): one question per screen, at
most 4. Progress: hopscotch squares `size-3 rounded-[4px]`, done ones in candy and
tilted. Options: `rounded-[28px] border-2 border-border bg-surface p-4 flex-row gap-3` with a
`size-12` icon sticker; selected: `border-accent` and a check sticker.

**Home, first run** (no rows yet):

- H1 Fridge board: the date (`label`), `display` "Hi, {name}". Member stickers `size-14` from
  data and a dashed sticker `border-2 border-dashed border-muted` with
  `add`. The today card: `AppPressable`, `overflow-hidden rounded-[32px] bg-linear-to-br
  from-hero-start to-hero-end px-6 pt-6 pb-10`, confetti, the wave edge, a `label`
  (`text-hero-foreground/80`), the lead number (a real 0, `text-hero-foreground`), a primary
  button. "Get started": 3 tiles in a row, `size-24 rounded-[24px] p-3`, `CANDY` fills, a digit
  in `display text-3xl text-tile-ink`, a short `label` in `text-tile-ink`. Each opens a create
  flow; a done tile gets a `size-7` check sticker on its corner.
- H2 Week of stickers: a `title` and the member stack (`-ms-2`). A week strip of 7 days `h-16
  w-11 rounded-full items-center justify-center`; the selected day is a sticker (`bg-accent
  border-[3px] border-sticker -rotate-3`, text `text-accent-foreground`); a 6 px candy dot marks a day with events. The day
  plan: cards `rounded-[28px] p-4 flex-row gap-3` in the candy of the category, all text in
  `text-tile-ink`: the time in `heading text-lg`, the title, the person's sticker at the end.
  First run: a card "Nothing planned" and 3 starter chips for real create actions.

**Lists**: `AppListGroup` on `bg-surface`. Leading: a `size-11` sticker. Trailing: a chip
`rounded-full bg-mint px-3 py-1` with a real state word in `text-tile-ink`, or the chevron,
flipped in RTL. Group heads: `heading` and the wavy underline.

**Detail**: a full-bleed hero `-mx-5 -mt-5 items-center bg-linear-to-br from-hero-start
to-hero-end pt-8 pb-12` with confetti, the wave edge, and a `size-36` sticker. Then the name
(`display text-4xl`), fact chips from real fields, `AppCard` sections, a pinned action.

**Empty state art**: a `h-36 w-40` box with 3 overlapped stickers (`size-20` bubblegum
`-rotate-6`, `size-24` mint `rotate-3`, `size-16` lemon `rotate-12`), the outline icon in the
middle one (`colorClassName="accent-tile-ink"`), and 5 confetti dots.

**Tab bar**: `tabBarShowLabel: false` (the `title` stays the accessible name), `tabBarStyle`
with `borderTopWidth: 0`. `tabBarBackground` renders `<View className="flex-1 bg-surface">`
with a wavy top line: an `Svg` `width="100%" height={10}` with a `Pattern` 24 x 10 (id from
`useId()`, colons removed) that repeats `M0 5 q6 -5 12 0 t12 0`, bubblegum stroke,
`strokeWidth={2.5}`. Inactive: `<name>-outline`. Active: the filled name (`size={18}`) in a
sticker `size-9 -rotate-6 items-center justify-center rounded-full border-[3px] border-sticker
bg-accent` (`colorClassName="accent-accent-foreground"`). At 36 px it stays inside the bar.

## 7. Motion

Bouncy, like a ball on a playground.

- Stickers: `ZoomIn.springify().damping(10).delay(index * 90)`. Cards and tiles:
  `FadeInDown.springify().damping(13).delay(index * 70)` on the first 5. Rows:
  `LinearTransition.springify().damping(16)`. Put `entering` on an outer `Animated.View` and
  the tilt on the inner sticker: an entering animation replaces the transform of its view.
- Press: `animation={{ scale: { value: 0.94 } }}`; `tapFeedback()` on a toggle or a day.
- Done: `successFeedback()`, the check sticker `ZoomIn.springify().damping(8)`, and a confetti
  pop from the done handler, not an effect: 8 dots spring to fixed offsets (`withSpring`) and
  fade over 700 ms.
- Idle wobble (W1): a middle `Animated.View`, between the `entering` view and the tilted
  sticker, runs a CSS loop: `animationName: { from: { transform: [{ rotate: "-2deg" }] }, to: {
  transform: [{ rotate: "2deg" }] } }`, `animationDuration: "2600ms"`,
  `animationIterationCount: "infinite"`, `animationDirection: "alternate"`,
  `animationTimingFunction: "ease-in-out"`.
- `useReducedMotion()` true: no wobble, no pop, plain `FadeIn.duration(200)`.

## 8. Imagery

Clay objects, never people. `generate_image`, `aspect` `1:1`, path
`src/assets/<name>.png`, shown in a round sticker; `require("../../../assets/<name>.png")`.

Prompt model: "A soft 3D clay render of [subject of the app: a birthday cake with three
candles / a sleeping puppy in a basket / a school backpack], chunky rounded shapes, candy
pastel pink, mint and lemon, plain flat pastel background, soft studio light, centered with
space around it, no text, no logos, no watermark."

- At most 2 images in the first build: the W3 sticker and one empty-state sticker.
- Never generate children, faces, or a family photo. A member or a pet shows its real photo
  or its initials, never a generated image.

## 9. Bans

- No black, no grey, no sharp corner, no hard black border, no offset shadow.
- No tilt on text, buttons, fields, or cards. Only stickers and hopscotch tiles tilt.
- At most 3 candy fills and the accent in one block. No confetti on a list.
- No emoji, no capitals, no baby talk, no candy-colored text.

## 10. Self-check

1. Milk by day, deep plum by night; text on candy fills is `text-tile-ink`.
2. Every text is Fredoka; display lines and big numbers use the `display` role.
3. People and pets are round stickers with a white edge and a tilt from `TILTS`.
4. Each hero block has the wave edge and confetti, and `text-hero-foreground` on it; section
   heads have the wavy underline.
5. The welcome is W1, W2, or W3; the home is H1 or H2, with real zeros and its "Get started"
   tiles or starter chips. Every number is real.
6. Stickers keep their tilt while they enter; the tab sticker stays inside the bar.
7. Reduced motion stops the wobble and the pop.
