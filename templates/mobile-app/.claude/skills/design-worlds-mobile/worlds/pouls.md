# Pouls — a calm clinic and one steady heartbeat line

`pouls` · quiet · light and dark · best for: clinic, doctor, dentist, pharmacy, appointments,
telehealth, lab results, physiotherapy, vet clinic · avoid for: nightlife, gym, kids games,
fashion, food delivery

## 1. Feel

A clinic at 8:55, before the first patient. White walls, a quiet waiting room, one teal line on
the monitor. The app is calm and exact: what happens next, when, and where. Teal says "this is in
order". Coral says "look at this now", and it is rare. One thin heartbeat line crosses each
screen. Times and results are large, light numerals.

Voice: a kind nurse at the desk. The fact first ("Tuesday 14 October, 10:30"). Plain words, no
jargon. Never alarm the user. No exclamation marks, no emoji.

## 2. World law and client choices

World law, the same in every Pouls app:

- Off-white ground, white cards, deep teal ink, one teal accent. Teal marks the primary action,
  the active tab, the selected day and time, and the pulse line.
- Coral (`danger`, on `bg-alert-tint`) marks alerts only: a result out of range, a cancelled
  visit, an allergy, a destructive action.
- Figtree in every role. Display is ExtraBold; times and values are Light.
- Two radii. Shells (hero, buttons, sheets, `AppCard`) are soft: 36 px from `--radius: 0.75rem`.
  Records are crisp: chart cards and time chips `rounded-xl`, day tiles `rounded-2xl`. Status
  chips are `rounded-full`.
- Three signatures: the pulse line, the chart card, the day strip with the time grid.
- Dark mode is the night ward: teal-black, never neutral grey.

Client choices, fresh for each app: the welcome (W1, W2, W3), the home (H1 patient side or H2
practice side), the lead fact (next visit, today's appointments, latest result), and a photo
subject or no photo. Two Pouls apps never share the same welcome and home.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.75rem;
}

@theme static {
	--font-normal: "Figtree_400Regular";
	--font-medium: "Figtree_500Medium";
	--font-semibold: "Figtree_600SemiBold";
	--font-bold: "Figtree_700Bold";
	--font-display: "Figtree_800ExtraBold";
	--font-numeric: "Figtree_300Light";
}

@theme static {
	--color-tint: var(--tint);
	--color-alert-tint: var(--alert-tint);
}

@layer theme {
	:root {
		@variant light {
			--background: #f5f8f8;
			--foreground: #0e2a2e;
			--surface: #ffffff;
			--surface-foreground: #0e2a2e;
			--surface-secondary: #edf3f3;
			--surface-tertiary: #e2ecec;
			--overlay: #ffffff;
			--muted: #52666a;
			--accent: #0b7a74;
			--accent-foreground: #ffffff;
			--default: #e6efef;
			--default-foreground: #0e2a2e;
			--border: #0e2a2e17;
			--separator: #0e2a2e12;
			--field-background: #ffffff;
			--field-border: #0e2a2e29;
			--field-placeholder: #7c8e90;
			--color-default-hover: #dae6e6;
			--success: #1f7a4d;
			--success-foreground: #ffffff;
			--warning: #f0b33e;
			--warning-foreground: #2a1c00;
			--danger: #c2412d;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #0e2a2e;
			--focus: #0b7a74;
			--hero-start: #0b6e6a;
			--hero-end: #0a4a55;
			--hero-foreground: #ffffff;
			--surface-shadow: 0 1px 3px 0 rgba(14, 42, 46, 0.08);
			--overlay-shadow: 0 12px 32px 0 rgba(14, 42, 46, 0.14);
			--field-shadow: 0 0 0 0 transparent inset;
			--tint: #e8f5f3;
			--alert-tint: #fdf0ec;
		}

		@variant dark {
			--background: #0a1416;
			--foreground: #e6f0f0;
			--surface: #11201f;
			--surface-foreground: #e6f0f0;
			--surface-secondary: #172829;
			--surface-tertiary: #1f3233;
			--overlay: #142425;
			--muted: #93a8aa;
			--accent: #3fc2b4;
			--accent-foreground: #04201d;
			--default: #1b2c2d;
			--default-foreground: #e6f0f0;
			--border: #ffffff14;
			--separator: #ffffff0f;
			--field-background: #11201f;
			--field-border: #ffffff26;
			--field-placeholder: #6a8082;
			--color-default-hover: #223536;
			--success: #4cc38a;
			--success-foreground: #052014;
			--warning: #f2ba4b;
			--warning-foreground: #241800;
			--danger: #ff7e68;
			--danger-foreground: #2a0a04;
			--segment: #2a3f40;
			--segment-foreground: #e6f0f0;
			--focus: #3fc2b4;
			--hero-start: #145350;
			--hero-end: #0c2e33;
			--hero-foreground: #f2faf9;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--tint: #10302e;
			--alert-tint: #3a1d18;
		}
	}
}
```

`app.json`: splash `backgroundColor` `#F5F8F8` (dark `#0A1416`), adaptive icon `#F5F8F8`,
`"userInterfaceStyle": "automatic"`, `<StatusBar style="auto" />`.

## 4. Type

`npx expo install @expo-google-fonts/figtree`

```ts
import { Figtree_300Light } from "@expo-google-fonts/figtree/300Light";
import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_600SemiBold } from "@expo-google-fonts/figtree/600SemiBold";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { Figtree_800ExtraBold } from "@expo-google-fonts/figtree/800ExtraBold";

export const appFonts = {
	Figtree_300Light,
	Figtree_400Regular,
	Figtree_500Medium,
	Figtree_600SemiBold,
	Figtree_700Bold,
	Figtree_800ExtraBold,
};
```

- Add a `clock` role to `AppText`: `font-numeric text-6xl leading-none tracking-tight tabular-nums
  text-foreground`. Every time, day number, count, and lab value uses it, except the time chips
  (booking slots, H2 ribbon). Resize it with a class (`text-3xl`); never add a `font-*` class to it,
  and never add `font-numeric` to another role.
- `display` and `title`: sentence case. Section labels: `caption font-semibold
  text-foreground`, never capitals. Units (`mmol/L`, `min`) are `caption`.
- Arabic twin: `npx expo install @expo-google-fonts/tajawal`. Each token takes the same weight,
  except: Tajawal has no 600, so `--font-semibold` is `Tajawal_700Bold`; `--font-bold` and
  `--font-display` are `Tajawal_800ExtraBold`. Remove `tracking-tight`.

```ts
import { Tajawal_300Light } from "@expo-google-fonts/tajawal/300Light";
import { Tajawal_400Regular } from "@expo-google-fonts/tajawal/400Regular";
import { Tajawal_500Medium } from "@expo-google-fonts/tajawal/500Medium";
import { Tajawal_700Bold } from "@expo-google-fonts/tajawal/700Bold";
import { Tajawal_800ExtraBold } from "@expo-google-fonts/tajawal/800ExtraBold";
```

## 5. Signatures

1. **The pulse line.** A flat line with one heartbeat, like a monitor trace. Build it once:
   `src/shared/ui/pulse-line.tsx` (`PulseLine`), props `tone` (`"accent"` or `"hero"`) and
   `draw` (one draw-in). Row `h-8 flex-row items-center`: a side line `h-0.5 flex-1
   bg-accent/50` (hero: `bg-hero-foreground/60`), an `Svg width={96} height={32}` with one
   `Path`, then a second side line. Path, `fill="none"`, `strokeWidth={2}`, round caps:
   `M0 16 H30 L34 12 L38 16 H44 L48 4 L53 28 L57 16 H64 L68 11 L73 16 H96`. Stroke:
   `useThemeColor("accent")`, or `useCSSVariable("--color-hero-foreground")` narrowed with
   `typeof`. One per screen: under a hero, as a divider, or as the "now" marker.
2. **The chart card.** A record with a start bar, like the tab of a patient file: `flex-row
   gap-4 rounded-xl border border-border border-s-4 bg-surface p-4 shadow-surface`. Bar color is
   the status: `border-s-accent` confirmed, `border-s-warning` waiting, `border-s-danger`
   cancelled, `border-s-surface-tertiary` past, from one literal map of full class strings. A
   chip repeats it in words: `rounded-full bg-surface-secondary px-2.5 py-1`, a `size-2` dot, a
   `caption font-medium` word. An alert chip is `bg-alert-tint` with `text-danger`.
3. **The day strip and the time grid.** The booking heart of the world (section 6).

## 6. Screens

**Welcome** (signed-out start): a `flex-1 bg-background` `View`, with `AppSafeAreaView` inside
for the text and the buttons. Not `Screen`. Pick one:

- W1 Monitor: the top 58 % is `rounded-b-[48px] bg-linear-to-b from-hero-start to-hero-end px-6
  pb-8 justify-end gap-3`, the pulse line (`tone="hero"`, `draw`) across its middle, the app
  name (`display text-hero-foreground`) and a promise at its bottom. Below, `px-6 pb-10 gap-3`:
  `AppButton size="lg"` ("Book a visit") and a ghost "I have an account".
- W2 This week: no image. A capsule `rounded-3xl bg-surface p-5 gap-4 shadow-surface` holds the
  real current week as a day strip and 2 rows of 3 empty dashed chips (`h-12 flex-1 rounded-xl
  border border-dashed border-border`). Then a `display text-4xl` promise, buttons.
- W3 Window: a `4:5` photo in `mx-5 mt-4 h-[54%] overflow-hidden rounded-3xl`, and a pill `-mt-7
  self-center rounded-full bg-surface px-5 py-3 shadow-overlay` with the app name over its
  bottom edge. Then a `title` promise and the buttons.

**Sign-in and sign-up**: full screen, `headerShown: false`, a close button for the modal case. A
band `h-40 justify-end rounded-3xl bg-linear-to-br from-hero-start to-hero-end p-5` with the app
name in `text-hero-foreground` and a still pulse line (`tone="hero"`). Then the `title`, the fields,
the primary button, a ghost switch.

**Onboarding** (setup facts only, at most 3 screens): one calm question card per screen. In the
upper third, a `rounded-3xl bg-surface p-6 gap-5 shadow-surface` card: the step as `1/3` in
`clock text-4xl text-accent`, the question in `title`, one `caption` line on why the clinic
asks, then the options (`rounded-xl border border-border p-4` rows; selected `border-accent
bg-tint` and a `checkmark-circle` in `accent-accent`). A still `PulseLine` under the card.
"Next" is pinned below.

**Booking**: a horizontal `ScrollView` of the next 14 days (`gap-2 px-5`). Day tile: `AppPressable`
`h-[76px] w-14 items-center justify-center gap-1 rounded-2xl border border-border bg-surface`,
weekday `caption text-xs`, day `clock text-2xl`. Selected: `bg-accent border-accent`, texts
`text-accent-foreground`. Today: weekday in `text-accent`. No free slot: `opacity-40` and
`isDisabled`. Below, the real free slots under "Morning" and "Afternoon", in rows of 3 (`flex-row
gap-2`; pad a short row with empty `flex-1` views). Chip: `h-12 flex-1 items-center justify-center
rounded-xl border border-border bg-surface`, time in `body font-semibold tabular-nums` (`clock` is
too thin at this size); selected `bg-accent` and `text-accent-foreground`. A bar pinned under the
scroll view, `border-t border-separator bg-surface px-5 pt-3 pb-8 gap-3`, shows the summary ("Tue 14
Oct · 10:30") and `AppButton size="lg"`.

**Home, first run** (no rows yet):

- H1 Next visit: date `caption`, greeting `title`. Hero capsule `gap-3 rounded-3xl bg-linear-to-br
  from-hero-start to-hero-end p-6`: a label, the next time in `clock text-7xl text-hero-foreground`,
  service and practitioner in `text-hero-foreground/80`, the pulse line. Zero visits: a real "0"
  over the `caption` label "Visits booked", and an `AppPressable` pill `h-11 self-start
  justify-center rounded-full bg-hero-foreground px-5` with `text-hero-start` ("Book a visit").
  Below: the week strip, then a "Get started" `AppCard` with 3 numbered `AppPressable` steps (the
  number in `text-accent`, in a `size-8 rounded-full bg-tint` circle).
- H2 Day ribbon (practice side): `title` "Today", the day strip, then the real count in `clock
  text-5xl` over the `caption` label "Visits today". The ribbon: a `w-0.5 bg-accent/30` line at
  `absolute start-[23px] inset-y-0`, and one stop per visit (`flex-row items-start gap-3 py-2`): a
  time chip on the line (`w-12 items-center rounded-xl bg-tint py-1`, the time in `body
  font-semibold tabular-nums text-accent`), then its chart card. A done stop's chip is
  `bg-surface-secondary` with `text-muted`. The `PulseLine` crosses the ribbon at "now" (computed in
  render). Zero rows: the count 0, one dashed stop (`rounded-xl border border-dashed
  border-accent/40 p-4`, "Add a visit"), and the H1 "Get started" card.

**Lists**: appointments by day, each a chart card with the time (`clock text-3xl`) in a `w-16`
column. A lab result with a reference range gets a track `h-1.5 rounded-full
bg-surface-tertiary` and a `size-3 rounded-full border-2 border-surface bg-accent` marker
between two flex spacers (`style={{ flexGrow: before }}` and `after`), so it mirrors in Arabic.
Clamp first: `before = clamp(value - min, 0, max - min)`, `after = max - min - before`. A value
below the range sits at the start, above it at the end. Out of range: `bg-danger` marker,
`text-danger` value, a "High" or "Low" alert chip. People: `AppListGroup` with
`<AppAvatar variant="soft" color="accent">` initials.

**Detail**: a small hero capsule with the `clock` time in `text-hero-foreground`, then "Where"
and "Before you come" split by the pulse line. "Cancel visit": `AppButton variant="danger-soft"`
and a confirm dialog.

**Empty state art**: `h-28 w-56 items-center justify-center rounded-3xl bg-tint` with a
`PulseLine` inside, and a `size-12 rounded-full bg-surface` badge at `absolute -top-3 -end-3`
with the outline icon in `accent-accent`. Nothing yet, but alive.

**Tab bar**: `tabBarStyle` background `useThemeColor("surface")`, `borderTopColor`
`useThemeColor("separator")`, active tint the accent, `tabBarLabelStyle: { fontSize: 11 }`. The
focused icon sits in a `h-8 w-14 items-center justify-center rounded-full bg-tint` pill.

## 7. Motion

Calm and exact. Nothing bounces. Nothing loops on a data screen.

- Entry: `FadeInDown.duration(360)` on the hero, `FadeIn.duration(280).delay(index * 50)` on the
  next 3 blocks only. Press: `AppPressable` `animation={{ scale: { value: 0.98 } }}`.
- Pulse draw (welcome and booking success only): `strokeDasharray={140}`, `strokeDashoffset` 140
  to 0, `withTiming` 900 ms, `Easing.inOut(Easing.cubic)`, started in `onLayout`, not in an
  effect. Reduced motion: the offset starts at 0.
- Booking: `LinearTransition.duration(200)` on the grid, `tapFeedback()` on a day or a time,
  `successFeedback()` after the save.

## 8. Imagery

Most Pouls apps need no photo. For W3 or a detail band, use `generate_image`, `aspect` `4:5` or
`3:2`, path `src/assets/<name>.png`, then `require()` the returned path (a fixed string) into a
React Native `Image` with `resizeMode="cover"`.

Prompt model: "Soft natural-light photograph of [subject of the app: a bright dental room / a
pharmacist's hands on a white shelf / a calm consultation room with a plant], white and pale
teal tones, shallow depth of field, no faces, no text, no logos, no watermark."

- At most 2 images in the first build.
- Never: smiling stock doctors, needles, blood, X-rays, body parts, or a red cross symbol.

## 9. Bans

- No second accent color. No red outside alerts.
- No gradient on a button. No heavy drop shadows. No capitals in labels.
- No stethoscope, pill, cross, or heart clip-art. No emoji.
- No invented doctors, ratings, reviews, prices, or free slots.

## 10. Self-check

1. Light and dark both work; dark is teal-black, not grey.
2. Every time, count, and lab value uses the `clock` role in Figtree Light, except the time chips.
3. Each record of a list is a chart card, and its bar color matches a status word.
4. Coral appears only on alerts and destructive actions.
5. The welcome uses W1, W2, or W3; the home uses H1 or H2, with real zeros and "Get started".
6. Booking has the day strip, the 3-column time grid, and a pinned confirm bar.
7. Reduced motion removes the pulse draw.
