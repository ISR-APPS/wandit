# Souffle — the sky in the minute before sunrise

`souffle` · quiet · light + dark · best for: meditation, sleep, breathing, wellness, therapy,
journaling, yoga, mood diary · avoid for: finance, gym, delivery, marketplace, back office

## 1. Feel

The sky in the minute before sunrise: lavender above, peach at the horizon. At night the same
sky turns indigo and plum. In its center, one soft light breathes in and out. A warm serif
speaks slowly. Nothing is sharp, nothing hurries, nothing counts down in red. Each screen holds
one idea and a lot of air.

Voice: a calm guide. Short sentences, an invitation, not an order ("Take one minute", "Write
one line"). Never guilt ("You missed 3 days"). No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Souffle app:

- The sky sits behind every hero (welcome, sign-in, home header, session). The rest is plain
  `bg-background`.
- Fraunces for display lines, titles, greetings, and big numbers (the `display`, `title`,
  `serif`, and `italic` roles). Nunito Sans for all other text.
- One line per screen can be italic (the `italic` role). It is always a whole line from its
  own `t()` key, never a word cut out of a sentence: word order changes between languages.
- `--radius: 0.625rem`: cards 30 px, fields 18 px, buttons are pills. Cards take 3 times the
  radius, so 1.25rem gives 60 px corners that clip text.
- The iris accent marks the primary action and the active tab.
- Three signatures: the sky, the breathing orb, the serif greeting (section 5).

Client choices: the welcome (W1, W2, W3); the home (H1 for session apps, H2 for entry apps);
the orb role (a breath guide or an ambient light); the photo subject. Two Souffle apps never
share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.625rem;
}

@theme static {
	--font-normal: "NunitoSans_400Regular";
	--font-medium: "NunitoSans_500Medium";
	--font-semibold: "NunitoSans_600SemiBold";
	--font-bold: "NunitoSans_700Bold";
	--font-display: "Fraunces_400Regular";
	--font-serif-italic: "Fraunces_400Regular_Italic";
}

@theme static {
	--color-mid-sky: var(--mid-sky);
	--color-orb: var(--orb);
	--color-orb-halo: var(--orb-halo);
}

@layer theme {
	:root {
		@variant light {
			--background: #fbf4ef;
			--foreground: #2b2340;
			--surface: #fffcfa;
			--surface-foreground: #2b2340;
			--surface-secondary: #f6ebe5;
			--surface-tertiary: #eddfda;
			--overlay: #fffcfa;
			--muted: #6b6080;
			--accent: #6650a6;
			--accent-foreground: #ffffff;
			--default: #f2e7e2;
			--default-foreground: #2b2340;
			--border: #2b23401a;
			--separator: #2b234012;
			--field-background: #fffcfa;
			--field-border: #2b234026;
			--field-placeholder: #968ca6;
			--color-default-hover: #eaddd7;
			--success: #2f7a5f;
			--success-foreground: #ffffff;
			--warning: #ebb06a;
			--warning-foreground: #2b2340;
			--danger: #b23f4c;
			--danger-foreground: #ffffff;
			--segment: #fffcfa;
			--segment-foreground: #2b2340;
			--focus: #6650a6;
			--hero-start: #d4c6ee;
			--hero-end: #fad3bb;
			--hero-foreground: #2b2340;
			--mid-sky: #f4cbd3;
			--orb: #fff6ec;
			--orb-halo: #f4ae8c;
			--surface-shadow: 0 6px 24px 0 rgba(43, 35, 64, 0.06);
			--overlay-shadow: 0 16px 40px 0 rgba(43, 35, 64, 0.14);
			--field-shadow: 0 0 0 0 transparent inset;
		}

		@variant dark {
			--background: #121029;
			--foreground: #f1ecf7;
			--surface: #1b1938;
			--surface-foreground: #f1ecf7;
			--surface-secondary: #242248;
			--surface-tertiary: #2e2b57;
			--overlay: #1f1d40;
			--muted: #a9a1c4;
			--accent: #c6b2ff;
			--accent-foreground: #121029;
			--default: #262449;
			--default-foreground: #f1ecf7;
			--border: #ffffff14;
			--separator: #ffffff0f;
			--field-background: #1b1938;
			--field-border: #ffffff24;
			--field-placeholder: #7f78a0;
			--color-default-hover: #302d5a;
			--success: #72d3aa;
			--success-foreground: #121029;
			--warning: #f2c27c;
			--warning-foreground: #121029;
			--danger: #ff8b90;
			--danger-foreground: #121029;
			--segment: #2e2b57;
			--segment-foreground: #f1ecf7;
			--focus: #c6b2ff;
			--hero-start: #1d1b45;
			--hero-end: #4a2244;
			--hero-foreground: #f3ecf7;
			--mid-sky: #36224f;
			--orb: #ebd9ff;
			--orb-halo: #8d6ae0;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
		}
	}
}
```

Extras: `mid-sky` is the middle stop of the sky; `orb` and `orb-halo` color the glow.
`app.json`: splash `backgroundColor` `#FBF4EF` (light) and `#121029` (dark),
`android.adaptiveIcon.backgroundColor` `#FBF4EF`, `"userInterfaceStyle": "automatic"`.

## 4. Type

`npx expo install @expo-google-fonts/fraunces @expo-google-fonts/nunito-sans`

```ts
import { Fraunces_400Regular } from "@expo-google-fonts/fraunces/400Regular";
import { Fraunces_400Regular_Italic } from "@expo-google-fonts/fraunces/400Regular_Italic";
import { NunitoSans_400Regular } from "@expo-google-fonts/nunito-sans/400Regular";
import { NunitoSans_500Medium } from "@expo-google-fonts/nunito-sans/500Medium";
import { NunitoSans_600SemiBold } from "@expo-google-fonts/nunito-sans/600SemiBold";
import { NunitoSans_700Bold } from "@expo-google-fonts/nunito-sans/700Bold";

export const appFonts = {
	Fraunces_400Regular,
	Fraunces_400Regular_Italic,
	NunitoSans_400Regular,
	NunitoSans_500Medium,
	NunitoSans_600SemiBold,
	NunitoSans_700Bold,
};
```

`appFonts` holds these six keys.

- In `app-text.tsx`, add two roles. Never add `font-display` or `font-serif-italic` to another
  role: two faces conflict.
  - `serif`: `font-display text-xl leading-8 text-foreground`, for Fraunces words, rows, and
    numbers outside `display` and `title`.
  - `italic`: `font-serif-italic text-xl leading-8 text-foreground`, for the italic line. Under
    a `display` it takes `text-5xl leading-tight`; under a `title`, `text-3xl leading-9`.
- Big numbers (minutes, days): `serif` plus `text-6xl leading-none tabular-nums`.
- Reading text: `body` with `text-lg leading-8`.
- Arabic twin: `npx expo install @expo-google-fonts/noto-naskh-arabic`. Tokens: normal
  `NotoNaskhArabic_400Regular`, medium `_500Medium`, semibold and display `_600SemiBold`, bold
  and serif-italic `_700Bold`. Arabic has no italics, so the italic line stands out by weight.

```ts
import { NotoNaskhArabic_400Regular } from "@expo-google-fonts/noto-naskh-arabic/400Regular";
import { NotoNaskhArabic_500Medium } from "@expo-google-fonts/noto-naskh-arabic/500Medium";
import { NotoNaskhArabic_600SemiBold } from "@expo-google-fonts/noto-naskh-arabic/600SemiBold";
import { NotoNaskhArabic_700Bold } from "@expo-google-fonts/noto-naskh-arabic/700Bold";
```

## 5. Signatures

1. **The sky.** `bg-linear-to-b from-hero-start via-mid-sky to-hero-end`. Text on it is
   `text-hero-foreground`, secondary text `text-hero-foreground/75`. Full screen on the welcome
   and the session (the welcome frame, section 6), a card (`overflow-hidden rounded-[36px]`) on
   the home and the sign-in. Sleep apps may add 12 stars: SVG `Circle`s (r 1 to 1.5, fill orb,
   opacity 0.5) at fixed positions.
2. **The breathing orb.** One `BreathOrb` in `src/shared/ui/`, `size` 96, 160, or 260. An `Svg`
   (`width` and `height` = size) with a `RadialGradient`: stop 0 orb at opacity 1, stop 0.45
   orb-halo at 0.55, stop 1 orb-halo at 0, on one `Circle` (``fill={`url(#${id})`}``, with
   `id = useId().replaceAll(":", "")`: SVG ids are global on the web). Colors:
   `useCSSVariable(["--color-orb", "--color-orb-halo"])`, each used only when it is a string.
   The breath is a CSS loop in the `style` of an `Animated.View` around the `Svg`:
   `animationName: { "0%": { opacity: 0.75, transform: [{ scale: 0.86 }] }, "50%": { opacity:
   1, transform: [{ scale: 1 }] }, "100%": { opacity: 0.75, transform: [{ scale: 0.86 }] } }`,
   `animationDuration: "8s"`, `animationIterationCount: "infinite"`, `animationTimingFunction:
   "ease-in-out"`. Guide words: two absolute `Animated.View`s with an `AppText`, same 8 s loop,
   `"linear"`. "Breathe in" opacity: `0%` 0, `5%` 1, `45%` 1, `50%` 0, `100%` 0. "Breathe out":
   `0%` 0, `50%` 0, `55%` 1, `95%` 1, `100%` 0. `breathing={false}` or reduced motion: no
   animation, scale 0.93, no guide words.
3. **The serif greeting.** On the sky, in `display text-hero-foreground`: line 1 from the local
   hour (5 to 11 morning, 12 to 17 afternoon, 18 to 21 evening, else night). Line 2 is the
   `italic` role at display size, from its own `t()` key with the first name as a parameter, or
   a soft phrase when the profile has no name. Then the date as `caption`.

## 6. Screens

**Welcome**: a `View className="flex-1 bg-background"`, not `Screen`. The sky runs under the
status bar; an `AppSafeAreaView` inside pads the text, the cards, and the buttons. Pick one:

- W1 Dawn orb: the full sky. The orb (260) centered at 34 % height. Under it, centered: the name
  in `display text-hero-foreground` and the italic promise (`italic text-hero-foreground/85`).
  At the bottom (`px-6 pb-10 gap-3`): a primary pill ("Begin") and a ghost button.
- W2 Horizon: the sky fills the top 62 %. At its bottom, two soft hill `Path`s (80 and 56 px
  high) in background color, back at opacity 0.5, front at 1. The orb (200) sits behind the
  front hill like a sun. Below, on the page: the name, the italic promise, the buttons.
- W3 Practice fan: a sky band on the top 55 % (`rounded-b-[48px]`) holds 3 cards. Each is an
  outer `Animated.View` (the entry, `-ms-10`, and `z-10 -mt-4` on the front card) around an
  inner View (`h-52 w-36 justify-end rounded-[28px] border
  border-hero-foreground/20 bg-hero-foreground/15 p-4`) turned `rotate-[-8deg]`, `rotate-0`,
  or `rotate-[8deg]`. Each shows an icon (`colorClassName="accent-hero-foreground"`) and a
  `serif text-hero-foreground` word for a real practice ("Sleep").

**Sign-in and sign-up**: `Screen` under the modal header of the template (`ModalCloseButton`).
One sky card (`px-5 pt-8 pb-5 gap-4`): the orb (96, `breathing={false}`), a `title` with its
italic line, then a form card `rounded-[30px] border border-hero-foreground/20 bg-surface/85
p-5 gap-4` with the fields, the primary pill, and the ghost switch link. No blur.

**Onboarding** (setup facts only: a goal, a usual time, a name): at most 3 screens on the plain
page. Progress: 3 dots (`h-2 w-2 rounded-full bg-surface-tertiary`), the current one `h-2 w-6
rounded-full bg-accent` (`LinearTransition`). The question is a `title` with its italic line.
Options: `AppPressable` `flex-row items-center gap-4 rounded-[30px] border border-border
bg-surface px-5 py-4`, a `size-10 rounded-full` sky circle with an icon, and the label.
Selected: `border-2 border-accent` and a `checkmark-circle` (`ZoomIn`). "Continue" sits at
the bottom (`mt-auto`).

**Home, first run**. Pick one:

- H1 Morning sky (session apps): a sky card `min-h-[300px] px-6 pt-8 pb-7` with the date, the
  greeting, the orb (160) half outside at the top end (`absolute -end-8 -top-8`), and the
  primary pill for the main practice. Below: "This week", the real minutes (`serif text-6xl
  leading-none`) and the sessions (`serif text-3xl`). Then a "Start gently" card
  (`rounded-[30px] bg-surface p-5`): 3 rows, each a `serif` numeral (`text-2xl text-accent`),
  the step, and a chevron (flipped in RTL) that opens a real flow.
- H2 Evening page (entry apps): the date, the greeting as `title` with its italic line, then a
  sky prompt card (`rounded-[36px] p-6 gap-5`): a `serif text-2xl text-hero-foreground` prompt
  from a `t()` key and a pill "Write". Then "Your entries" with the real count (0 at first).
  First run: only the list part shows `EmptyState`.

**Lists**: sessions in a `FlatList` inside `AppSafeAreaView` (separator `h-3`). A row is an
`AppPressable` `flex-row items-center gap-4 rounded-[30px] bg-surface p-3 pe-4`: a `size-16
rounded-[22px]` sky thumb with an icon (or a photo), the title, the real duration, and a
`size-11 rounded-full bg-accent` play mark. Entries: a `SectionList` by day with `serif`
headers; rows `rounded-[30px] bg-surface p-5` show a `serif` first line
(`numberOfLines={2}`) and the time.

**Detail**: a session plays on the full sky (the welcome frame, under the native header): the
orb (260) with the guide words in `serif text-3xl text-hero-foreground`, the `title` in
`text-hero-foreground`, then at `pb-12` a `size-20 rounded-full bg-accent` play button over a
`h-1 bg-hero-foreground/20` track with a `bg-hero-foreground/80` fill (its width in `style`).
At the end: `successFeedback()` and one `italic` line ("That was {minutes} minutes for you.").
An entry: the date, the `title`, and the body.

**Empty state art**: an SVG 180 x 120: a low hill (`Ellipse` rx 90, ry 30, accent, opacity 0.12),
a small orb (radial gradient with a `useId()` id, r 26) resting on it, and 3 stars (`Circle` r
1.5, accent, 0.4).

**Tab bar**: icons only. `tabBarShowLabel: false`, `tabBarStyle: { backgroundColor: background,
borderTopWidth: 0, elevation: 0 }` from `useThemeColor`. `tabBarIcon` renders a `View
className="items-center gap-1"` with the icon (the filled name when focused, else
`<name>-outline`) and, when focused, a `size-1.5 rounded-full bg-accent` dot. Keep each
`title`: screen readers read it.

## 7. Motion

- Entry: `FadeIn.duration(600)` per block, `.delay(index * 150)` for the first 4. The greeting
  uses `FadeInUp.duration(700)`.
- W2: the orb rises 32 px. An outer `Animated.View` runs a one-shot CSS animation
  (`animationName: { from: { transform: [{ translateY: 32 }] }, to: { transform: [{
  translateY: 0 }] } }`, `animationDuration: "1800ms"`, `animationTimingFunction: "ease-out"`);
  `BreathOrb` breathes inside it. W3: the outer card views enter with
  `FadeInUp.springify().damping(20).delay(index * 120)`.
- Press: `AppPressable animation={{ scale: { value: 0.98 } }}`, the play button 0.94.
  `tapFeedback()` on a choice, `successFeedback()` when a session ends or an entry saves.
- Reduced motion: no loop, no rise.
- Never: bounce, shake, or a hero move under 300 ms.

## 8. Imagery

SVG first. Photos are optional, at most 3 in the first build: session thumbnails (`aspect`
`1:1`) and one band (`16:9`). `generate_image` with the path `src/assets/<name>.png`, then
`require()` the returned path with a fixed string.

Prompt model: "Soft-focus photograph of [the subject of the app: mist over a still lake /
morning light on linen sheets / a yoga mat by a tall window], dawn palette of peach, rose, and
lavender, pale haze, low contrast, fine film grain, empty space in the upper third, no faces,
no text, no logos, no watermark."

- Never generate lotus poses, statues, chakras, stacked stones, incense, or sunset silhouettes.

## 9. Bans

- No sharp corners, hard shadows, dark borders, or neon.
- No red countdown, no streak flames, no badges, no guilt copy.
- No second orb on a screen. No orb loop on a form or a list.
- No sans display, no bold serif, no uppercase, no wide tracking.
- No sky color as text. No emoji. No purple-to-blue gradient.

## 10. Self-check

1. Every screen works at dawn (light mode) and at night (dark mode).
2. Fraunces comes only from the `display`, `title`, `serif`, and `italic` roles; all other
   text is Nunito Sans. Text on the sky is `text-hero-foreground`.
3. Each italic line has its own `t()` key, and a screen has at most one.
4. The orb breathes (a CSS loop, no effect) on the welcome, home, and session, and rests at
   0.93 under reduced motion. Its gradient id comes from `useId()`.
5. The first-run home shows real zeros, and the steps (H1) or the prompt card (H2).
6. The welcome is W1, W2, or W3 in a `View` with `AppSafeAreaView`; the home is H1 or H2.
