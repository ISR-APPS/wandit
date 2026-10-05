# Trajet — amber lights on the ring road at night

`trajet` · medium · dark first + light · best for: delivery, courier, logistics, taxi, ride
booking, field service, fleet, moving, parcel tracking · avoid for: beauty, wellness, kids,
luxury, education

## 1. Feel

The dispatch screen on a night shift: slate asphalt and one safety-amber stripe. The app
answers two questions at arm's length, in a moving van: where is it now, and when does it
arrive. Oswald, tall and condensed in capitals, carries the status and the minutes. Rubik
carries the rest. The route is a diagram, not a map.

Voice: dispatch radio. Status first, then time ("Picked up · 14:32"). Short verbs on buttons
("Confirm pickup"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Trajet app:

- Dark is the main look; light is the daylight variant.
- No button on the night panel: the light-mode ink button vanishes there.
- Amber is paint, not ink: it fills dots, chips, the driven route, and the active tab pill,
  with `signal-foreground` text on it. Amber text appears only on the night panel.
- The button pairs ink and amber: amber with ink text in dark, ink with amber text in light.
- The night panel (hero tokens) stays slate in both modes. It holds the route, the ETA, or
  the dispatch board.
- Oswald for display, status words, times, and big numbers, in capitals: the `display`,
  `title`, and `readout` roles. Rubik for the rest.
- `--radius: 0.3125rem`: cards and buttons 15 px, fields 9 px, chips 10 px (`rounded-2xl`),
  the sheet top `rounded-t-[28px]`.
- Three signatures: the night route panel, the sheet, the live timeline (section 5).

Client choices, decided fresh for each app:

- The welcome (W1, W2, W3) and the home (H1 or H2). Two Trajet apps never share both.
- The status steps (Ordered, Picked up, On the way, Delivered) and the lead number (minutes
  to arrival, stops left, active jobs).

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.3125rem;
}

@theme static {
	--font-normal: "Rubik_400Regular";
	--font-medium: "Rubik_500Medium";
	--font-semibold: "Rubik_600SemiBold";
	--font-bold: "Rubik_700Bold";
	--font-display: "Oswald_600SemiBold";
}

@theme static {
	--color-signal: var(--signal);
	--color-signal-foreground: var(--signal-foreground);
}

@layer theme {
	:root {
		@variant light {
			--background: #f1f3f5;
			--foreground: #12161b;
			--surface: #ffffff;
			--surface-foreground: #12161b;
			--surface-secondary: #e7eaee;
			--surface-tertiary: #dce0e5;
			--overlay: #ffffff;
			--muted: #5a6470;
			--accent: #14181d;
			--accent-foreground: #ffb224;
			--default: #e4e7eb;
			--default-foreground: #12161b;
			--border: #12161b1a;
			--separator: #12161b12;
			--field-background: #ffffff;
			--field-border: #12161b2e;
			--field-placeholder: #8a929c;
			--color-default-hover: #d9dde2;
			--success: #12805c;
			--success-foreground: #ffffff;
			--warning: #e8711a;
			--warning-foreground: #12161b;
			--danger: #c9302c;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #12161b;
			--focus: #14181d;
			--hero-start: #1e2833;
			--hero-end: #12171e;
			--hero-foreground: #eef1f4;
			--surface-shadow: 0 1px 3px 0 rgba(18, 22, 27, 0.08);
			--overlay-shadow: 0 16px 40px -12px rgba(18, 22, 27, 0.28);
			--field-shadow: 0 0 0 0 transparent inset;
			--signal: #ffb224;
			--signal-foreground: #14181d;
		}

		@variant dark {
			--background: #0f1318;
			--foreground: #eef1f4;
			--surface: #181d24;
			--surface-foreground: #eef1f4;
			--surface-secondary: #1f252d;
			--surface-tertiary: #29303a;
			--overlay: #1c222a;
			--muted: #98a2ae;
			--accent: #ffb224;
			--accent-foreground: #14181d;
			--default: #232a33;
			--default-foreground: #eef1f4;
			--border: #ffffff14;
			--separator: #ffffff0f;
			--field-background: #181d24;
			--field-border: #ffffff29;
			--field-placeholder: #7a8592;
			--color-default-hover: #2b333d;
			--success: #3fcf8e;
			--success-foreground: #0f1318;
			--warning: #ff8c42;
			--warning-foreground: #0f1318;
			--danger: #ff5f57;
			--danger-foreground: #0f1318;
			--segment: #2e3640;
			--segment-foreground: #eef1f4;
			--focus: #ffb224;
			--hero-start: #1e2833;
			--hero-end: #12171e;
			--hero-foreground: #eef1f4;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--signal: #ffb224;
			--signal-foreground: #14181d;
		}
	}
}
```

Put the signal block under the hero block. `app.json`: splash `backgroundColor` `#F1F3F5`
(light) and `#0F1318` (dark), adaptive icon `#0F1318`, `"userInterfaceStyle": "automatic"`.

## 4. Type

`npx expo install @expo-google-fonts/oswald @expo-google-fonts/rubik`

```ts
import { Oswald_600SemiBold } from "@expo-google-fonts/oswald/600SemiBold";
import { Rubik_400Regular } from "@expo-google-fonts/rubik/400Regular";
import { Rubik_500Medium } from "@expo-google-fonts/rubik/500Medium";
import { Rubik_600SemiBold } from "@expo-google-fonts/rubik/600SemiBold";
import { Rubik_700Bold } from "@expo-google-fonts/rubik/700Bold";

export const appFonts = { Oswald_600SemiBold, Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, Rubik_700Bold };
```

`appFonts` holds these five keys. Set these role strings in `app-text.tsx`:

- `display`: `font-display text-5xl leading-none uppercase text-foreground`.
- `title`: `font-display text-3xl leading-none uppercase text-foreground`.
- Add `readout`: `font-display text-xl leading-none uppercase tabular-nums text-foreground`.
  Status words, times, counts, and the ETA use it; `className` sets the size. Never add
  `font-display` to another role.
- Add `label`: `font-medium text-[11px] leading-4 uppercase tracking-[1.4px] text-muted`.
- Times: `Intl.DateTimeFormat(locale, { timeStyle: "short" })`. The ETA: `readout text-[88px]`.
- Arabic twin: `npx expo install @expo-google-fonts/cairo`. The four weights: Cairo 400 to 700.
  `--font-display`: `Cairo_800ExtraBold`. Drop `uppercase` and the tracking.

```ts
import { Cairo_400Regular } from "@expo-google-fonts/cairo/400Regular";
import { Cairo_500Medium } from "@expo-google-fonts/cairo/500Medium";
import { Cairo_600SemiBold } from "@expo-google-fonts/cairo/600SemiBold";
import { Cairo_700Bold } from "@expo-google-fonts/cairo/700Bold";
import { Cairo_800ExtraBold } from "@expo-google-fonts/cairo/800ExtraBold";
```

## 5. Signatures

1. **The night route panel.** `bg-linear-to-b from-hero-start to-hero-end rounded-3xl border
   border-border p-5 gap-4`. Top: a `label` (`text-hero-foreground/70`) and a status chip.
   Then a `flex-row items-end gap-2`: the ETA (`text-hero-foreground`) and `MIN` (its own
   message key, `readout text-2xl text-signal`). The ETA is the real due time minus now. Now
   comes from a one-minute clock: `useSyncExternalStore` over a module store whose 60 s
   `setInterval` runs while it has subscribers. No due time: the status word in `display
   text-hero-foreground`. Then the route block, `h-[120px]`:
   - An `absolute inset-2 rtl:-scale-x-100` View holds `<Svg width="100%" height="100%"
     viewBox="0 0 300 120" preserveAspectRatio="none">`. Never put a class on `Svg`: native
     ignores it. In it: 8 ghost street `Line`s at `strokeOpacity={0.06}`, then the road,
     corner to corner: `Path d="M0 120 C 92 120 112 44 172 60 S 268 0 300 0"`
     (`strokeWidth={3}`, `strokeDasharray="1 9"`, round caps, `strokeOpacity={0.45}`).
   - The driven part: the same `d` on an animated amber `Path`, `strokeWidth={4}`,
     `strokeDasharray={[335, 335]}` (335 is the path length), and `useAnimatedProps` giving
     `strokeDashoffset: withTiming(335 * (1 - progress), { duration: 700 })`. `progress` is
     done steps / all steps from real rows, never a GPS guess. Colors:
     `useCSSVariable(["--color-signal", "--color-hero-foreground"])`.
   - The ends are siblings of that View, on the block corners: `absolute bottom-0 start-0
     size-4 rounded-full bg-hero-foreground`, and `absolute top-0 end-0 size-4 rounded-full
     bg-signal border-2 border-signal-foreground` with the pulse. Their centers sit 8 px in,
     on the path ends, and they mirror with the path in RTL.
   Under the block: pickup at the start, drop-off at the end, in hero colors.
2. **The sheet.** It rises over the night: `-mt-7 rounded-t-[28px] bg-background px-5 pt-3
   gap-5`, a grab bar `self-center h-1 w-10 rounded-full bg-border`. The panel above gets
   `pb-12`. No drag.
3. **The live timeline.** Rows `flex-row gap-3`. Start column `w-5 items-center`: a dot over a
   `w-0.5 flex-1 my-1` line. Done: `size-3 rounded-full bg-foreground`, line `bg-foreground`.
   Live: `size-4 rounded-full bg-signal border-2 border-signal-foreground` with the pulse.
   Next: `size-3 rounded-full border-2 border-muted`, line `bg-border`. Text `flex-1 pb-6`:
   the status in `readout text-lg` (done: `text-muted`), a `caption`, the real time in
   `readout text-base text-muted` (none: "—"). On the night panel, done dots and lines are
   `bg-hero-foreground`, next dots `border-hero-foreground/50`.

The live pulse: an `Animated.View` (`absolute size-4 rounded-full bg-signal`) with a Reanimated
CSS loop in `style`: `animationName` from `scale` 1 and `opacity` 0.6 to `scale` 2.6 and
`opacity` 0, `animationDuration: "1600ms"`, `animationIterationCount: "infinite"`. No
animation when `useReducedMotion()` is true.

## 6. Screens

**Welcome** (signed-out start of an app that needs a signed-in user). Pick one:

- W1 Night route: a `flex-1 bg-linear-to-b from-hero-start to-hero-end` View, not `Screen`.
  An `AppSafeAreaView edges={["top"]}` (`flex-1 px-6 pt-10`) holds the name in `display
  text-6xl text-hero-foreground` and the route block (`h-[220px]`, progress 0.6, pulse on).
  The sheet (signature 2) is an `AppSafeAreaView edges={["bottom"]}`: one line, "Get
  started", and a ghost "I have an account".
- W2 Departure board: the timeline at poster scale on `bg-background`: the app's three steps
  in `display text-5xl`, dots `size-5`, rows entering with `FadeInDown.duration(300).delay(index
  * 220)`, the last dot live. Buttons at the bottom.
- W3 Route line, no photo: a `flex-1 bg-background` View with an `AppSafeAreaView` (`flex-1
  justify-between px-6 py-10`). Top: a `label` and the name in `display text-7xl`. Middle: a
  straight road (`-mx-6 h-10 justify-center`): `<Svg width="100%" height={4}>` with a ghost
  `Line` (`y1={2} y2={2}`, dashes as the route, `--color-muted`), the driven part `absolute
  start-0 h-1 w-1/2 rounded-full bg-accent`, and three `absolute size-4 rounded-full` stops:
  ink `start-6 bg-foreground`, the live dot `start-1/2 -ms-2`, hollow `end-6 border-2
  border-foreground`. Under it, the real steps as three `label`s (`flex-row justify-between
  px-6`). Bottom: one `text-muted` line and the buttons.

**Sign-in and sign-up**: `headerShown: false`, `Screen`. A night panel card first (`px-6
pt-8 pb-12`): the app name in `display text-4xl text-hero-foreground` and the route at 0.
The sheet over its lower edge: a row with the `title` and `ModalCloseButton` at the end, the
fields, the primary button (`size="lg"`), a ghost switch link.

**Onboarding** (setup facts only, at most 3 screens): progress is 3 dots joined by `h-0.5
flex-1` lines, the current one amber. A `title` question; `h-16 rounded-2xl bg-surface px-4`
option rows with an icon, the selected one `border-2 border-foreground`.

**Home, first run** (no rows yet), in `Screen`:

- H1 Dispatch board (many jobs at once): the `title` ("DISPATCH") and the time now in
  `readout text-muted`. The board: the night panel classes around the live timeline, one row
  per active job (status `readout text-2xl text-hero-foreground`, place `caption
  text-hero-foreground/70`, time `readout text-signal`); only the first live dot pulses.
  Under it, 3 counts split by `w-px bg-separator` (active, done, late), each `readout
  text-4xl` over a `label`. First run: one hollow row "NO JOBS YET", real zeros, then a "Get
  started" timeline of 3 setup steps; real data marks each done, and the live row opens it.
- H2 Run sheet (a day of stops): a `title` ("TODAY"), then `0 / 0 STOPS` in `readout
  text-4xl` over an `h-1.5 rounded-full bg-surface-tertiary` bar. Its `bg-accent` fill takes
  the done share as a `width` percent in `style`, not in a class. The day is one timeline: a
  `w-14` time column, the dot and line, a stop card (`flex-1 bg-surface rounded-2xl p-4`).
  Done stops shrink to one muted line; the live card gets `border-2 border-accent`. First run:
  one hollow node and a "Get started" card of 3 setup steps, the first "Add your first stop".

**Lists**: job cards `bg-surface rounded-2xl p-4 flex-row gap-4`: a `w-14` time block
(`readout text-2xl` over a `label`), the place in `heading` over "pickup → drop-off"
(`arrow-forward` with `rtl:-scale-x-100`), and a status chip (`rounded-full
bg-surface-secondary px-2.5 py-1`, a `size-2` dot and a `label` word). Dots: live
`bg-signal`, done `bg-success`, late `bg-warning`, failed `bg-danger`, planned `bg-muted`.
Filter chips: `rounded-full h-9 px-4`, selected `bg-accent`.

**Detail**: the night route panel, then the sheet: the timeline, the person (`AppAvatar`, name,
a call button only with a real phone), spec rows, and the next status action.

**Empty state art** (`art` of `EmptyState`): a `w-40 h-20` route block at progress 0 in a
`bg-linear-to-b from-hero-start to-hero-end rounded-2xl p-3` card, pulse off.

**Tab bar**: background `useThemeColor("background")`, active tint `useThemeColor("foreground")`.
Icons: filled when focused, `-outline` when not. The focused icon (20) sits in a `h-7 w-12
items-center justify-center rounded-full bg-signal` pill with
`colorClassName="accent-signal-foreground"` and no `color` prop. Labels: `fontSize: 11`; a
Latin app adds `textTransform: "uppercase"` and `letterSpacing: 0.8`, an Arabic app neither.

## 7. Motion

Mechanical: panels rise from the bottom; amber moves along the route.

- The sheet: `SlideInDown.springify().damping(18)`; its blocks
  `FadeIn.duration(220).delay(120 + index * 40)`.
- The driven route grows over 700 ms on a status change (the inline `withTiming` skips the
  mount). Timeline rows: `LinearTransition.duration(240)`. The ETA: key it by value,
  `FadeInDown.duration(200)`.
- Press: `AppPressable animation={{ scale: { value: 0.97 } }}` on cards. `tapFeedback()` on a
  status button, `successFeedback()` after a delivery.
- The pulse is the only loop: one per screen.
- Never: a bounce, a rotation, a map pan, a moving vehicle.

## 8. Imagery

Trajet draws its art with Views and SVG: 0 images in a first build. Each `generate_image` call
costs the user credits: use it only when the user asks for a photo, at most 1 per turn
(`aspect` `2:3`, path `src/assets/<name>.png`, `require()` with a fixed string).

Prompt model: "Night photograph of [subject of the app: a delivery van at a loading dock / a
courier on a scooter at a crossing], sodium street light, wet asphalt, slate shadows, amber
highlights, no text, no logos, no license plates, no faces." Never a fake map, a branded
vehicle, or cartoon trucks.

## 9. Bans

- No amber text or line on a light surface. No second accent. No button gradient.
- No fake ETA, position, or distance: every number comes from real rows.
- No lowercase Oswald in Latin. No rounded-full cards. No icon in a grey circle. No emoji.

## 10. Self-check

1. Dark is slate and amber; light keeps the night panel. Amber sits under ink text or on night.
2. ETA, times, and route progress come from real rows, else the screen shows a status word.
   The ETA counts down while the screen stays open.
3. Welcome W1, W2, or W3; home H1 or H2, with real zeros and "Get started" on the first run.
4. Only the live dot pulses, and reduced motion stops it.
5. Status words, times, and numbers use `readout`; no `Svg` has a class.
