# Mosaïque — four index cards on a pinboard

`mosaique` · medium · light + dark · best for: to-do, tasks, notes, team tools, planners,
projects, study planner, checklists · avoid for: gym, clinic, nightlife, restaurant, luxury, kids

## 1. Feel

A studio pinboard on Monday morning: off-white paper, a black fine-liner, four colored index
cards pinned in a neat grid. The app sorts a busy life into tiles, one job and one color per
tile. Geist for words, Geist Mono for small capital tags. The reward is the check: a box that
snaps shut, a title that crosses out, a count that drops by one.

Voice: calm and exact. Numbers first ("3 due today"), a verb on each button ("Add task").
No exclamation marks, no emoji, no hype words.

## 2. World law and client choices

World law, the same in every Mosaïque app:

- Paper ground, white cards, black ink. The accent is the ink (black in light, paper in dark)
  on the primary button, the active tab, the checked box, and the focus ring.
- Color lives only in the four tiles and their marks (a card band, a tag square): lilac, mint,
  butter, peach. One tile color has one meaning in the whole app. Text on a tile is always
  `text-tile-ink`.
- Geist for all text: big counts in the `display` role (SemiBold, negative tracking). Geist
  Mono in the `label` role for labels, dates, and tag counts, in capitals.
- `--radius: 0.5625rem`: cards and big tiles 27 px (`rounded-3xl`), small tiles and rows 18 px
  (`rounded-2xl`), fields 16 px, the checkbox 9 px (`rounded-lg`).
- Three signatures: the bento board, the mono tag, the snap check (section 5).
- Dark mode is graphite; the tiles stay pastel, a little deeper, like paper on a dark board.

Client choices, fresh for each app: the welcome (W1, W2, W3) and the home (H1 or H2), never
both as in another Mosaïque app; the meaning of each tile color (for example lilac Today, mint
Done, butter Doing, peach Late); the lead count (tasks due today, open projects).

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.5625rem;
}

@theme static {
	--font-normal: "Geist_400Regular";
	--font-medium: "Geist_500Medium";
	--font-semibold: "Geist_600SemiBold";
	--font-bold: "Geist_700Bold";
	--font-display: "Geist_600SemiBold";
	--font-mono: "GeistMono_500Medium";
}

@theme static {
	--color-tile-lilac: var(--tile-lilac);
	--color-tile-mint: var(--tile-mint);
	--color-tile-butter: var(--tile-butter);
	--color-tile-peach: var(--tile-peach);
	--color-tile-ink: var(--tile-ink);
}

@layer theme {
	:root {
		@variant light {
			--background: #f5f4f0;
			--foreground: #141416;
			--surface: #ffffff;
			--surface-foreground: #141416;
			--surface-secondary: #edece7;
			--surface-tertiary: #e3e2dc;
			--overlay: #ffffff;
			--muted: #63625d;
			--accent: #141416;
			--accent-foreground: #f5f4f0;
			--default: #e9e8e2;
			--default-foreground: #141416;
			--border: #1414161a;
			--separator: #14141612;
			--field-background: #ffffff;
			--field-border: #14141629;
			--field-placeholder: #8d8c86;
			--color-default-hover: #deddd6;
			--success: #1d7a45;
			--success-foreground: #ffffff;
			--warning: #e5a00d;
			--warning-foreground: #141416;
			--danger: #c4321c;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #141416;
			--focus: #141416;
			--hero-start: #26262b;
			--hero-end: #141416;
			--hero-foreground: #f5f4f0;
			--surface-shadow: 0 1px 2px 0 rgba(20, 20, 22, 0.06);
			--overlay-shadow: 0 12px 32px -8px rgba(20, 20, 22, 0.18);
			--field-shadow: 0 0 0 0 transparent inset;
			--tile-lilac: #dcd3f8;
			--tile-mint: #cbebd7;
			--tile-butter: #f7e7a1;
			--tile-peach: #f8d3c1;
			--tile-ink: #141416;
		}

		@variant dark {
			--background: #161618;
			--foreground: #f2f1ec;
			--surface: #1f1f22;
			--surface-foreground: #f2f1ec;
			--surface-secondary: #27272b;
			--surface-tertiary: #313136;
			--overlay: #232326;
			--muted: #a3a29b;
			--accent: #f2f1ec;
			--accent-foreground: #161618;
			--default: #2b2b2f;
			--default-foreground: #f2f1ec;
			--border: #ffffff14;
			--separator: #ffffff0f;
			--field-background: #1f1f22;
			--field-border: #ffffff26;
			--field-placeholder: #7d7c77;
			--color-default-hover: #36363b;
			--success: #4fc488;
			--success-foreground: #161618;
			--warning: #f0b43c;
			--warning-foreground: #161618;
			--danger: #ff6a55;
			--danger-foreground: #161618;
			--segment: #3a3a40;
			--segment-foreground: #f2f1ec;
			--focus: #f2f1ec;
			--hero-start: #2e2e34;
			--hero-end: #1f1f22;
			--hero-foreground: #f2f1ec;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--tile-lilac: #c3b6f2;
			--tile-mint: #a8dbbe;
			--tile-butter: #ebd57a;
			--tile-peach: #eeb59d;
			--tile-ink: #141416;
		}
	}
}
```

Tile ink is 9.9:1 or more on each tile, `/70` 4.9:1 or more. `app.json`: splash
`backgroundColor` `#F5F4F0` (light) and `#161618` (dark), adaptive icon `#F5F4F0`,
`"userInterfaceStyle": "automatic"`.

## 4. Type

`npx expo install @expo-google-fonts/geist @expo-google-fonts/geist-mono`

```ts
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";

export const appFonts = { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, GeistMono_500Medium };
```

- Roles in `app-text.tsx`: set `display` to `font-display text-5xl leading-none tracking-tighter
  text-foreground` (sentence case). Add a `label` role: `font-mono text-[11px] leading-4 uppercase
  tracking-[1.2px] text-muted`.
- A big count is `<AppText variant="display">` with `tabular-nums` and a size: `text-6xl` lead,
  `text-4xl` others. A tag count is `label`. Never add `font-display` or `font-mono` to another
  role.
- Arabic twin: `npx expo install @expo-google-fonts/ibm-plex-sans-arabic @expo-google-fonts/alexandria`.
  The four weights: IBM Plex Sans Arabic 400 to 700. `--font-display`:
  `Alexandria_600SemiBold`. `--font-mono`: `IBMPlexSansArabic_500Medium` (Geist Mono has no
  Arabic). Remove `uppercase` and every `tracking-*` from the roles.

```ts
import { Alexandria_600SemiBold } from "@expo-google-fonts/alexandria/600SemiBold";
import { IBMPlexSansArabic_400Regular } from "@expo-google-fonts/ibm-plex-sans-arabic/400Regular";
import { IBMPlexSansArabic_500Medium } from "@expo-google-fonts/ibm-plex-sans-arabic/500Medium";
import { IBMPlexSansArabic_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold";
import { IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic/700Bold";
```

## 5. Signatures

1. **The bento board.** The Lists tab opens with it. A `flex-row gap-3` row: the lead tile
   (`h-48 flex-[1.4]`) and a `flex-1 gap-3` column of two `flex-1` tiles. Under it, one wide
   `h-24` tile. Each tile is an `AppPressable`, `rounded-3xl p-4 justify-between`, one tile
   color: a `label` in `text-tile-ink/70` with an `AppIcon` (18, `colorClassName="accent-tile-ink"`)
   at the end, then the real count (`display`, `text-tile-ink`). A tile opens its filtered list.
   One literal map in `lib/` gives each meaning its full class (`{ today: "bg-tile-lilac" }`);
   never build `` `bg-tile-${color}` ``.
2. **The mono tag.** A section header is `flex-row justify-between`: `TODAY · 03` at the start,
   `THU 04 OCT` at the end (`Intl.DateTimeFormat`, then `toLocaleUpperCase`). Counts below 10
   get two digits. Chip: `rounded-lg border border-border px-2 py-0.5` and a `size-2` tile square.
3. **The snap check.** A `size-6 rounded-lg border-2` box (open `border-foreground/40`, done
   `border-accent bg-accent`) in `AppPressable animation={false} accessibilityRole="checkbox"
   accessibilityState={{ checked: done }} hitSlop={10}`, `accessibilityLabel` the task title.
   Inside, a 14 px `Svg` (`viewBox="0 0 24 24"`) with an animated `Path`
   (`d="M5 12.5l4.5 4.5L19 7.5"`, `strokeWidth={3.5}`, `strokeDasharray={20}`, stroke
   `useThemeColor("accent-foreground")`). `useAnimatedProps` gives `strokeDashoffset:
   withTiming(done ? 0 : 20, { duration: 220 })`; an inline `withTiming` skips the mount. The
   press pops the box: `withSequence(withTiming(0.8, { duration: 80 }), withSpring(1, {
   damping: 9 }))`. The title gets `line-through text-muted`. An optimistic update flips `done`
   at once; a failed write flips it back and shows the error line.

The tile mark (the app mark): a 2 x 2 grid of the tile colors, `size-5 rounded-md`, `gap-1`.

## 6. Screens

**Welcome** (signed-out start): a `View` with `flex-1 bg-background`, and `AppSafeAreaView`
inside it for the text and the buttons. Not `Screen`. Pick one:

- W1 Falling cards: the four tiles (`w-[64%] h-28 rounded-3xl p-4`, a `label` and a real
  section name) land as a loose stack in the top 55 %: `rotate-[-6deg]`, `rotate-[4deg]`,
  `rotate-[-2deg]`, `rotate-[7deg]`, `ms-[8%]` to `ms-[30%]`, `-mt-10`. Below (`px-6 pb-10
  gap-4`): the app name in `display`, one muted line, "Get started", a ghost "I have an account".
- W2 Self-checking list: three `display` lines in `text-4xl` ("Write it down." "Sort it."
  "Let it go."), each after a `size-8` box. The filled layer of each box (`bg-accent` and an
  `AppIcon` `checkmark`, `accent-accent-foreground`) enters with `ZoomIn.springify().damping(12)`
  at `.delay(500)`, `800`, `1100`. The tile mark and the real date tag sit in the top row.
- W3 Ink cover: the top 58 % is `bg-linear-to-b from-hero-start to-hero-end rounded-b-[36px]
  px-6 pt-16`: the app name (`display`, `text-6xl text-hero-foreground`) over four
  `h-2 flex-1 rounded-full` tile color bars. Paper below: one line and the buttons.

**Sign-in and sign-up**: full screen, `headerShown: false`, a close button in the top row for
the modal case, the tile mark and the app name as a `label`. Then a `title`, the fields in one
`bg-surface rounded-3xl p-4 gap-4` card, the primary button, a ghost switch link.

**Onboarding** (setup facts only, at most 3 screens): one question per screen. Progress: 3
`h-1.5 flex-1 rounded-full` bars (done: lilac, mint, butter; others `bg-surface-tertiary`).
Options: `rounded-2xl border-2 border-transparent bg-surface p-4` rows, selected
`border-accent`. "Next" pinned.

**Home, first run** (no rows yet):

- H1 Focus stack: the date tag and an `AppAvatar` (sm) in the top row, a `title` greeting.
  Then a white index card (`overflow-hidden rounded-3xl bg-surface`): a `h-2` band in its list's
  tile color, then `p-5 gap-3` with the `label` "NEXT", the next task (`heading`), its due tag,
  its snap check. Below it, one card edge per further task today, at most 2 (`h-3
  rounded-b-2xl border border-t-0 border-border bg-surface`, `mx-4`, `mx-8`). Then "TODAY · 00"
  and today's rows.
  First run: the card is "Get started" (`START · 0/3`: create a list, add a task, plan today),
  each step an open snap check that real data checks.
- H2 Today ledger: an ink card (`bg-linear-to-br from-hero-start to-hero-end rounded-3xl p-5`):
  a date tag in `text-hero-foreground/70`, the lead count (`display`, `text-7xl
  text-hero-foreground`, `00` at first), one `h-1.5 flex-1 rounded-full` segment per task today,
  at most 12 (done `bg-tile-mint`, open `bg-hero-foreground/20`); past 12, one bar filled to the
  done share. Then a row of `w-36 h-28 rounded-3xl` list tiles, "TODAY · 00", and the H1 "Get
  started" card.

**Lists**: the bento board, then rows in one `bg-surface rounded-3xl px-4` card (`h-px
bg-separator` between them). Row: `flex-row items-start gap-3 py-3.5`, the snap check, the
title (`font-medium`), mono tags. Sections OVERDUE, TODAY, LATER, then a closed DONE. Notes:
two columns of `bg-surface rounded-3xl p-4` cards. `AppListGroup` only for settings.

**Detail**: a tag row, a `size-8` snap check beside the `title`, a spec sheet (`label` at the
start, value at the end: STATUS, DUE, LIST), the body, one primary button.

**Empty state art** (`art` of `EmptyState`): three `w-24 h-28 rounded-2xl` tiles (lilac, mint,
butter), `rotate-[-8deg]`, `rotate-[5deg]`, and none, `-ms-6` apart; the front one holds an
open snap check.

**Tab bar**: background `useThemeColor("background")`, a hairline top border, accent active
tint. Mono labels: read `useCSSVariable("--font-mono")`, strip its quotes as
`navigation-theme.ts` does, then `tabBarLabelStyle: { fontFamily, fontSize: 11 }`. Add
`textTransform: "uppercase"` and `letterSpacing: 1` only when `useT().dir` is `"ltr"`: Arabic
gets no capitals and no tracking.

## 7. Motion

Crisp and tactile: short distances, small springs, nothing floats.

- Entry: `FadeInDown.duration(260)` per block, `.delay(index * 50)` for the first 5 blocks.
- W1: `SlideInUp.springify().damping(16).delay(index * 90)` on an outer `Animated.View`, the
  rotation class on the inner tile.
- Counts: key by value, enter with `FadeInDown.duration(180)`. Rows:
  `LinearTransition.duration(220)`.
- Press: `AppPressable animation={{ scale: { value: 0.97 } }}` on tiles and cards.
  `successFeedback()` when the last task of the day is done.
- `useReducedMotion()` true: no pop. Reanimated skips the entering animations, so W1 and W2
  show the end state.
- Never: a loop, confetti, rotation in motion, a bounce larger than the pop.

## 8. Imagery

All art is Views and react-native-svg; a first build needs 0 images. For a cover the brief
asks for: `generate_image` (`aspect` `3:2`, path `src/assets/<name>.png`), then `require()` the
returned path with a fixed string. Prompt model: "Flat front photograph of [subject of the app:
index cards pinned on a pale board], soft daylight, pastel lilac, mint, and butter paper on
off-white, no text, no logos, no hands, no screens." At most 1 image. Never 3D mascots or stock
office photos.

## 9. Bans

- No gradient except the ink hero. No second accent. No colored button.
- No tile color on text, headers, or icons outside a tile. No capitals in Geist sans.
- No icon in a grey circle. No emoji. No checkbox without the snap.

## 10. Self-check

1. Light mode is paper and ink; dark mode is graphite with the same pastel tiles.
2. Only tiles and their marks carry color; tile text is `text-tile-ink`; one literal map gives tile
   classes.
3. Every section has a mono tag; every count is real and padded to two digits.
4. Welcome W1, W2, or W3; home H1 or H2 with zeros and "Get started"; Lists open on the bento board.
5. Every checkbox is the snap check, with its checked state, an optimistic update, and a rollback.
6. Big counts use `display`, tags use `label`; no text has two `font-*` classes.
7. Tiles scale on press; reduced motion leaves no pop and no fall; Arabic tab labels have no
   capitals.
