# Boudoir — a bronze mirror in a blush room, before the doors open

`boudoir` · quiet · light + dark · best for: beauty salon, spa, barber, nail studio, lash and
brow, aesthetics, fashion boutique, bridal · avoid for: gym, kids, finance, logistics, food delivery

## 1. Feel

Blush plaster walls, a bronze mirror frame, folded linen, one warm lamp. The app is calm and
slow, like a salon before the first client. Portraits sit in a thin frame, like a print in a
mat. A fine serif carries names and times; a geometric sans carries the rest. Time is the
hero: the next visit is a large serif numeral. Space and thin lines do the work.

Voice: polite and brief. "Your next visit", "Book a time", "Thursday, 10:30". No exclamation
marks, no emoji, no hype words ("glow up", "amazing").

## 2. World law and client choices

World law, the same in every Boudoir app:

- Blush greige ground (cocoa at night), warm ink text, one bronze accent. Bronze marks the
  primary pill, the active tab rule, the selected day rule, and the mat around a portrait.
- Cormorant Garamond for display, names, and numerals. Its italic (`font-display-italic`)
  sets one word per headline. Jost for all other text. No weight above Jost 600.
- Near-square corners: `--radius: 0.125rem` (HeroUI cards and buttons 6 px, fields 3.5 px).
  The primary action is the pill (section 5). Only pills and avatars are round.
- Hairlines (`h-px bg-border`) divide sections. No shadows on cards.
- Three signatures: the framed portrait, the ruled label, the serif hour (section 5).

Client choices, decided fresh for each app:

- The welcome (W1, W2, or W3) and the home (H1 for clients, H2 for staff) in section 6.
- The subject of the portraits (section 8) and the italic word of the welcome headline.

Two Boudoir apps must never share the same welcome and home composition.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.125rem;
}

@theme static {
	--font-normal: "Jost_400Regular";
	--font-medium: "Jost_500Medium";
	--font-semibold: "Jost_600SemiBold";
	--font-bold: "Jost_600SemiBold";
	--font-display: "CormorantGaramond_500Medium";
	--font-display-italic: "CormorantGaramond_500Medium_Italic";
}

@theme static {
	--color-blush: var(--blush);
}

@layer theme {
	:root {
		@variant light {
			--background: #f2eae5;
			--foreground: #211a17;
			--surface: #faf6f3;
			--surface-foreground: #211a17;
			--surface-secondary: #ebe1db;
			--surface-tertiary: #e1d5cd;
			--overlay: #faf6f3;
			--muted: #6b5d55;
			--accent: #8a5a35;
			--accent-foreground: #fbf6f1;
			--default: #e6d9d1;
			--default-foreground: #211a17;
			--border: #211a1729;
			--separator: #211a171a;
			--field-background: #faf6f3;
			--field-border: #211a1733;
			--field-placeholder: #8f8079;
			--color-default-hover: #ddcec5;
			--success: #3f6b4e;
			--success-foreground: #fbf6f1;
			--warning: #d9a441;
			--warning-foreground: #211a17;
			--danger: #a3362e;
			--danger-foreground: #fbf6f1;
			--segment: #faf6f3;
			--segment-foreground: #211a17;
			--focus: #8a5a35;
			--hero-start: #2e221d;
			--hero-end: #5e4335;
			--hero-foreground: #f6eee8;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 16px 40px 0 rgba(33, 26, 23, 0.14);
			--field-shadow: 0 0 0 0 transparent inset;
			--blush: #e8d4ca;
		}

		@variant dark {
			--background: #1b1411;
			--foreground: #f3e8e1;
			--surface: #251c18;
			--surface-foreground: #f3e8e1;
			--surface-secondary: #2f2420;
			--surface-tertiary: #3a2c26;
			--overlay: #2a201c;
			--muted: #b8a69b;
			--accent: #c9946a;
			--accent-foreground: #1b1411;
			--default: #3a2c26;
			--default-foreground: #f3e8e1;
			--border: #f3e8e124;
			--separator: #f3e8e117;
			--field-background: #251c18;
			--field-border: #f3e8e133;
			--field-placeholder: #8a7b72;
			--color-default-hover: #44352e;
			--success: #8fc4a0;
			--success-foreground: #1b1411;
			--warning: #e0b45e;
			--warning-foreground: #1b1411;
			--danger: #e8867a;
			--danger-foreground: #1b1411;
			--segment: #41302a;
			--segment-foreground: #f3e8e1;
			--focus: #c9946a;
			--hero-start: #140e0c;
			--hero-end: #4a362c;
			--hero-foreground: #f3e8e1;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(243, 232, 225, 0.18) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--blush: #3f2e28;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#F2EAE5`, dark splash `#1B1411`,
`android.adaptiveIcon.backgroundColor` `#F2EAE5`, `"userInterfaceStyle": "automatic"`.

## 4. Type

`npx expo install @expo-google-fonts/cormorant-garamond @expo-google-fonts/jost`

```ts
import { CormorantGaramond_500Medium } from "@expo-google-fonts/cormorant-garamond/500Medium";
import { CormorantGaramond_500Medium_Italic } from "@expo-google-fonts/cormorant-garamond/500Medium_Italic";
import { Jost_400Regular } from "@expo-google-fonts/jost/400Regular";
import { Jost_500Medium } from "@expo-google-fonts/jost/500Medium";
import { Jost_600SemiBold } from "@expo-google-fonts/jost/600SemiBold";

export const appFonts = {
	CormorantGaramond_500Medium,
	CormorantGaramond_500Medium_Italic,
	Jost_400Regular,
	Jost_500Medium,
	Jost_600SemiBold,
};
```

Roles in `app-text.tsx` (full strings, one face each):

- `display`: `font-display text-6xl leading-[64px] text-foreground`. `title`: `font-display
  text-4xl leading-[44px] text-foreground`. `heading`: `font-display text-2xl leading-8
  text-foreground`. Cormorant is small: never below `text-xl`, never a paragraph.
- Add `label`: `font-medium text-[11px] uppercase tracking-[2.5px] text-muted`. It names
  every section, field, and meta line.
- Add `italic`: `font-display-italic text-2xl leading-8 text-accent`. It sets the weekday,
  the Roman numerals, the month, the monogram, and the initials.
- The italic word of a headline is a message parameter (`{word}`), never a second message.
  Split the unfilled `t(key)` at `{word}`. Nest the word as `<AppText variant="display"
  className="font-display-italic">`, or `variant="title"` in a title. `cn` keeps one face.
  On a photo or a hero, the word also takes `text-hero-foreground`.
- Arabic twin: `npx expo install @expo-google-fonts/noto-naskh-arabic`. `--font-normal` is
  `NotoNaskhArabic_400Regular`, `--font-medium` and `--font-display-italic` are `_500Medium`
  (no italics in Arabic), the other three are `_600SemiBold`. Drop `uppercase` and tracking.

```ts
import { NotoNaskhArabic_400Regular } from "@expo-google-fonts/noto-naskh-arabic/400Regular";
import { NotoNaskhArabic_500Medium } from "@expo-google-fonts/noto-naskh-arabic/500Medium";
import { NotoNaskhArabic_600SemiBold } from "@expo-google-fonts/noto-naskh-arabic/600SemiBold";
```

## 5. Signatures

1. **The framed portrait.** A photo (section 8) with a hairline frame inset from its edges:
   `<Image className="absolute inset-0 size-full" resizeMode="cover" />` in an absolute
   `Animated.View` (the scale, section 7), the scrim `<View className="absolute inset-0
   bg-linear-to-t from-hero-start/90 via-hero-start/30 to-transparent" />`, then `<View
   pointerEvents="none" className="absolute inset-3 border border-hero-foreground/50" />`.
   Text sits inside the frame, on the dark end, in hero colors (section 6). On a light
   page, the frame becomes a bronze mat around the image: a wrapper `border border-accent p-2`.
2. **The ruled label.** A `flex-row items-center gap-3` row: the `label` text, then
   `<View className="h-px flex-1 bg-border" />`. It opens every section. Numbered steps put
   a Roman numeral first: `italic` with `text-xl leading-7` ("I", "II", "III").
3. **The serif hour.** Every booked time is a Cormorant numeral: `display` with `text-7xl
   leading-[72px] tabular-nums` in a lead, `heading` with `text-3xl leading-9 tabular-nums` in
   a list. Format with `Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit"
   }).formatToParts()`. Join and trim the parts without `dayPeriod` for the numeral; show
   `dayPeriod` as a `label` beside it. The weekday sits above in `italic`
   (`text-hero-foreground/80` on a hero card or a photo: bronze is too dark there).

**The pill** (the primary action): an `AppPressable` `h-14 items-center justify-center
rounded-full bg-accent px-8`, `accessibilityRole="button"`, label `AppText` `font-medium
text-accent-foreground`, `isDisabled` while it cannot act. Not `AppButton`: its own 8 px
corner beats `rounded-full` on the web. For the same reason, give `AppAvatar`
`style={{ borderRadius: 9999 }}`.

## 6. Screens

State classes (selected, done, a status) come from an object of full class strings. Hero
colors apply to all text on a photo, on W3, and on the H1 card. Text is
`text-hero-foreground`, `label` and `caption` are `/70`, hairlines are `bg-hero-foreground/25`.

**Welcome** (signed-out start of an app with accounts). Pick one. W1 and W3 are full-bleed:
a `flex-1` View with the photo or the gradient, `AppSafeAreaView` inside for text and buttons.

- W1 Framed portrait: the framed portrait fills the screen, `<StatusBar style="light" />`.
  The text block sits inside the frame bottom, `px-8 pb-12 gap-4`: the trade as a `label`,
  the name as `display`, and one `title` line with an italic word, all in hero colors. Then
  the pill and a text button (`AppPressable`, `AppText` in `text-hero-foreground`).
- W2 Passe-partout: the page ground. Top: the app name as a centered `label` between two
  hairlines. Then a `mx-10 mt-6 border border-accent p-2` mat with a 4:5 portrait. Under it,
  a centered `display text-5xl` with one italic word, a `caption`, the pill, a ghost button.
- W3 Monogram: no photo. Full screen `bg-linear-to-b from-hero-start to-hero-end`. The first
  letter of the app name in `italic` with `text-[280px] leading-[280px]
  text-hero-foreground/10` at `absolute -end-6 top-16`. At the bottom, in hero colors: a
  ruled label, the name as `display`, a `caption`, and the pill with `bg-hero-foreground`
  and its label in `text-hero-start`.

**Sign-in and sign-up**: full screen, `headerShown: false`. The top 32 % is the framed portrait
(the welcome image). With W3, it is a W3 gradient band with the monogram letter, no photo.
For the modal case, `ModalCloseButton` sits in a `size-10 rounded-full bg-background/80`
circle at `absolute end-4 top-4`. Below, `px-6 pt-8 gap-5`: the ruled label, a `title` with
one italic word, the fields, the pill, and the switch as a ghost button.

**Onboarding** (only for setup facts, like the opening days): at most 3 screens. Top: "II /
III" in `italic` over 3 hairlines (done `h-0.5 bg-accent`). The question is a `title`. Choices
are `rounded-sm border border-border px-4 py-3` rows; selected `border-accent bg-blush`.

**Home, first run** (no rows yet):

- H1 Next visit (client app): the name as `title`. A hero card `rounded-md bg-linear-to-br
  from-hero-start to-hero-end p-6 gap-3` has its own frame (`absolute inset-2 border
  border-hero-foreground/25`). It shows the `label` "NEXT VISIT" and the serif hour with its
  weekday. Under a `h-px bg-hero-foreground/25` hairline: the service and the stylist in
  Jost, all in hero colors. First run: "NO VISIT YET", an em dash numeral in
  `text-hero-foreground/40`, and a pill "Book a time" (`bg-hero-foreground`, label
  `text-hero-start`). Below: the ruled label "SERVICES" and rows.
- H2 Day ledger (staff app): the month in `italic` with `text-3xl leading-9 text-foreground`.
  A day strip: a horizontal `ScrollView` of `w-14 items-center gap-1 py-2` cells, weekday
  `label`, date in `heading` with `text-3xl leading-9`. The selected day has a `h-0.5 w-6
  bg-accent` rule under its date; others are `text-muted`. Then the day count: a `display`
  numeral (a real 0) and the `label` "APPOINTMENTS". Rows: `flex-row gap-4 py-4 border-b
  border-separator`, with a `w-24` serif hour, the client, and the service. First run: 3
  Roman-numbered `AppPressable` steps (add a service, set the hours, book the first client).

**Lists**: rows on the page ground, split by hairlines, no card. Leading: a `size-14
rounded-sm` photo, or a `bg-blush` square with initials in `italic` (`text-xl
text-foreground`). Title in `body font-medium`, meta as `label`, trailing a `heading` with
`text-xl leading-7` (an hour, a duration, a price from data). A status is a `label` word in
`text-success`, `text-warning`, or `text-danger`.

**Detail**: the framed portrait at 55 % height, the back button in a `size-10 rounded-full
bg-background/80` circle. Then a `label` meta line, the `title`, the body, ruled sections.
Times: a 3-column grid of `h-16 rounded-sm border border-border` cells with hours in
`heading`; selected `border-accent bg-blush`. A bottom bar `border-t border-separator
bg-background px-6 pt-3 pb-8` holds the pill.

**Empty state art**: pass `art` to `EmptyState`: a vanity mirror. In an `Svg` with
`width={120} height={150}`, two `Ellipse`s with `strokeWidth={1}`, no fill, `stroke` from
`useThemeColor("accent")`: `rx={56} ry={71}`, and `rx={48} ry={63}` at `strokeOpacity={0.35}`.
The icon (30, `colorClassName="accent-accent"`) sits in the center.

**Tab bar**: `tabBarStyle` with `borderTopWidth: StyleSheet.hairlineWidth`, `borderTopColor`
from `useThemeColor("separator")`. Icons: the filled name when active, `<name>-outline` when
not. `tabBarIcon` is an `items-center gap-1` View: a `h-px w-4` rule (`bg-accent`
when focused, else `bg-transparent`), then the icon at 22. `tabBarLabelStyle: { fontSize: 11,
textTransform: "uppercase", letterSpacing: 1.5 }`; in Arabic, only `fontSize: 11`.

## 7. Motion

Slow and still. Fades, no bounce.

- Entry: `FadeIn.duration(600)` on each block, `.delay(index * 120)` for the first 4 only.
- Portraits: a one-shot CSS animation on the `Animated.View` around the `Image`, `scale`
  1.04 to 1, `animationDuration: "2400ms"`, `animationTimingFunction: "ease-out"`. An
  entering fade goes on an outer view. The frame enters with `FadeIn.duration(800).delay(400)`.
- The day rule enters under the new date with `FadeIn.duration(250)`; a day tap calls
  `tapFeedback()`.
- Press: `AppPressable` `animation={{ scale: { value: 0.98 } }}`. `successFeedback()` after
  a booking.
- `useReducedMotion()` true: no portrait scale. Never: springs, `ZoomIn`, loops, parallax.

## 8. Imagery

Editorial portraits in soft window light. `generate_image` with `aspect` `2:3` for W1 and
sign-in, `4:5` for W2 and a detail. Path `src/assets/<name>.png`, then `require()` the
returned path with a fixed relative string.

Prompt model: "Editorial beauty photograph, [subject of the app: hands with a nude manicure on
folded linen / a woman in profile with a low sleek bun / a worn leather barber chair by a
window], soft side window light, warm blush, sand, and cocoa tones, matte film grain,
vertical framing, empty lower third, no text, no logos, no watermark."

- At most 3 images in the first build: the welcome portrait, one detail, one service.
- Never: before and after, skin close-ups, needles, product packs, bright studio white.

## 9. Bans

- No bright pink, no gold gradient, no glitter, no sparkle icon, no emoji.
- No corner above 6 px except the pill and avatars. No card shadows. No `AppButton` pill.
- No weight above Jost 600. No Cormorant below `text-xl`. No italics in Arabic.

## 10. Self-check

1. Each portrait has its inset hairline frame or its bronze mat.
2. Each section opens with a ruled label; every booked time is a serif numeral.
3. Light (blush) and dark (cocoa) both read well; text on a hero or a photo is hero colored.
4. Welcome is W1, W2, or W3; home is H1 or H2; the first run shows real zeros and steps.
5. Only the primary action is a pill (`AppPressable`, round on the web); all else is near square.
