# Aurore — northern lights over a quiet terminal

`aurore` · medium-loud · dark only · best for: AI assistant, chatbot, SaaS companion,
analytics, crypto, dev tools · avoid for: restaurant, kids, beauty, wellness, heritage

## 1. Feel

Night over a quiet terminal: deep indigo, almost black. Three soft lights drift behind
glass: teal, violet, green. Panels float on them with a thin light edge.
The big line is Sora Light, large and airy. Small facts are JetBrains Mono in
lowercase: times, counts, ids, states. A teal caret blinks where the app waits or writes.
It feels awake and exact, never like science fiction.

Voice: precise and calm. Facts with numbers: "3 sources", "synced 2 min ago". No
exclamation marks, no emoji, no "magic".

## 2. World law and client choices

World law:

- Dark only. Deep indigo, never pure black. One accent, teal: the primary action, the
  caret, the active tab, focus. Violet and green live only in the glows and the spectrum
  line, never on text, buttons, or icons.
- Sora for text, JetBrains Mono (the `label` role) for labels, small numbers, and code.
- `--radius: 0.5rem`: HeroUI cards and buttons get 24 px, fields 14 px. Own panels:
  `rounded-[24px]`.
- At most 3 glows per screen, only in hero areas (welcome, top of home, sign-in, empty
  states). Never behind a list.

Client choices: the welcome (W1, W2, W3), the home (H1 or H2), the glow layout (`top` or
`horizon`), the H2 lead metric, the H1 starter prompts. Two Aurore apps never share both.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.5rem;
}

@theme static {
	--font-normal: "Sora_400Regular";
	--font-medium: "Sora_500Medium";
	--font-semibold: "Sora_600SemiBold";
	--font-bold: "Sora_700Bold";
	--font-display: "Sora_300Light";
	--font-mono: "JetBrainsMono_500Medium";
}

@theme static {
	--color-aurora-teal: var(--aurora-teal);
	--color-aurora-violet: var(--aurora-violet);
	--color-aurora-green: var(--aurora-green);
	--color-glass: var(--glass);
	--color-glass-edge: var(--glass-edge);
}

@layer theme {
	:root {
		@variant light {
			--background: #07071a;
			--foreground: #eef0ff;
			--surface: #0f1029;
			--surface-foreground: #eef0ff;
			--surface-secondary: #171936;
			--surface-tertiary: #20234a;
			--overlay: #131533;
			--muted: #9a9fc8;
			--accent: #5eead4;
			--accent-foreground: #05131a;
			--default: #1c1e3e;
			--default-foreground: #eef0ff;
			--border: #ffffff1a;
			--separator: #ffffff12;
			--field-background: #0f1029;
			--field-border: #ffffff26;
			--field-placeholder: #7a80ae;
			--color-default-hover: #252849;
			--success: #3ee08f;
			--success-foreground: #07071a;
			--warning: #ffc861;
			--warning-foreground: #07071a;
			--danger: #ff7a93;
			--danger-foreground: #07071a;
			--segment: #262a4e;
			--segment-foreground: #eef0ff;
			--focus: #5eead4;
			--hero-start: #211a5c;
			--hero-end: #07071a;
			--hero-foreground: #eef0ff;
			--surface-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.07) inset;
			--overlay-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.7);
			--field-shadow: 0 0 0 0 transparent inset;
			--aurora-teal: #2dd4bf;
			--aurora-violet: #7c5cff;
			--aurora-green: #41e2a0;
			--glass: #16183db8;
			--glass-edge: #ffffff24;
		}

		@variant dark {
			--background: #07071a;
			--foreground: #eef0ff;
			--surface: #0f1029;
			--surface-foreground: #eef0ff;
			--surface-secondary: #171936;
			--surface-tertiary: #20234a;
			--overlay: #131533;
			--muted: #9a9fc8;
			--accent: #5eead4;
			--accent-foreground: #05131a;
			--default: #1c1e3e;
			--default-foreground: #eef0ff;
			--border: #ffffff1a;
			--separator: #ffffff12;
			--field-background: #0f1029;
			--field-border: #ffffff26;
			--field-placeholder: #7a80ae;
			--color-default-hover: #252849;
			--success: #3ee08f;
			--success-foreground: #07071a;
			--warning: #ffc861;
			--warning-foreground: #07071a;
			--danger: #ff7a93;
			--danger-foreground: #07071a;
			--segment: #262a4e;
			--segment-foreground: #eef0ff;
			--focus: #5eead4;
			--hero-start: #211a5c;
			--hero-end: #07071a;
			--hero-foreground: #eef0ff;
			--surface-shadow: 0 1px 0 0 rgba(255, 255, 255, 0.07) inset;
			--overlay-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.7);
			--field-shadow: 0 0 0 0 transparent inset;
			--aurora-teal: #2dd4bf;
			--aurora-violet: #7c5cff;
			--aurora-green: #41e2a0;
			--glass: #16183db8;
			--glass-edge: #ffffff24;
		}
	}
}
```

`app.json`: splash and `android.adaptiveIcon` `backgroundColor` `#07071A`,
`"userInterfaceStyle": "dark"`. `<StatusBar style="light" />`.

## 4. Type

`npx expo install @expo-google-fonts/sora @expo-google-fonts/jetbrains-mono`

```ts
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { Sora_300Light } from "@expo-google-fonts/sora/300Light";
import { Sora_400Regular } from "@expo-google-fonts/sora/400Regular";
import { Sora_500Medium } from "@expo-google-fonts/sora/500Medium";
import { Sora_600SemiBold } from "@expo-google-fonts/sora/600SemiBold";
import { Sora_700Bold } from "@expo-google-fonts/sora/700Bold";

export const appFonts = {
	JetBrainsMono_500Medium,
	Sora_300Light,
	Sora_400Regular,
	Sora_500Medium,
	Sora_600SemiBold,
	Sora_700Bold,
};
```

`appFonts` holds these six keys. Roles in `app-text.tsx` (full strings):

- `display`: `font-display text-[44px] leading-[50px] tracking-[-1.5px] text-foreground` (Sora
  Light). The lead number adds `text-[64px] leading-[68px] tracking-[-2px] tabular-nums`.
- `title`: `font-semibold text-[26px] leading-8 tracking-[-0.5px] text-foreground`.
- Add `label`: `font-mono text-xs leading-4 lowercase text-muted`. Mono text always uses this
  role, never `font-mono` on another role. Tile numbers: `label` plus `text-2xl leading-8
  text-foreground`. A still caret (`h-3 w-0.5 rounded-full bg-accent`) opens each section
  label, in a `flex-row items-center gap-2` row.
- Arabic twin: `npx expo install @expo-google-fonts/vazirmatn`. `--font-display` is
  `Vazirmatn_300Light`, the four weights are the same Vazirmatn weights, and `--font-mono` is
  `Vazirmatn_500Medium` (JetBrains Mono has no Arabic). Drop `tracking-*` and `lowercase`.

```ts
import { Vazirmatn_300Light } from "@expo-google-fonts/vazirmatn/300Light";
import { Vazirmatn_400Regular } from "@expo-google-fonts/vazirmatn/400Regular";
import { Vazirmatn_500Medium } from "@expo-google-fonts/vazirmatn/500Medium";
import { Vazirmatn_600SemiBold } from "@expo-google-fonts/vazirmatn/600SemiBold";
import { Vazirmatn_700Bold } from "@expo-google-fonts/vazirmatn/700Bold";
```

## 5. Signatures

1. **The aurora field.** `src/shared/ui/aurora-field.tsx` (`AuroraField`, `layout`): a
   `pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden` layer, first child
   of the screen. Three glows, each an `Animated.View` (position and size classes) with an
   `Svg` (`width="100%" height="100%" viewBox="0 0 100 100"`) that fills a `Circle r=50` with
   a `RadialGradient` (stop opacity 0.55, 0.18, 0). Its id is `useId()` without the colons:
   ids are global on the web. Colors: `useCSSVariable(["--color-aurora-teal",
   "--color-aurora-violet", "--color-aurora-green"])`, used only when a string. `top`: teal
   `-start-[140px] -top-[120px] size-[440px]`, violet `-end-[160px] top-10 size-[420px]`, green
   `start-[25%] top-[260px] size-[300px]` at 0.35. `horizon`: three `Ellipse` glows (`ry=24`)
   in a row at `top-[28%]`. It ends in `absolute inset-x-0 bottom-0 h-48 bg-linear-to-b
   from-background/0 to-background`.
2. **The glass panel and its lit edge.** `npx expo install expo-blur`, then
   `src/shared/ui/glass-panel.tsx` (`GlassPanel`, props `lit` and `className`, merged
   with `cn` from `heroui-native`):

```tsx
<View className={cn("overflow-hidden rounded-[24px] border border-glass-edge p-5", Platform.OS === "ios" ? "bg-glass/50" : "bg-glass", className)}>
	{Platform.OS === "ios" ? <BlurView intensity={36} style={StyleSheet.absoluteFill} tint="dark" /> : null}
	{children}
	{lit ? <View className="absolute inset-x-8 top-0 h-px bg-linear-to-r from-aurora-teal/0 via-aurora-teal to-aurora-violet/0" /> : null}
</View>
```

   Android and the web show the 72 % `bg-glass` fill. One `lit` panel per screen. Use glass
   only over a glow or scrolling content.
3. **The live caret.** `src/shared/ui/caret.tsx`: an `Animated.View` `rounded-full bg-accent`,
   display size `mb-2 h-[38px] w-[3px]`, body size `mb-1 h-[18px] w-0.5`. It blinks 530 ms on,
   530 ms off with a CSS loop in `style`: `animationName: { "0%": { opacity: 1 }, "50%": {
   opacity: 1 }, "51%": { opacity: 0 }, "100%": { opacity: 0 } }`, `animationDuration:
   "1060ms"`, `animationIterationCount: "infinite"`. To set it after the last word, render one
   `AppText` per word (same role) in `flex-row flex-wrap items-end gap-x-[10px]`, the caret
   last. One live caret per screen. Word reveal (welcome line, home question): each word sits
   in an `Animated.View` with `FadeIn.duration(160).delay(i * 70)`; the row is `accessible`
   with the full text as `accessibilityLabel`.

## 6. Screens

**Welcome**. Pick one. Each is a `flex-1 bg-background` View: the field first, then
`AppSafeAreaView` (`flex-1`) with the text and the buttons.

- W1 Prompt: `AuroraField layout="top"`. Bottom block `flex-1 justify-end gap-6 px-6 pb-10`:
  the `label` row (still caret, app name), the promise in `display` with the word reveal and
  the live caret, a lit `GlassPanel` with one `body` line, then the two buttons.
- W2 Orbit: `layout="horizon"`. Centered, a `size-[264px] items-center justify-center` View
  holds 3 `absolute inset-0` layers. First, an `Svg` (`width={264} height={264}`) with the
  inner ring (`r` 56). Then an `Animated.View` with the middle ring (`r` 92) and a violet dot.
  Last, one with the outer ring (`r` 128) and a teal dot. Rings: `--color-foreground`,
  `strokeOpacity={0.12}`. In the center, `GlassPanel className="size-[72px] items-center
  justify-center p-0"` holds the live caret. Then the app name (`display`), a `caption`, and
  the buttons.
- W3 Depth stack: `layout="top"`. At `mt-[22%]`, three panels: back `mx-14 h-20 rounded-[24px]
  border border-glass-edge bg-surface-secondary/50`, middle `mx-9 -mt-12` at `/70`, front a
  lit `GlassPanel className="mx-5 -mt-12"` with the promise (word reveal). Buttons last.

**Sign-in and sign-up**: `headerShown: false`, `ModalCloseButton` at the top start,
`layout="top"`, then `gap-6 px-5 pt-24`: the `label` row, the `title` with a body-size live
caret, a lit `GlassPanel` with the fields and the error line, the primary button, the ghost
switch. Email and password only.

**Onboarding** (setup facts only: workspace name, goal, data source): at most 3 screens. A
`h-0.5 bg-surface-tertiary` track with a `h-0.5 bg-linear-to-r from-aurora-teal
to-aurora-violet` fill (width from an object: `w-1/3`, `w-2/3`, `w-full`), `01 / 03` in
`label`. Options: `rounded-[20px] border border-border bg-surface p-4`, chosen `border-accent`.

**Home, first run**:

- H1 Assistant: `layout="top"`. The date `label`, the question in `display` with the live
  caret. The composer: a lit `GlassPanel` with a multiline `AppTextField` and a send button.
  Send is an `AppPressable` `size-11 items-center justify-center rounded-full bg-accent` with
  `arrow-up` (`colorClassName="accent-accent-foreground"`); it is `isDisabled` with no text. Then
  "recent" with the real count ("0 threads", a `{count}` message). With none: 3 starter
  prompts in `rounded-[20px] bg-surface p-4` rows (`01` in `label text-accent`, the prompt); a
  press fills the composer.
- H2 Signal board: `layout="horizon"`. A lit `GlassPanel`: the metric `label`, the lead number
  (a real 0 on first run), a `label` delta only with a previous value, and an `h-24` area line
  (`Path`, teal-to-violet `LinearGradient` stroke, teal fill from 25 % to 0, ids from
  `useId()`; under 2 points, a dashed baseline). Then 2-column tiles (Views `rounded-[24px]
  border border-border bg-surface p-4`) and a "Get started" panel: 3 steps, `01` in accent,
  a real state word (`todo`, `done`).

**Lists**: a `FlatList`, no glow. Row: `AppPressable flex-row items-center gap-3 px-4 py-3.5`:
a `size-2 rounded-full` status dot (an object maps each state to `bg-accent`, `bg-success`, or
`bg-danger`) with its word, the title (`body font-medium`) over a `caption`, the time in
`label` at the end.

**Detail** (a thread): user turns `self-end max-w-[85%] rounded-[22px] bg-surface-secondary
px-4 py-3`; assistant turns full width, no bubble, new words `FadeIn.duration(160)`, the live
caret at the end. The composer is pinned.

**Empty state art**: a `size-[120px] items-center justify-center` View. Behind, an absolute
`Svg` (`width={120} height={120}`) with a teal radial glow. In front, `GlassPanel lit
className="size-[88px] items-center justify-center rounded-[28px] p-0"` with the outline icon
(40, `colorClassName="accent-foreground"`).

**Tab bar**: `borderTopWidth: 0`; `tabBarBackground` is a `flex-1 bg-background` View topped
by an `h-px bg-linear-to-r from-aurora-teal/0 via-aurora-violet to-aurora-green/0` line.
Icons: the filled name when active, `<name>-outline` when not. Labels: `fontSize: 11`,
`textTransform: "lowercase"` (not in Arabic), `fontFamily` from `--font-mono` without its
quotes.

## 7. Motion

Slow light, exact text, no spring on content. Each loop is a Reanimated CSS animation in
`style` with `animationIterationCount: "infinite"`, and no effect.

- Drift: `animationName: { from: { transform: [{ translateX: -28 }, { translateY: -18 }] },
  to: { transform: [{ translateX: 28 }, { translateY: 18 }] } }`, `animationDirection:
  "alternate"`, `animationTimingFunction: "ease-in-out"`, `animationDuration`: teal `"14s"`,
  violet `"18s"`, green `"22s"`.
- Orbit: `rotate` from `"0deg"` to `"360deg"`, `animationTimingFunction: "linear"`, middle
  ring `"16s"`, outer ring `"24s"`.
- Entry: glass `FadeIn.duration(600)`, text `FadeInUp.duration(500).delay(i * 80)`, first 4.
- Press: `animation={{ scale: { value: 0.97 } }}` on panels, `0.9` on send with
  `tapFeedback()`. `successFeedback()` when a run or a save ends.
- `useReducedMotion()` true: no loop (still glows and orbit, solid caret), all words at once.

## 8. Imagery

Aurore draws in SVG; it does not photograph. The first build has no image. At most 1
optional texture under the W1 field: `generate_image`, `aspect` `2:3`, path
`src/assets/aurora.png`, `absolute inset-0 size-full opacity-60`.

Prompt model: "Abstract ribbons of soft light in teal, violet, and green on deep indigo-black,
mood of [the app subject]. Smooth, out of focus, fine grain. No stars, no landscape, no
objects, no people, no text, no logos."

Never: robots, brains, circuit boards, holograms, faces, code screenshots, "AI".

## 9. Bans

- No light mode, no pure black, no violet or green on text, buttons, or icons.
- No purple-to-pink gradient on a button or a word. Buttons are flat teal.
- No robot, brain, or magic-wand icon. `sparkles-outline` at most once, on the assistant.
- No neon glow on text, no glitch, no scan lines, no capital labels, no glass on glass.

## 10. Self-check

1. Dark on a phone in light mode and on the web. Display is Sora Light; labels are mono.
2. One `AuroraField` per hero area, at most 3 glows, none behind a list.
3. Glass blurs on iOS, uses `bg-glass` elsewhere, keeps its 1 px edge; one lit panel.
4. Every number is real; a first-run home shows zeros and the steps or starter prompts.
5. Loops are CSS animations. Reduced motion stops the drift, the orbit, the blink, the reveal.
