# Vestiaire — the locker room at six in the morning

`vestiaire` · loud · dark only · best for: gym, fitness club, coaching, combat sports,
sports club, team app, gym management · avoid for: clinic, kids, finance, beauty, food

## 1. Feel

Concrete floor, chalk on the hands, one strip light over the rack. The app is black steel with
one electric volt color, and the numbers are the heroes: reps, kilos, days, members, check-ins.
Display type is tall and condensed, set in capitals, like the numbers painted on a locker door.
Everything is sharp, fast, and physical. Nothing is cute and nothing is soft.

Voice: the app talks like a coach. Short sentences, a verb first ("Log the set", "Check in").
Numbers before words ("12 check-ins today"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Vestiaire app:

- Near-black ground, steel surfaces, and one volt accent. The volt marks the primary action,
  the active tab, the lead number, and the volt slash. It never fills a large area except the
  lead stat tile. A data screen has one volt element: the lead number or one volt tile.
- Anton for display text and big numbers, always in capitals. Barlow for all other text.
- Sharp corners: `--radius: 0.25rem` (cards and buttons 12 px, fields 7 px). Pills only for avatars.
- Three signatures: the athletic poster, the giant numeral, and the volt slash (section 5).
- Dark only: set `"userInterfaceStyle": "dark"` in `app.json`. The light block holds the dark values.

Client choices, decided fresh for each app:

- The welcome composition: W1, W2, or W3 (section 6).
- The home lead: the numeral board (H1) or the today strip (H2).
- Which number is the lead number of the app (members today, sessions this week, kilos lifted).
- The subject of the photography (section 8).

Two Vestiaire apps must never share the same welcome and home composition.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.25rem;
}

@theme static {
	--font-normal: "Barlow_400Regular";
	--font-medium: "Barlow_500Medium";
	--font-semibold: "Barlow_600SemiBold";
	--font-bold: "Barlow_700Bold";
	--font-display: "Anton_400Regular";
}

@layer theme {
	:root {
		@variant light {
			--background: #0b0b0c;
			--foreground: #f4f4f0;
			--surface: #161618;
			--surface-foreground: #f4f4f0;
			--surface-secondary: #1f1f22;
			--surface-tertiary: #2a2a2e;
			--overlay: #1a1a1d;
			--muted: #9c9c95;
			--accent: #d4ff3a;
			--accent-foreground: #0b0b0c;
			--default: #242427;
			--default-foreground: #f4f4f0;
			--border: #ffffff17;
			--separator: #ffffff12;
			--field-background: #161618;
			--field-border: #ffffff2e;
			--field-placeholder: #7e7e78;
			--color-default-hover: #2c2c30;
			--success: #3ddc84;
			--success-foreground: #0b0b0c;
			--warning: #ffb020;
			--warning-foreground: #0b0b0c;
			--danger: #ff5545;
			--danger-foreground: #0b0b0c;
			--segment: #2c2c30;
			--segment-foreground: #f4f4f0;
			--focus: #d4ff3a;
			--hero-start: #1c1c1f;
			--hero-end: #0b0b0c;
			--hero-foreground: #f4f4f0;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.18) inset;
			--field-shadow: 0 0 0 0 transparent inset;
		}

		@variant dark {
			--background: #0b0b0c;
			--foreground: #f4f4f0;
			--surface: #161618;
			--surface-foreground: #f4f4f0;
			--surface-secondary: #1f1f22;
			--surface-tertiary: #2a2a2e;
			--overlay: #1a1a1d;
			--muted: #9c9c95;
			--accent: #d4ff3a;
			--accent-foreground: #0b0b0c;
			--default: #242427;
			--default-foreground: #f4f4f0;
			--border: #ffffff17;
			--separator: #ffffff12;
			--field-background: #161618;
			--field-border: #ffffff2e;
			--field-placeholder: #7e7e78;
			--color-default-hover: #2c2c30;
			--success: #3ddc84;
			--success-foreground: #0b0b0c;
			--warning: #ffb020;
			--warning-foreground: #0b0b0c;
			--danger: #ff5545;
			--danger-foreground: #0b0b0c;
			--segment: #2c2c30;
			--segment-foreground: #f4f4f0;
			--focus: #d4ff3a;
			--hero-start: #1c1c1f;
			--hero-end: #0b0b0c;
			--hero-foreground: #f4f4f0;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.18) inset;
			--field-shadow: 0 0 0 0 transparent inset;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#0B0B0C` (light and dark), `android.adaptiveIcon.backgroundColor`
`#0B0B0C`, `"userInterfaceStyle": "dark"`. The status bar is light: `<StatusBar style="light" />`.

## 4. Type

`npx expo install @expo-google-fonts/anton @expo-google-fonts/barlow`

```ts
import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { Barlow_400Regular } from "@expo-google-fonts/barlow/400Regular";
import { Barlow_500Medium } from "@expo-google-fonts/barlow/500Medium";
import { Barlow_600SemiBold } from "@expo-google-fonts/barlow/600SemiBold";
import { Barlow_700Bold } from "@expo-google-fonts/barlow/700Bold";

export const appFonts = {
	Anton_400Regular,
	Barlow_400Regular,
	Barlow_500Medium,
	Barlow_600SemiBold,
	Barlow_700Bold,
};
```

Set these role strings in `app-text.tsx`:

- `display`: `font-display text-6xl leading-none uppercase text-foreground`; a hero may add
  `text-7xl`.
- `title`: `font-display text-4xl leading-10 uppercase text-foreground`. Anton is narrow, so a
  title can be big and still fit.
- Add `numeral`: `font-display text-4xl leading-none uppercase tabular-nums text-foreground`.
  Every number and every set of initials uses it; the lead number adds `text-8xl`. Never add
  `font-display` to another role: two faces conflict.
- Add `label` (above a number or a section): `font-semibold text-xs uppercase
  tracking-widest text-muted`.
- Body text stays Barlow regular, `text-base`. Never set a paragraph in Anton.
- Arabic twin: `npx expo install @expo-google-fonts/lalezar @expo-google-fonts/cairo`. For an app
  in Arabic only, `--font-display` is `Lalezar_400Regular` and the four weights are
  `Cairo_400Regular`, `Cairo_500Medium`, `Cairo_600SemiBold`, `Cairo_700Bold`.
  Arabic has no capitals: drop `uppercase` and `tracking-widest` in the Arabic app.

```ts
import { Cairo_400Regular } from "@expo-google-fonts/cairo/400Regular";
import { Cairo_500Medium } from "@expo-google-fonts/cairo/500Medium";
import { Cairo_600SemiBold } from "@expo-google-fonts/cairo/600SemiBold";
import { Cairo_700Bold } from "@expo-google-fonts/cairo/700Bold";
import { Lalezar_400Regular } from "@expo-google-fonts/lalezar/400Regular";
```

## 5. Signatures

1. **The athletic poster.** A full-bleed photo from `generate_image` (section 8) with a scrim
   from the bottom: `<Image className="absolute inset-0 size-full" resizeMode="cover" />`, then
   `<View className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-transparent" />`.
   The capitals sit on the dark end of the scrim, at the bottom, never on the bright part.
2. **The giant numeral.** Each screen with data has one `numeral` at `text-8xl`, with a
   `label` line under it. It is the one volt element: `text-accent` on the dark ground, or
   `text-accent-foreground` inside the volt lead tile that holds it. Other numbers are
   `numeral` in `text-foreground`.
3. **The volt slash.** A short skewed bar: `<View className="h-1.5 w-12 -skew-x-12 bg-accent" />`.
   It sits above a section title, under the app name, and above the active tab icon.
   One slash per screen area, never a row of them. When it enters with an animation, the
   outer `Animated.View` holds `entering` and the inner View holds the skew.

## 6. Screens

**Welcome** (signed-out start of an app that needs a signed-in user). W1 and W3 are a
`flex-1 bg-background` View with the photo, not `Screen`; an `AppSafeAreaView` in it holds
the text and the buttons. Pick one:

- W1 Poster: the athletic poster over the full screen. At the bottom, `px-6 pb-10 gap-4`: the
  volt slash, the app name as `display` on two lines, one line of promise in `text-muted`,
  then a full-width primary button ("Start") and a ghost button ("I have an account").
- W2 Scoreboard: no photo. Three stacked lines in `display text-7xl`, each its own message
  key ("TRAIN." "TRACK." "REPEAT."); the last line in `text-accent`. Buttons at the bottom.
- W3 Hard cut: the photo fills the top 58 %. A `bg-background` band (`-mt-12 -mx-8 h-24
  -skew-y-6`) cuts across its lower edge on a diagonal, with no rounded corner. Under the
  cut, `AppSafeAreaView edges={["bottom"]}` holds the volt slash, the `title`, and the buttons.

**Sign-in and sign-up**: full screen, not a sheet. Hide the header (`headerShown: false`) and put
a close or back button in the top row for the modal case. Top row: the volt slash and the app
name in `label`. Then a `title` ("SIGN IN"), the fields with `label` text above them,
the primary button full width, and the switch link as a ghost button. Optional: a 30 % photo
band at the top with the scrim.

**Onboarding** (only for setup facts, for example the gym name and the opening days): one
question per screen, at most 3 screens. Progress is 3 segments at the top
(`h-1 flex-1 rounded-sm`, done segments `bg-accent`, others `bg-surface-tertiary`). The question
is a `title`. The "Next" button is pinned at the bottom.

**Home, first run** (no rows yet):

- H1 Numeral board: the date as a `label`, then the lead tile, full width (`bg-accent
  rounded-3xl p-5`): the lead number in `numeral text-8xl` (a real 0 is fine) over its
  `label`, both `text-accent-foreground`. It is the one volt element. Then a 2-column grid of
  the other stat tiles (`bg-surface rounded-3xl p-4`), each a `numeral` and a `label`. Under
  the grid: a "Get started" card with 3 numbered steps; each step is an `AppPressable` row
  that opens the create flow.
- H2 Today strip: a horizontal strip of 7 days (`size-12 rounded-xl`; today `bg-accent` with
  `text-accent-foreground`, the one volt element). Then today's real count in `numeral
  text-8xl` (a real 0) over a `label`, and the "TODAY" section with the slash: the list, or on
  the first run the "Get started" card of H1 over the empty art.

**Lists**: `AppListGroup` rows on `bg-surface`. Leading: initials in a `size-10 rounded-lg
bg-surface-tertiary` square (`numeral text-base`). Trailing: a `numeral text-2xl`. A status uses
`success`, `warning`, or `danger` with a word, never only a dot.

**Detail**: the poster at 40 % height when the item has a photo, else a `bg-surface` header
with the giant numeral. Sections below, each opened by the slash and a `label`.

**Empty state art**: pass `art` to `EmptyState`: a giant "0" (`numeral text-9xl
text-surface-tertiary`) with the outline icon (`colorClassName="accent-accent"`) centered over it.

**Tab bar**: in `(tabs)/_layout.tsx`, `tabBarStyle` with `borderTopWidth: 0` and the background
color from `useThemeColor("background")`; active tint is the accent. Icons: filled when
focused, `-outline` when not. Labels: `tabBarLabelStyle` with `fontSize: 11`; a Latin app adds
`textTransform: "uppercase"` and `letterSpacing: 1`, an Arabic app neither.

## 7. Motion

Fast and physical. Short distances, firm springs.

- Entry: `FadeInDown.duration(320)` on each block, with `.delay(index * 60)` for the first 4
  blocks only.
- Numbers: `ZoomIn.springify().damping(14)` on the lead number when it appears.
- Press: `AppPressable` with `animation={{ scale: { value: 0.95 } }}` on tiles and cards.
  `tapFeedback()` on a check-in or a completed set; `successFeedback()` after a save.
- Welcome W1: the photo settles from `scale` 1.08 to 1, a Reanimated CSS animation in `style`
  (`animationName` with `from` and `to` transforms, `animationDuration: "1400ms"`,
  `animationTimingFunction: "ease-out"`). With `useReducedMotion()` true, no zoom.
- An entering animation and a skew (the slash, the W3 band) go on two nested views.
- Never: bouncy cartoon springs, rotation, looping animations on a data screen.

## 8. Imagery

Black-and-white sports photography with hard side light. Use `generate_image` with `aspect`
`2:3` for a poster and `3:2` for a band. Path: `src/assets/<name>.png`, then
`require()` the returned path with a fixed relative string.

Prompt model: "Black and white photograph, [subject of the app: an athlete in a deadlift in a
concrete gym / a boxer wrapping hands / a runner on a track at dawn], hard side light, deep
shadows, visible film grain, 35 mm, vertical framing, no text, no logos, no watermark."

- At most 2 images in the first build: the welcome poster and one detail band.
- Faces stay small or turned away. Never stock smiles, never color photos, never illustrations.

## 9. Bans

- No light mode, no pastel, no gradient on a button, no second accent color.
- No rounded-full pills on buttons or cards. No soft drop shadows.
- No icon in a grey circle. No emoji. No mixed-case display text.
- No volt text on a light surface. No volt fill larger than the lead tile.

## 10. Self-check

1. The app opens dark on a phone in light mode, and on the web.
2. Every display line and big number is Anton in capitals; all other text is Barlow.
3. Each data screen has exactly one volt element: the lead number or one volt tile.
4. The welcome uses W1, W2, or W3, and the home uses H1 or H2, with real numbers only. A
   first-run home shows real zeros and the "Get started" card.
5. The volt slash appears, but never twice in the same block.
6. Photos are black and white, with the text on the dark end of the scrim.
7. Every pressable tile scales on press; reduced motion removes the photo zoom.
