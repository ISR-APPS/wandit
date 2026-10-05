# Minuit — the queue outside at midnight

`minuit` · loud · dark only · best for: events, nightlife, clubs, concerts, cinema, tickets,
festivals, music, theater · avoid for: clinic, finance, kids, school, bakery, wellness

## 1. Feel

The queue outside, the bass through the wall, a stamp on the wrist. A violet-black room lit by
one hot gradient, magenta into tangerine, like stage light through haze. Headlines are big,
tight, lowercase grotesk, like a wall poster. Facts are mono caps, like a ticket. Light glows,
glass floats, tickets have torn edges. Loud, never messy.

Voice: short, present tense. "Doors 22:00". "You are in." No exclamation marks, no emoji, no hype.

## 2. World law and client choices

World law, the same in every Minuit app:

- Violet-black ground, glass, and one gradient (`from-hero-start to-hero-end`). It fills the
  main action, the gradient borders, and one hero per screen. Text on it is always
  `text-hero-foreground` (near black). Magenta (`accent`) marks the active tab, focus, and links.
- Space Grotesk for words; Space Mono (`font-label`) for ticket facts and labels.
- `--radius: 1rem`: buttons are pills (48 px). Tickets and tiles are `rounded-xl` (24 px)
  Views. Do not use `AppCard`: on the web it keeps its own 48 px corner.
- Signatures: the ticket stub, the gradient border, the glow. Dark only: the light block holds
  the dark values.

Client choices: the welcome (W1, W2, W3), the home (H1, H2), the photo subject, and the lead
slot name ("Tonight", "Next up"). Two Minuit apps never share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 1rem;
}

@theme static {
	--font-normal: "SpaceGrotesk_400Regular";
	--font-medium: "SpaceGrotesk_500Medium";
	--font-semibold: "SpaceGrotesk_600SemiBold";
	--font-bold: "SpaceGrotesk_700Bold";
	--font-display: "SpaceGrotesk_700Bold";
	--font-label: "SpaceMono_400Regular";
}

@theme static {
	--color-glow: var(--glow);
}

@layer theme {
	:root {
		@variant light {
			--background: #0b0712;
			--foreground: #f7f2ff;
			--surface: #150e21;
			--surface-foreground: #f7f2ff;
			--surface-secondary: #1d1430;
			--surface-tertiary: #291c42;
			--overlay: #1a1229;
			--muted: #a797c4;
			--accent: #ff3d9a;
			--accent-foreground: #0b0712;
			--default: #241834;
			--default-foreground: #f7f2ff;
			--border: #ffffff1a;
			--separator: #ffffff12;
			--field-background: #150e21;
			--field-border: #ffffff29;
			--field-placeholder: #7e6f99;
			--color-default-hover: #2e2043;
			--success: #3ee6a0;
			--success-foreground: #0b0712;
			--warning: #ffb547;
			--warning-foreground: #0b0712;
			--danger: #ff6058;
			--danger-foreground: #0b0712;
			--segment: #33244d;
			--segment-foreground: #f7f2ff;
			--focus: #ff3d9a;
			--hero-start: #ff2e93;
			--hero-end: #ff8a3d;
			--hero-foreground: #12081c;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.2) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--glow: #8b3dff;
		}

		@variant dark {
			--background: #0b0712;
			--foreground: #f7f2ff;
			--surface: #150e21;
			--surface-foreground: #f7f2ff;
			--surface-secondary: #1d1430;
			--surface-tertiary: #291c42;
			--overlay: #1a1229;
			--muted: #a797c4;
			--accent: #ff3d9a;
			--accent-foreground: #0b0712;
			--default: #241834;
			--default-foreground: #f7f2ff;
			--border: #ffffff1a;
			--separator: #ffffff12;
			--field-background: #150e21;
			--field-border: #ffffff29;
			--field-placeholder: #7e6f99;
			--color-default-hover: #2e2043;
			--success: #3ee6a0;
			--success-foreground: #0b0712;
			--warning: #ffb547;
			--warning-foreground: #0b0712;
			--danger: #ff6058;
			--danger-foreground: #0b0712;
			--segment: #33244d;
			--segment-foreground: #f7f2ff;
			--focus: #ff3d9a;
			--hero-start: #ff2e93;
			--hero-end: #ff8a3d;
			--hero-foreground: #12081c;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.2) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--glow: #8b3dff;
		}
	}
}
```

`--glow`: the violet of the second glow. `app.json`: both splash colors and the adaptive icon
`#0B0712`, `"userInterfaceStyle": "dark"`. Use `<StatusBar style="light" />`.

## 4. Type

`npx expo install @expo-google-fonts/space-grotesk @expo-google-fonts/space-mono`

```ts
import { SpaceGrotesk_400Regular } from "@expo-google-fonts/space-grotesk/400Regular";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { SpaceMono_400Regular } from "@expo-google-fonts/space-mono/400Regular";

export const appFonts = {
	SpaceGrotesk_400Regular,
	SpaceGrotesk_500Medium,
	SpaceGrotesk_600SemiBold,
	SpaceGrotesk_700Bold,
	SpaceMono_400Regular,
};
```

- `display` in `app-text.tsx`: `font-display text-6xl leading-[0.95] tracking-tighter lowercase
  text-foreground` (`text-7xl` on a welcome). `title`: `font-display text-4xl leading-10
  tracking-tighter lowercase text-foreground`. Event and artist names add `normal-case`: only
  text from `t()` is lowercase.
- Add a `label` role to `AppText`: `font-label text-[11px] uppercase tracking-[2px] text-muted`,
  for dates, doors, rows, codes, and section heads. A big date: the day in `display text-5xl`.
- Arabic twin: `npx expo install @expo-google-fonts/reem-kufi @expo-google-fonts/ibm-plex-sans-arabic`.
  `--font-display`: `ReemKufi_700Bold`. The four weights: `IBMPlexSansArabic_400Regular`,
  `_500Medium`, `_600SemiBold`, `_700Bold`. `--font-label`: `IBMPlexSansArabic_600SemiBold`.
  Drop `uppercase`, `lowercase`, and the tracking. Times and codes keep Latin digits.

```ts
import { IBMPlexSansArabic_400Regular } from "@expo-google-fonts/ibm-plex-sans-arabic/400Regular";
import { IBMPlexSansArabic_500Medium } from "@expo-google-fonts/ibm-plex-sans-arabic/500Medium";
import { IBMPlexSansArabic_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold";
import { IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic/700Bold";
import { ReemKufi_700Bold } from "@expo-google-fonts/reem-kufi/700Bold";
```

## 5. Signatures

1. **The ticket stub.** A `flex-row rounded-[23px] bg-surface` inside the border wrapper
   (signature 2). Start: a `w-24 items-center justify-center py-5` stub (month `label`, day
   `display text-5xl`). Then the perforation: a `w-0.5 self-stretch my-3` View around an `Svg`
   (`width={2} height="100%"`) with a `Line` (`strokeDasharray="2 6"`, `muted`,
   `strokeOpacity={0.5}`): a one-side dashed border fails on iOS. End: `flex-1 gap-1 p-4`
   (name, venue, doors in `label`). Notches: two `size-6 rounded-full bg-background` Views,
   absolute `-top-3` and `-bottom-3` at `start-[86px]`, last in the wrapper. The full ticket
   (detail, wallet) is vertical, notches at `-start-3`, `-end-3`.
2. **The gradient border.** `<View className="overflow-hidden rounded-xl bg-linear-to-br
   from-hero-start to-hero-end p-px">` around a `rounded-[23px] bg-surface` View. It marks the
   next ticket, the featured poster, and a chosen chip; other tickets get `border
   border-border`. The main action: an `AppPressable` (`overflow-hidden rounded-full`) around a
   `h-14 items-center justify-center bg-linear-to-r from-hero-start to-hero-end` View, label
   `heading text-lg text-hero-foreground`.
3. **The glow.** Behind the hero object, an `absolute -top-24 -start-20 size-[420px]
   pointer-events-none` View holds an `Svg` (`width="100%" height="100%"`) with a
   `RadialGradient` (`Stop` 0 at `stopOpacity={0.55}`, 1 at 0) and a `Circle` (`r="50%"`) filled
   with it. `useCSSVariable(["--accent", "--glow"])` gives the magenta glow and a violet one at
   the bottom end (pass only strings). The gradient id comes from `useId()`, colons removed:
   SVG ids are global on the web. At most two glows per screen.

Glass: `npx expo install expo-blur`. A parent View with `overflow-hidden border border-border`
holds, first, `<BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />` on iOS,
or an `absolute inset-0 bg-overlay/90` View on Android and web.

## 6. Screens

**Welcome**: a `flex-1` View, not `Screen`, with an `AppSafeAreaView` inside for the text and
the buttons. Pick one:

- W1 Poster: the generated photo (2:3) fills the screen under `bg-linear-to-t from-background
  via-background/80 to-transparent`, a magenta glow behind the headline. At the bottom,
  `px-6 pb-10 gap-4`: the app name in `display text-7xl`, a `label` line of the real categories,
  the gradient action ("Get started"), and a glass pill ("I have an account").
- W2 Ticket drop: no photo, two glows. In the center, a full ticket (`w-[72%] h-[320px]`,
  gradient border) at `rotate-[-5deg]`: the app name in `display text-5xl`, "ADMIT ONE" in
  `label` under the perforation. Buttons at the bottom.
- W3 Lineup: a festival bill in type, centered: a gradient bar (`h-1 w-16 rounded-full`), the app
  name in `display text-7xl`, then 3 lines of real features in `title` at `text-3xl`,
  `text-2xl`, `text-xl` (`text-foreground`, `/80`, `/60`), split by a `·` in `text-accent`.
  Buttons below.

**Sign-in and sign-up**: full screen, header hidden, a glass close button top. The top 34 %
holds a glow and the app name in `display text-5xl`. Then a sheet (`-mt-6 flex-1 rounded-t-[32px]
bg-surface px-6 pt-8 gap-5`): a `title`, the fields, the gradient action, a ghost switch link.

**Onboarding** (only for a city or tastes): one question per screen, at most 3, story segments
on top (`h-1 flex-1 rounded-full`, done ones in the gradient). Chips: `h-11 rounded-full border
border-border bg-surface px-4`; a chosen chip gets the gradient border and `tapFeedback()`.

**Home, first run**:

- H1 Tonight: the date and `AppAvatar` on top. The featured poster: `h-[440px]`, gradient
  border, the next event photo (or the generated one), the W1 scrim, a glass date block top
  start (month `label`, day `display text-4xl`), the name at the bottom. Then the real week: a
  `flex-row gap-1.5` of 7 pills (`h-20 flex-1 rounded-full bg-surface`), today in the gradient,
  a `size-1.5 bg-accent` dot on days with events. Zero events: the poster is pure gradient,
  "no plans yet" in `display text-hero-foreground`, and a `bg-background` pill that opens the
  create flow.
- H2 Wallet: the `title` and the real count in `display text-8xl`. Under it, full tickets
  (`h-[220px]`) stack like a wallet: each one after the first gets `-mt-[150px]`. Zero tickets:
  one dashed ticket (`h-44 rounded-xl border-2 border-dashed border-border`), "+ add your first ticket".

**Lists**: row tickets grouped by date under a `label` header. Status from data only, a dot and
a word: "Going" (`bg-success/15 text-success`), "Sold out" (`bg-danger/15 text-danger`). Every
tab screen adds `pb-28` to its content to clear the floating tab bar.

**Detail**: the photo band (55 %, scrim, one glow), the name, a glass panel of `label` and value
rows. A sticky glass bar (`absolute inset-x-0 bottom-0 px-5 pt-3 pb-8`) holds the price from
data, if any, and the gradient action. The ticket shows its code in `label text-2xl text-foreground`.

**Empty state art**: two small tickets (`w-40 h-24`): one `bg-surface-tertiary` at
`rotate-[8deg]`, one with the gradient border at `rotate-[-6deg]` and the icon, a glow under both.

**Tab bar**: a floating glass pill. `tabBarStyle: { position: "absolute", bottom: insets.bottom + 8,
marginHorizontal: 16, height: 64, paddingBottom: 0, borderRadius: 32, borderTopWidth: 0,
overflow: "hidden", backgroundColor: "transparent" }` (insets from `useSafeAreaInsets`),
`tabBarShowLabel: false`. `tabBarBackground` returns the glass layer plus
`<View className="absolute inset-0 rounded-[32px] border border-border" />`. Inactive:
`<name>-outline`. Active: the filled name with a `size-1 rounded-full bg-accent` dot under it.

## 7. Motion

- Entry: `FadeInUp.springify().damping(16)`, `.delay(index * 70)` for the first 5 blocks.
- Posters: the `Animated.View` of the photo zooms once, a CSS animation: `animationName: {
  from: { transform: [{ scale: 1.1 }] }, to: { transform: [{ scale: 1 }] } }`,
  `animationDuration: "1600ms"`, `animationTimingFunction: "ease-out"`. None under reduced motion.
- Glow: a CSS loop on its View: `animationName: { from: { opacity: 0.65, transform: [{ scale:
  0.96 }] }, to: { opacity: 1, transform: [{ scale: 1.04 }] } }`, `animationDuration: "2800ms"`,
  `animationIterationCount: "infinite"`, `animationDirection: "alternate"`,
  `animationTimingFunction: "ease-in-out"`. One loop per screen. Still under reduced motion.
- Press: `animation={{ scale: { value: 0.96 } }}` on tickets and posters. W2 and a booked
  ticket enter with `ZoomIn.springify().damping(12)`; `successFeedback()` after a booking.
- `entering` goes on an outer `Animated.View`, a tilt (`rotate-[-5deg]`) on the ticket inside:
  on native, the animation replaces the transform of its view.
- Week strip: `layout={LinearTransition.springify().damping(18)}`. Never: shake, spin, a second loop.

## 8. Imagery

Night photos. `generate_image`, `aspect` `2:3` (W1), `4:5` (featured), `16:9` (detail band),
path `src/assets/<name>.png`, then `require()` the returned path. At most 2 in the first build.

Prompt model: "Night photograph, [subject of the app: raised hands before a lit stage / red
seats in a dark cinema / a dance floor seen from the booth], deep violet shadows, magenta and
tangerine stage light, haze in the beams, 35 mm grain, no text, no logos, no watermark."

Event photos from the data always win (`Image`, `resizeMode="cover"`). Never generate a known
artist, a readable face, a venue name, a lineup, daylight, a posed smile, or a sign with words.

## 9. Bans

- No white ground, no pastel, no second gradient.
- No white text on the gradient. No gradient text.
- No fake barcode or QR code, no invented lineup, price, or attendee count.
- No second pulse on a screen. No glow behind a list row. No emoji. No icon in a grey circle.

## 10. Self-check

1. The app opens dark on a phone in light mode, and on the web.
2. Headlines from `t()` are lowercase Space Grotesk; names keep their case; facts are Space
   Mono caps.
3. Each screen has one gradient hero, with near-black text on it.
4. Tickets have notches and an SVG perforation; only the next one has the gradient border.
5. The glass tab bar floats, with the translucent layer on Android and web; content clears it.
6. Reduced motion stops the glow loop and the poster zoom.
7. No price, code, or count that the data does not hold; a first-run home shows real zeros.
8. The week strip fits the screen; tickets and tiles are Views, not `AppCard`.
