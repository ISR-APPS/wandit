# Criée — the market hall at full voice

`criee` · loud · light only · best for: marketplace, classifieds, resale, swap, community,
student app, creators, flea market, local deals · avoid for: clinic, finance, luxury,
meditation, legal

## 1. Feel

Saturday morning at the flea market. Painted signs, price tags on string, everyone calls out.
The app is a poster wall on cream paper. Every block has a thick black edge and a hard black
shadow, like a stamped card. Stickers sit crooked. A ticker band runs the words of the market
across the screen. Three printer inks: sun yellow, cobalt blue, flame red.

Voice: a stall keeper with a good joke. Verbs first ("Post it", "Make an offer"). Capitals only
in display lines and stickers. No emoji.

## 2. World law and client choices

World law, the same in every Criée app:

- Cream ground, paper-white blocks, black ink. Every block and field has a 2 px black edge: in
  this file, `border-2` always means `border-2 border-foreground`.
- Three inks, one job each. Blue (`accent`) is action: primary button, selected filter, link.
  Yellow (`sun`) is attention: hero, stickers, ticker words, active tab. Red (`flame`) is hot:
  the "New" sticker and the unread dot.
- Hard shadows only: black, 4 px down and 4 px toward the end edge. No blur, ever.
- Archivo Black for display lines, titles, prices, and stickers. Archivo for the rest.
- Corners: big blocks `rounded-3xl` (18 px), small parts `rounded-lg`. `rounded-full` only on
  avatars and dots.
- Light only: `"userInterfaceStyle": "light"`; the dark block holds the light values.
- Three signatures: the stamp, the sticker, the ticker band.

Client choices, fresh for each app: the welcome (W1, W2, W3), the home (H1, H2), the ticker
words (3 to 6, from the promise or the real categories), and the W1 objects. Two Criée apps
never share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 2px;
	--radius: 0.375rem;
}

@theme static {
	--font-normal: "Archivo_400Regular";
	--font-medium: "Archivo_500Medium";
	--font-semibold: "Archivo_600SemiBold";
	--font-bold: "Archivo_700Bold";
	--font-display: "ArchivoBlack_400Regular";
}

@theme static {
	--color-sun: var(--sun);
	--color-flame: var(--flame);
}

@layer theme {
	:root {
		@variant light {
			--background: #fbf3e2;
			--foreground: #121212;
			--surface: #fffcf5;
			--surface-foreground: #121212;
			--surface-secondary: #f4e9d0;
			--surface-tertiary: #eadcbc;
			--overlay: #fffcf5;
			--muted: #595244;
			--accent: #2348f0;
			--accent-foreground: #ffffff;
			--default: #f1e5c8;
			--default-foreground: #121212;
			--border: #121212;
			--separator: #12121229;
			--field-background: #fffcf5;
			--field-border: #121212;
			--field-placeholder: #8a8172;
			--color-default-hover: #e8d9b5;
			--success: #3dcb6f;
			--success-foreground: #121212;
			--warning: #ffb61a;
			--warning-foreground: #121212;
			--danger: #c8261a;
			--danger-foreground: #ffffff;
			--segment: #121212;
			--segment-foreground: #fbf3e2;
			--focus: #2348f0;
			--hero-start: #ffd43b;
			--hero-end: #ffd43b;
			--hero-foreground: #121212;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 0 2px rgba(18, 18, 18, 1) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--sun: #ffd43b;
			--flame: #ff5a3c;
		}

		@variant dark {
			--background: #fbf3e2;
			--foreground: #121212;
			--surface: #fffcf5;
			--surface-foreground: #121212;
			--surface-secondary: #f4e9d0;
			--surface-tertiary: #eadcbc;
			--overlay: #fffcf5;
			--muted: #595244;
			--accent: #2348f0;
			--accent-foreground: #ffffff;
			--default: #f1e5c8;
			--default-foreground: #121212;
			--border: #121212;
			--separator: #12121229;
			--field-background: #fffcf5;
			--field-border: #121212;
			--field-placeholder: #8a8172;
			--color-default-hover: #e8d9b5;
			--success: #3dcb6f;
			--success-foreground: #121212;
			--warning: #ffb61a;
			--warning-foreground: #121212;
			--danger: #c8261a;
			--danger-foreground: #ffffff;
			--segment: #121212;
			--segment-foreground: #fbf3e2;
			--focus: #2348f0;
			--hero-start: #ffd43b;
			--hero-end: #ffd43b;
			--hero-foreground: #121212;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 0 2px rgba(18, 18, 18, 1) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--sun: #ffd43b;
			--flame: #ff5a3c;
		}
	}
}
```

Hero start equals hero end: flat ink. Text is black on `sun` and `flame`, white on `accent`,
and `text-hero-foreground` on the hero.
`app.json`: splash and adaptive icon `#FBF3E2`; `<StatusBar style="dark" />`.

## 4. Type

`npx expo install @expo-google-fonts/archivo-black @expo-google-fonts/archivo`

```ts
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black/400Regular";
import { Archivo_400Regular } from "@expo-google-fonts/archivo/400Regular";
import { Archivo_500Medium } from "@expo-google-fonts/archivo/500Medium";
import { Archivo_600SemiBold } from "@expo-google-fonts/archivo/600SemiBold";
import { Archivo_700Bold } from "@expo-google-fonts/archivo/700Bold";

export const appFonts = {
	ArchivoBlack_400Regular,
	Archivo_400Regular,
	Archivo_500Medium,
	Archivo_600SemiBold,
	Archivo_700Bold,
};
```

- `display` in `app-text.tsx`: `font-display text-5xl uppercase leading-none tracking-tight
  text-foreground`, `text-6xl` on a hero. Archivo Black is wide: a long app name gets
  `adjustsFontSizeToFit numberOfLines={2}`.
- `title` keeps the template string (Archivo Black, sentence case). A price is `title text-2xl
  tabular-nums`, from the row only (`Intl.NumberFormat`, the currency of the row).
- Add a `label` role: `font-display text-xs uppercase tracking-widest text-foreground`, for
  stickers, chips, and small headers.
- Arabic twin: `npx expo install @expo-google-fonts/rakkas @expo-google-fonts/cairo`.
  `--font-display` is `Rakkas_400Regular`; the four weights are Cairo 400, 500, 600, 700.
  Drop `uppercase` and the tracking. Rakkas is tall: `leading-tight`, not `leading-none`.

```ts
import { Cairo_400Regular } from "@expo-google-fonts/cairo/400Regular";
import { Cairo_500Medium } from "@expo-google-fonts/cairo/500Medium";
import { Cairo_600SemiBold } from "@expo-google-fonts/cairo/600SemiBold";
import { Cairo_700Bold } from "@expo-google-fonts/cairo/700Bold";
import { Rakkas_400Regular } from "@expo-google-fonts/rakkas/400Regular";
```

## 5. Signatures

Map each tone or kind to a full class string in an object.

1. **The stamp.** `src/shared/ui/stamp.tsx` (`Stamp`), props `tone` (`surface`, `sun`, `accent`,
   `flame`), `className` (outer: size, margin, position, tilt), `faceClassName` (face: padding,
   layout), `onPress`, `isDisabled`. The outer `relative pe-1 pb-1` is a `View`, or with
   `onPress` an `AppPressable animation="disable-all" isAnimatedStyleActive={false}
   accessibilityRole="button"` (its scale style erases a tilt). It holds the shadow `absolute
   top-1 start-1 bottom-0 end-0 rounded-3xl bg-foreground` and the face, an `Animated.View`
   `grow overflow-hidden rounded-3xl border-2` plus the tone and `faceClassName` (not `flex-1`:
   it collapses an outer with no height). `onPressIn` slides the face 3 px into the shadow (`translateY`, and
   `translateX` negated in RTL, `withTiming` 70 ms); `onPressOut` returns it in 120 ms. Primary
   buttons are `accent` stamps: face `h-14 items-center justify-center px-6`, text `title
   text-lg leading-6 uppercase text-accent-foreground`. Pending: `isDisabled`, and `AppSpinner`
   with `color` from `useThemeColor("accent-foreground")` (the default color is accent). Other
   actions: `AppButton variant="ghost"`.
2. **The sticker.** An outer `Animated.View` `absolute top-3 start-3` (the `entering`) holds a
   View `rounded-lg border-2 px-2 py-0.5` (the fill and the tilt) with a `label`. Always tilted,
   only from a real field. New (under 48 h): `bg-flame -rotate-6
   rtl:rotate-6`. Free (price 0): `bg-sun rotate-[4deg] rtl:rotate-[-4deg]`. Sold:
   `bg-foreground rotate-[-3deg] rtl:rotate-[3deg]`, label `text-background`. At most 2 per card.
3. **The ticker band.** `src/shared/ui/ticker.tsx` (`Ticker`), props `words` (translated),
   `tone` (`ink`: `bg-foreground`, `text-sun`; `sun`: `bg-sun`, `text-foreground`), `reverse`,
   `className` (band). Band `-mx-5 h-11 justify-center overflow-hidden`. In it, a `self-start
   flex-row` `Animated.View` (sized by its content, not the band) holds two equal copies: the
   words repeated to 8 or more (`title text-lg leading-6 uppercase`), each followed by a `mx-4
   size-2 rotate-45` diamond in the text color. `onLayout` stores `copyWidth` (half the row width) in state.
   A CSS loop in `style` moves `translateX` from 0 to `-copyWidth` (`copyWidth` in Arabic):
   `animationDuration: copyWidth * 25` (ms), `animationTimingFunction: "linear"`,
   `animationIterationCount: "infinite"`, `animationDirection: "reverse"` when `reverse`. No
   loop before `onLayout`. One per screen (W3: two).

## 6. Screens

**Welcome** (signed-out start): a `flex-1` View, not `Screen`, with an `AppSafeAreaView` inside
for the text and the buttons. Pick one:

- W1 Flyer wall: the top 58 % holds 3 photo flyers, absolute stamps: `w-[50%] top-8 start-5
  -rotate-6` (`sun`), `w-[44%] top-20 end-5 rotate-[5deg]` (`accent`), `w-[40%] top-[44%]
  start-[28%] -rotate-2` (`flame`); face `p-2`, `Image` `aspect-[4/5] w-full rounded-lg`. An
  `ink` ticker crosses under them. Bottom, `px-5 pb-10 gap-4`: the app name (`display`), a
  promise, the primary stamp ("Get started"), a ghost "I have an account".
- W2 Price tag: no photo. The top 60 % is `items-center justify-center border-b-2
  border-foreground bg-hero-start`, with a `surface` stamp `w-[80%] rotate-[-8deg]` (face `p-6
  gap-2`) cut as a price tag: a punched hole `size-5 rounded-full border-2 bg-hero-start` at its
  top start, the app name in `display text-5xl`, and the promise. Buttons on cream below.
- W3 Crossed tapes: the top 55 % is `bg-accent`, the rest cream. Two tickers cross on the seam:
  `ink` at `rotate-[-7deg]`, `sun` at `rotate-[5deg]` with `reverse`, both `-mx-10`. Below:
  name, promise, buttons.

**Sign-in and sign-up**: full screen, `headerShown: false`, a close button for the modal case. A
band `-mx-5 -mt-5 h-44 justify-end border-b-2 bg-hero-start px-5 pb-5` with the app name
(`display text-5xl`) and a `flame` sticker ("Hello") at `top-6 end-5`. Then the `title`, the
fields, the primary stamp, a ghost switch.

**Onboarding** (setup facts only, such as the campus or the city; at most 3 screens): 3 `size-4
rounded-sm border-2` squares fill `bg-sun` step by step. Answers are `h-11 rounded-lg border-2
px-4` chips; a selected chip becomes a `sun` stamp.

**Home, first run** (no rows yet):

- H1 Market board: the app name (`title text-2xl`) and an `AppAvatar` inside a `rounded-full
  border-2` View. A `surface` stamp as the search bar (face `h-14 flex-row items-center gap-3
  px-4`, a `search` icon and "Search"). The `ink` ticker with the categories, a row of small
  category stamps (tones in turn), then "Fresh in": a 2-column grid of listing stamps (photo
  `aspect-[4/5] w-full border-b-2`, stickers, then name, price, place in `p-3 gap-1`). Zero
  rows: one `sun` stamp, face `p-5 gap-4`: a `display text-8xl` "0", the `label` "listings
  yet", 3 numbered steps ("Snap a photo", "Set your price", "Post it"), the primary stamp "Post
  your first listing".
- H2 Pinboard: a sun hero bleeds to the edges (`-mx-5 -mt-5 gap-4 border-b-2 bg-hero-start px-5
  pb-6 pt-4`): a date `label`, a `display text-5xl` question, the primary stamp "Sell". Below,
  two `flex-1 gap-5` columns; items alternate, the second column starts at `mt-10`, and cards
  tilt `rotate-[-1.5deg]` and `rotate-[1.5deg]` in turn. Zero rows: the empty art and the 3
  steps.

**Lists**: flat rows, no shadow. A `FlatList` with `gap-3 p-5`; row `h-20 flex-row items-center
gap-3 rounded-2xl border-2 bg-surface px-3`: a `size-14 rounded-lg border-2` thumbnail, name and
`caption`, price or sticker at the end. Unread (real state only): `size-3 rounded-full border-2
bg-flame`. Settings: `AppListGroup`.

**Detail**: the photos in a `pagingEnabled` horizontal `FlatList` in a `surface` stamp, with the
stickers. The `title`, then the price tag: a `sun` stamp `self-start rotate-[-3deg]`, `title
text-3xl` in a `px-4 py-2` face. A pinned bar `flex-row gap-3 border-t-2 bg-surface px-5 pt-3
pb-8`: a `size-14` save stamp (`heart-outline`) and a `flex-1` primary stamp "Message seller".

**Empty state art**: a `flex-row` of a `sun` stamp `size-24 rotate-[-10deg]` and an `accent`
stamp `size-24 rotate-[6deg] -ms-8 mt-6`, face `items-center justify-center`, with the outline
icon (`size={40}`, `colorClassName="accent-accent-foreground"`).

**Tab bar**: `tabBarStyle` `{ backgroundColor: surface, borderTopWidth: 2, borderTopColor:
foreground }` from `useThemeColor`; active tint the foreground. Focused: the filled icon
(`size={20}`) on a `h-7 w-12 items-center justify-center rounded-lg border-2 bg-sun` tile (28 px,
the icon slot); else `<name>-outline`. `tabBarLabelStyle`: `{ fontSize: 11 }`; add
`textTransform: "uppercase", letterSpacing: 1` only when the app is not in Arabic.

## 7. Motion

Loud but short: things snap, nothing floats.

- Entry: `FadeInDown.springify().damping(14)`, `.delay(index * 50)` on the first 6 cards only.
- Stickers: `ZoomIn.springify().damping(10).delay(150)`.
- `entering` goes on an outer `Animated.View`, the tilt on the view inside: on native, the
  animation replaces the transform of its view.
- Press: the stamp sink plus `tapFeedback()`, never a scale.
- After a post: a "Posted" sticker (`display` text, `rotate-[-8deg]`) enters with
  `ZoomIn.springify().damping(8)`, and `successFeedback()`.
- Reduced motion: no ticker loop, no springs (`FadeIn.duration(200)`). The sink stays.

## 8. Imagery

Only W1 needs images: `generate_image`, `aspect` `4:5`, `src/assets/flyer-1.png` to
`flyer-3.png`, each loaded with `require()` in an `Image` with `resizeMode="cover"`.

Prompt model: "Flash photo of one [object from the app: worn sneakers / used textbooks / a film
camera], centered on a flat [sun yellow / cobalt blue / tomato red] paper backdrop, hard direct
flash, crisp black shadow, no people, no text, no logos, no watermark."

- At most 3 images in the first build, one per ink.
- Listing photos come only from users. Never generate a listing, a price, a person, or a brand.

## 9. Bans

- No blurred shadow, no gradient, no glass, no dark mode, no fourth ink, no grey card.
- No block without its 2 px black edge. No shadow on long list rows.
- No invented counts, prices, sellers, ratings, or reviews. No emoji.

## 10. Self-check

1. The app opens light, also on a phone in dark mode.
2. Every block has a 2 px black edge; cards and primary buttons have a hard shadow and sink.
3. Display lines, titles, prices, and stickers are Archivo Black; the rest is Archivo.
4. Each ink keeps its job: blue acts, yellow calls, red is hot.
5. Every sticker is tilted, also while it enters, and maps to a real field.
6. Ticker words come from `t()`; the loop has no jump or gap and stops under reduced motion.
7. The welcome uses W1, W2, or W3, and the home H1 or H2, with real zeros only.
