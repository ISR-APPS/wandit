# Cadence — an orange ring that closes every morning

`cadence` · medium · light + dark · best for: habits, running, steps, water, nutrition log,
personal health, light fitness · avoid for: gym management, finance, beauty, kids, nightlife

## 1. Feel

A white kitchen at seven, running shoes by the door, one orange on the table. The app is a
quiet coach that counts. Each day is a ring that wants to close. Each week is a row of seven
dots. Numbers are big and light; headlines are short and heavy. Orange appears only where
progress happens. All else is ink on white, or white on graphite at night.

Voice: friendly and exact. A number, then a verb ("3 of 5 done", "Log water"). Praise is
short ("Ring closed."). No guilt: never "You missed", say "Start again today". No emoji.

## 2. World law and client choices

World law, the same in every Cadence app:

- White ground (graphite at night), ink text, one electric orange. Orange fills only the
  rings, the done dots, the primary button, the lit streak chip, and the hero card.
- Small orange text uses the extra token `text-accent-ink`, never `text-accent`.
- Lexend only: ExtraBold for headlines, Light for big numbers (the `numeral` role).
- `--radius: 1rem`: HeroUI buttons are full pills, fields 28 px. Tiles and lists are Views
  with `rounded-xl` (24 px), the hero card `rounded-2xl` (32 px). Not `AppCard` or
  `AppListGroup`: their own 48 px corner beats `rounded-xl` on the web.
- Three signatures: the ring, the week dots, the streak chip (section 5).

Client choices, decided fresh for each app:

- The welcome (W1, W2, or W3) and the home (H1 or H2) in section 6.
- The lead metric of the ring (steps, habits done, glasses, minutes) and its goal, from
  onboarding or the user's data. One ring, or three nested rings for three goals.

Two Cadence apps must never share the same welcome and home composition.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 1rem;
}

@theme static {
	--font-normal: "Lexend_400Regular";
	--font-medium: "Lexend_500Medium";
	--font-semibold: "Lexend_600SemiBold";
	--font-bold: "Lexend_700Bold";
	--font-display: "Lexend_800ExtraBold";
	--font-numeric: "Lexend_300Light";
}

@theme static {
	--color-accent-ink: var(--accent-ink);
}

@layer theme {
	:root {
		@variant light {
			--background: #ffffff;
			--foreground: #141413;
			--surface: #f6f6f3;
			--surface-foreground: #141413;
			--surface-secondary: #edede9;
			--surface-tertiary: #e3e3de;
			--overlay: #ffffff;
			--muted: #63625c;
			--accent: #ff4d00;
			--accent-foreground: #160b05;
			--default: #edede9;
			--default-foreground: #141413;
			--border: #1414131a;
			--separator: #14141312;
			--field-background: #f6f6f3;
			--field-border: #14141324;
			--field-placeholder: #85847e;
			--color-default-hover: #e3e3de;
			--success: #14804a;
			--success-foreground: #ffffff;
			--warning: #f5a524;
			--warning-foreground: #160b05;
			--danger: #d0261c;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #141413;
			--focus: #ff4d00;
			--hero-start: #ff4d00;
			--hero-end: #ff8a00;
			--hero-foreground: #160b05;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 12px 32px 0 rgba(20, 20, 19, 0.12);
			--field-shadow: 0 0 0 0 transparent inset;
			--accent-ink: #b73a00;
		}

		@variant dark {
			--background: #111110;
			--foreground: #f5f4f0;
			--surface: #1c1b19;
			--surface-foreground: #f5f4f0;
			--surface-secondary: #262522;
			--surface-tertiary: #31302c;
			--overlay: #1f1e1c;
			--muted: #a3a19a;
			--accent: #ff6a1f;
			--accent-foreground: #160b05;
			--default: #2a2926;
			--default-foreground: #f5f4f0;
			--border: #f5f4f01a;
			--separator: #f5f4f012;
			--field-background: #1c1b19;
			--field-border: #f5f4f026;
			--field-placeholder: #7e7c76;
			--color-default-hover: #33322e;
			--success: #3dd68c;
			--success-foreground: #160b05;
			--warning: #ffb547;
			--warning-foreground: #160b05;
			--danger: #ff6b5e;
			--danger-foreground: #160b05;
			--segment: #34332f;
			--segment-foreground: #f5f4f0;
			--focus: #ff6a1f;
			--hero-start: #ff5a14;
			--hero-end: #ffa21f;
			--hero-foreground: #160b05;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--accent-ink: #ff8b55;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#FFFFFF`, dark splash `#111110`,
`android.adaptiveIcon.backgroundColor` `#FF4D00`, `"userInterfaceStyle": "automatic"`.

## 4. Type

`npx expo install @expo-google-fonts/lexend`

```ts
import { Lexend_300Light } from "@expo-google-fonts/lexend/300Light";
import { Lexend_400Regular } from "@expo-google-fonts/lexend/400Regular";
import { Lexend_500Medium } from "@expo-google-fonts/lexend/500Medium";
import { Lexend_600SemiBold } from "@expo-google-fonts/lexend/600SemiBold";
import { Lexend_700Bold } from "@expo-google-fonts/lexend/700Bold";
import { Lexend_800ExtraBold } from "@expo-google-fonts/lexend/800ExtraBold";

export const appFonts = {
	Lexend_300Light,
	Lexend_400Regular,
	Lexend_500Medium,
	Lexend_600SemiBold,
	Lexend_700Bold,
	Lexend_800ExtraBold,
};
```

Roles in `app-text.tsx` (full strings, one face each):

- `display`: `font-display text-5xl leading-[52px] tracking-tighter text-foreground`, sentence
  case. `title`: `font-display text-3xl leading-9 tracking-tight text-foreground`.
- Add a `numeral` role: `font-numeric text-7xl leading-none tracking-tighter text-foreground`.
  Every count, distance, and duration uses it, never `font-numeric` on another role. The unit
  is a `caption`.
- Labels above a block: `caption` with `font-medium text-foreground`. No spaced capitals.
- A colored word in a `display` line is a message parameter (`{word}`), never a second
  message. Split the unfilled `t(key)` at `{word}` and nest the word as `<AppText
  variant="display" className="text-accent-ink">`.
- Arabic twin: `npx expo install @expo-google-fonts/readex-pro`. The four weights are
  `ReadexPro_400Regular`, `_500Medium`, `_600SemiBold`, `_700Bold`; `--font-display` is
  `ReadexPro_700Bold`; `--font-numeric` is `ReadexPro_300Light`. Drop `tracking-*`.

```ts
import { ReadexPro_300Light } from "@expo-google-fonts/readex-pro/300Light";
import { ReadexPro_400Regular } from "@expo-google-fonts/readex-pro/400Regular";
import { ReadexPro_500Medium } from "@expo-google-fonts/readex-pro/500Medium";
import { ReadexPro_600SemiBold } from "@expo-google-fonts/readex-pro/600SemiBold";
import { ReadexPro_700Bold } from "@expo-google-fonts/readex-pro/700Bold";
```

## 5. Signatures

1. **The ring.** Put `ProgressRing` in `src/shared/ui/progress-ring.tsx` and export it from the
   barrel. `progress` is 0 to 1: the caller passes `Math.min(done / goal, 1)`. A `-rotate-90`
   View holds the `Svg` (`width` and `height` props); the value sits in a sibling `absolute
   inset-0 items-center justify-center` layer. Track: a `Circle` in
   `useThemeColor("surface-tertiary")`. Above 0, add an `AnimatedCircle`
   (`Animated.createAnimatedComponent(Circle)`) in `accent`, `fill="none"`,
   `strokeLinecap="round"`. The draw is a one-shot CSS animation in `animatedProps`: SVG
   props go there, not in `style`. A new `progress` restarts it; no effect. An entering
   animation goes on a View outside the `-rotate-90` View.

   ```tsx
   const length = 2 * Math.PI * radius;
   const offset = length * (1 - progress);
   const draw = { animationName: { from: { strokeDashoffset: length }, to: { strokeDashoffset: offset } }, animationDuration: "900ms", animationTimingFunction: "ease-out" } as const;
   // JSX, plus cx, cy, r, fill, stroke, strokeWidth, strokeLinecap:
   <AnimatedCircle animatedProps={reduceMotion ? undefined : draw} strokeDasharray={length} strokeDashoffset={offset} />
   ```

   Sizes: hero 240 px (stroke 18), tile 64 (stroke 7), row 40 (stroke 4). Three goals: nested
   rings of 240, 196, and 152 px, stroke 16, in `accent`, `foreground`, and `muted`. Never a
   second hue.
2. **The week dots.** A `flex-row justify-between` row of 7 columns: the weekday from
   `Intl.DateTimeFormat(locale, { weekday: "narrow" })` as `caption`, over a `size-9
   rounded-full` dot. An object maps each state to its full classes. Done: `bg-accent` with a
   `checkmark` (16, `colorClassName="accent-accent-foreground"`). Today, open: `border-2
   border-accent`. Past, open: `bg-surface-tertiary`. Future: `border border-border`.
3. **The streak chip.** `flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5`.
   At 0: `bg-surface-secondary`, `flame-outline` (`colorClassName="accent-muted"`), "0 days"
   (a `{count}` message) as `caption`. From 1: `bg-accent`, `flame` icon
   (`colorClassName="accent-accent-foreground"`), and the count in `text-accent-foreground
   font-semibold`.

## 6. Screens

**Welcome** (signed-out start of an app with accounts). Pick one. W2 and W3 are full-bleed:
a `flex-1` View with the gradient or the photo, `AppSafeAreaView` inside for text and buttons.

- W1 Sunrise ring: the top 58 % holds a 300 px decorative ring (stroke 22, no number) that
  draws to 0.75, with the app icon (56, `colorClassName="accent-accent"`) inside. Then a
  two-line `display` with one word in `text-accent-ink` (a parameter, section 4), and a
  `caption`. Bottom `px-6 pb-8 gap-3`: `AppButton size="lg"` ("Get started") and a ghost "I
  have an account".
- W2 Orange week: full screen `bg-linear-to-b from-hero-start to-hero-end`, `<StatusBar
  style="dark" />`. Top: 7 dots `size-11 rounded-full bg-hero-foreground/15` that fill with
  `bg-hero-foreground` one by one. Then a `display text-6xl text-hero-foreground`. Bottom: an
  `AppPressable` pill `h-14 items-center justify-center rounded-full bg-hero-foreground`, label
  `font-semibold text-hero-start`, and a text link (`AppPressable`, `AppText` in
  `text-hero-foreground`).
- W3 Photo and badge: a high-key photo fills the top 55 % (`overflow-hidden rounded-b-[40px]`).
  A `size-28 rounded-full bg-background` badge overlaps its edge (`-mt-14 self-center`) with a
  96 px ring at 0.6. Then a centered `title`, a `caption`, and the two buttons.

**Sign-in and sign-up**: full screen, `headerShown: false`, `ModalCloseButton` in the top row
for the modal case. The top 30 % is the hero gradient (`rounded-b-2xl overflow-hidden`) with a
320 px ring cropped at `absolute -end-24 -top-24` (`hero-foreground` track,
`strokeOpacity={0.2}`) and the `title` at its bottom in `text-hero-foreground`. Below,
`px-6 pt-6 gap-5`: the fields, `AppButton size="lg"`, and the switch as a ghost button.

**Onboarding** (only for setup facts: the goal, the habits): at most 3 screens, one `title`
question each, 3 progress dots `size-2.5 rounded-full` (done `bg-accent`, else
`bg-surface-tertiary`). Goal picker: the value as `numeral text-8xl` between two `AppPressable`
`size-14 items-center justify-center rounded-full bg-surface` minus and plus buttons
(`tapFeedback()` per step, `isDisabled` at the limit), preset chips under it (selected
`bg-foreground` with the label in `text-background`, others `bg-surface`).

**Home, first run** (no rows yet):

- H1 Ring hero: the date `caption`, the name `heading`, the streak chip at the end. The 240 px
  ring holds the `numeral` (a real 0) and "of 8,000" (the real goal). Under it: 3 stat columns
  (`numeral text-3xl` + `caption`) split by `w-px bg-separator`. Next: the week dots in a
  `bg-surface rounded-xl p-4` View. Last: "Get started", 3 `AppPressable` rows. Each row has a
  28 px ring around the step number; the ring fills when the step is done.
- H2 Habit grid: `display` "Today" with the streak chip. A hero card `rounded-2xl
  bg-linear-to-br from-hero-start to-hero-end p-5`: the done count as `numeral text-6xl
  text-hero-foreground`, one `h-2 flex-1 rounded-full` segment per habit (done
  `bg-hero-foreground`, open `bg-hero-foreground/20`). Then 2-column `AppPressable` tiles
  (`w-[48%] rounded-xl bg-surface p-4`) with a 64 px ring, the name, and "2 of 8". A tap adds
  one step. First run: one `border-2 border-dashed border-border` add tile and starter chips
  from `t()`.

**Lists**: an `overflow-hidden rounded-xl bg-surface` View of `AppPressable` rows (`flex-row
items-center gap-3 px-4 py-3`), split by `h-px bg-separator`. Leading: a 40 px ring around a
16 px icon. Trailing: a `size-7 items-center justify-center rounded-full bg-accent` check
when done, else the count. Settings rows keep `AppListGroup`.

**Detail**: a 200 px ring, a pill period switch (selected `bg-segment`), a 7-bar chart of
`w-7 rounded-full` Views (height from the data in `style`; today `bg-accent`, others
`bg-surface-tertiary`), a month of dots.

**Empty state art**: pass `art` to `EmptyState`: a 128 px ring with a dotted `muted` track
(`strokeDasharray="2 10"`) and a 0.2 `accent` arc, the icon (40,
`colorClassName="accent-accent"`) inside.

**Tab bar**: `tabBarShowLabel: false`, `tabBarStyle` with `borderTopWidth: 0` and the
`useThemeColor("background")` color. Icons: the filled name when focused, `<name>-outline`
when not. Each icon sits over a `size-1.5 rounded-full` dot, `bg-accent` when focused. Keep
`title` as the accessible name.

## 7. Motion

- Rings draw from 0 over 900 ms, `"ease-out"`, on mount and on each new value (section 5).
- Week dots: `ZoomIn.springify().damping(12).delay(index * 50)`; W2 uses `index * 90`.
- Blocks: `FadeInDown.duration(380).delay(index * 70)`, first 4 blocks only.
- A closed ring, in the press handler that closes it: the check enters with
  `ZoomIn.springify().damping(10)`, the ring pulses (a scale shared value,
  `withSequence(withTiming(1.06, { duration: 140 }), withSpring(1))`, on a view with no
  entering animation), then `successFeedback()`.
- Press: `AppPressable` `animation={{ scale: { value: 0.96 } }}`; each step calls `tapFeedback()`.
- `useReducedMotion()` true: rings show their value at once; no pulse, no draw.
- Never: confetti, a spinning ring as a loader, a loop on a data screen.

## 8. Imagery

Rings and dots are the art. One photo at most, for W3: `generate_image`, `aspect` `4:5`, path
`src/assets/<name>.png`, then `require()` the returned path with a fixed relative string.

Prompt model: "Bright high-key photograph, [subject of the app: running shoes on a white track
line / a glass of water and half an orange on white linen], soft morning daylight, white and
light grey tones with one orange object, empty space at the top, no text, no logos, no watermark."

Never: dark gym photos, sweat, before-and-after bodies, scales, illustrated people.

## 9. Bans

- No second accent hue. No small orange text from `text-accent`.
- No gradient outside the hero card, W2, and the sign-in band. No square corners.
- No grey circle icon badge. No red for a missed day. No guilt copy. No emoji flame.

## 10. Self-check

1. Each data screen has a ring that draws from 0, unless motion is reduced.
2. The week dots mark today with an orange outline; the streak chip is grey at 0.
3. Counts use the `numeral` role; headlines use Lexend ExtraBold.
4. Light and dark both read well: switch the phone theme on each screen.
5. Welcome is W1, W2, or W3; home is H1 or H2; the first run shows real zeros and steps.
6. Tiles and lists are Views with `rounded-xl` (24 px) on the web too, not `AppCard`.
