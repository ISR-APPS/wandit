# Solde — the last line of a clean ledger

`solde` · quiet · light + dark · best for: finance, budget, wallet, expenses, invoices, shop cash
book, accounting, savings · avoid for: gym, nightlife, kids, food, wellness

## 1. Feel

A ledger on clean paper, a navy pen, and one green line that says the account is fine. Amounts
are typed in mono, like a bank statement, each figure under the one above. The only colored
object is the card: deep navy, engraved with fine lines like a banknote. Nothing blinks.
Trust comes from order.

Voice: plain and exact. The sum and the date first ("Spent today", "Due 14 Oct"). No
exclamation marks, no emoji, no jokes about money.

## 2. World law and client choices

World law, the same in every Solde app:

- Paper ground, navy ink, one mint accent. Mint means "money in" and "go": the primary action,
  the active tab, incoming amounts, focus, the card lines, and step and promise markers (index
  numbers, checkmarks, the W1 promise line, the add line). Red marks only an overdue or a
  failed state, always with a word.
- Manrope for words, IBM Plex Mono (the `figure` role) for every amount and date label.
- `--radius: 0.75rem`: buttons are pills (36 px), fields 21 px. A block is a `View` with
  `rounded-2xl bg-surface` (24 px), not `AppCard`: on the web, HeroUI keeps its card at 36 px.
  The engraved card is `rounded-xl` (18 px).
- Money is an integer in minor units plus the ISO currency code of the row. Every amount goes
  through `splitMoney` (section 5). Never a float in data, never a guessed currency.
- Three signatures: the split figure, the engraved card, the day ledger.

Client choices: the welcome (W1, W2, W3), the home (H1, H2), the lead figure (the balance, the
cash in the till today, or the total due), and the card label (an account or shop name from the
data). Two Solde apps never share the same welcome and home composition.

## 3. Tokens

```css
@theme {
	--field-border-width: 1px;
	--radius: 0.75rem;
}

@theme static {
	--font-normal: "Manrope_400Regular";
	--font-medium: "Manrope_500Medium";
	--font-semibold: "Manrope_600SemiBold";
	--font-bold: "Manrope_700Bold";
	--font-display: "Manrope_800ExtraBold";
	--font-numeric: "IBMPlexMono_500Medium";
}

@theme static {
	--color-hero-accent: var(--hero-accent);
}

@layer theme {
	:root {
		@variant light {
			--background: #f6f6f1;
			--foreground: #0d1a2f;
			--surface: #ffffff;
			--surface-foreground: #0d1a2f;
			--surface-secondary: #eeefe9;
			--surface-tertiary: #e3e5de;
			--overlay: #ffffff;
			--muted: #5a6475;
			--accent: #0b7a57;
			--accent-foreground: #ffffff;
			--default: #e9ebe5;
			--default-foreground: #0d1a2f;
			--border: #0d1a2f17;
			--separator: #0d1a2f12;
			--field-background: #ffffff;
			--field-border: #0d1a2f26;
			--field-placeholder: #7a8291;
			--color-default-hover: #e0e3dc;
			--success: #0b7a57;
			--success-foreground: #ffffff;
			--warning: #e8a93a;
			--warning-foreground: #1f1400;
			--danger: #c2362b;
			--danger-foreground: #ffffff;
			--segment: #ffffff;
			--segment-foreground: #0d1a2f;
			--focus: #0b7a57;
			--hero-start: #142a57;
			--hero-end: #0a1430;
			--hero-foreground: #f3f5ee;
			--surface-shadow: 0 1px 2px 0 rgba(13, 26, 47, 0.06);
			--overlay-shadow: 0 12px 32px 0 rgba(13, 26, 47, 0.14);
			--field-shadow: 0 0 0 0 transparent inset;
			--hero-accent: #7cf0c4;
		}

		@variant dark {
			--background: #0a1222;
			--foreground: #eef1ea;
			--surface: #111b2e;
			--surface-foreground: #eef1ea;
			--surface-secondary: #17233a;
			--surface-tertiary: #1f2d47;
			--overlay: #142036;
			--muted: #94a0b4;
			--accent: #5fe0ae;
			--accent-foreground: #0a1222;
			--default: #1a263d;
			--default-foreground: #eef1ea;
			--border: #ffffff14;
			--separator: #ffffff0f;
			--field-background: #111b2e;
			--field-border: #ffffff26;
			--field-placeholder: #6f7b90;
			--color-default-hover: #22304a;
			--success: #5fe0ae;
			--success-foreground: #0a1222;
			--warning: #f2c14e;
			--warning-foreground: #1f1400;
			--danger: #ff6b5e;
			--danger-foreground: #1a0503;
			--segment: #2a3a57;
			--segment-foreground: #eef1ea;
			--focus: #5fe0ae;
			--hero-start: #1c3768;
			--hero-end: #0f1e3d;
			--hero-foreground: #f3f5ee;
			--surface-shadow: 0 0 0 0 transparent inset;
			--overlay-shadow: 0 0 1px 0 rgba(255, 255, 255, 0.16) inset;
			--field-shadow: 0 0 0 0 transparent inset;
			--hero-accent: #7cf0c4;
		}
	}
}
```

`--hero-accent`: the bright mint of lines and figures on the navy card. `app.json`: splash
`#F6F6F1`, dark splash `#0A1222`, adaptive icon `#0A1430`.

## 4. Type

`npx expo install @expo-google-fonts/manrope @expo-google-fonts/ibm-plex-mono`

```ts
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";

export const appFonts = {
	IBMPlexMono_500Medium,
	Manrope_400Regular,
	Manrope_500Medium,
	Manrope_600SemiBold,
	Manrope_700Bold,
	Manrope_800ExtraBold,
};
```

- Add a `figure` role to `AppText`: `font-numeric text-base text-foreground`. Every amount uses
  it. Never add `font-numeric` to another role: two faces conflict.
- The label style (dates, column heads): `figure` plus `text-[11px] uppercase tracking-[1.5px] text-muted`.
- Set `display` to `font-display text-5xl leading-[1.05] tracking-tighter text-foreground`, never
  larger. Keep `title`. Row titles: `body` plus `font-semibold`. Never a sentence in mono.
- Arabic twin: `npx expo install @expo-google-fonts/ibm-plex-sans-arabic`. The four weights take
  `IBMPlexSansArabic_400Regular`, `_500Medium`, `_600SemiBold`, `_700Bold`; `--font-display` takes
  `IBMPlexSansArabic_700Bold`. `--font-numeric` keeps Plex Mono, and `splitMoney` keeps Latin
  digits (`numberingSystem: "latn"`). Drop `uppercase` and the tracking.

```ts
import { IBMPlexSansArabic_400Regular } from "@expo-google-fonts/ibm-plex-sans-arabic/400Regular";
import { IBMPlexSansArabic_500Medium } from "@expo-google-fonts/ibm-plex-sans-arabic/500Medium";
import { IBMPlexSansArabic_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold";
import { IBMPlexSansArabic_700Bold } from "@expo-google-fonts/ibm-plex-sans-arabic/700Bold";
```

## 5. Signatures

1. **The split figure.** Every amount goes through this helper in `src/shared/lib/money.ts`,
   with `locale` from `useT()`:

```ts
/** Splits an amount in minor units into its big part and its small part (decimals, symbol). */
export function splitMoney(minor: number, currency: string, locale: string) {
	const format = new Intl.NumberFormat(locale, { style: "currency", currency, numberingSystem: "latn" });
	// Minor units per major unit: JPY has 0 decimals, DZD 2, KWD and TND 3.
	const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
	const parts = format.formatToParts(Math.abs(minor) / 10 ** digits);
	const decimalAt = parts.findIndex((part) => part.type === "decimal");
	const cut = decimalAt === -1 ? parts.length : decimalAt;
	const joinParts = (from: number, to?: number) =>
		parts.slice(from, to).map((part) => part.value).join("");
	return { whole: joinParts(0, cut), fraction: joinParts(cut) };
}
```

   Render `<AppText variant="figure" className="text-6xl tracking-tighter">{whole}<AppText variant="figure" className="text-2xl text-muted">{fraction}</AppText></AppText>`.
   A row uses `text-base` and `text-xs`. `fraction` is empty for a currency with 0 decimals.
   Write the sign yourself, as a nested `figure` before `whole`: `+` (money in, `text-success`)
   or `−` U+2212 (money out, `text-foreground`). Zero has no sign.
2. **The engraved card.** `aspect-[1.586] w-full justify-between overflow-hidden rounded-xl bg-linear-to-br from-hero-start to-hero-end p-5`.
   Behind the content, an `absolute inset-0` View holds `<Svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="none">`
   with 16 `Path` lines (`fill="none"`, `strokeWidth={0.6}`, `strokeOpacity={0.18}`). Build them
   once at module level: line `i` passes x = 0, 8, … 320 at `y = 40 + i * 8 + Math.sin(x / 40 + i * 0.4) * 14`.
   Stroke: `useCSSVariable("--color-hero-accent")` (pass it only when it is a string). On the
   card: the label (`text-hero-foreground/70`), the split figure (`text-hero-foreground`, decimals
   `text-hero-foreground/60`), and at most two pills (`h-10 rounded-full border border-hero-foreground/20 bg-hero-foreground/10 px-4`,
   text `text-hero-foreground`). One card per screen.
3. **The day ledger.** A `SectionList` by day, in `AppSafeAreaView`. Header `flex-row justify-between pt-6 pb-2`: the
   date (label style) and the signed day net (`figure text-sm text-muted`). Each day is one
   `rounded-2xl bg-surface` group; rows `flex-row items-center gap-3 px-4 py-3`, split by
   `h-px bg-separator ms-16`. Leading: a `size-10 rounded-xl bg-surface-secondary` square with
   the category icon. Trailing: the signed `figure`; a cash book adds the running balance under it.

## 6. Screens

**Welcome** (a `View className="flex-1 bg-background"`, not `Screen`; an `AppSafeAreaView`
inside it pads the text and the buttons). Pick one:

- W1 Card pair: in the top 55 %, a plain `bg-surface-tertiary` card at `rotate-[8deg]` behind
  the engraved card at `rotate-[-6deg]`, both `w-[78%]`, each inside an outer `Animated.View`
  for the turn (section 7). Below, `px-6 pb-10 gap-3`: a `display` of two short sentences, each
  from its own `t()` key, the second a nested `<AppText variant="display" className="text-accent">`
  (the promise line); a `caption`, the primary and the ghost button.
- W2 Navy fold: the top 58 % is an engraved `rounded-b-[40px] bg-linear-to-b from-hero-start to-hero-end`
  block under the status bar, the app name in `display text-hero-foreground` at its bottom start.
  Under it, in `AppSafeAreaView edges={["bottom"]}`: 3 promise rows (index "01" to "03" in
  `figure text-accent`, one body line). Buttons at the bottom.
- W3 Receipt: a `bg-surface` slip, `mx-8`, hangs from the top edge, with an SVG zigzag bottom
  edge (a `Polygon` of 14 teeth, 8 px deep, surface color). On it: the app name in `display
  text-4xl`, a dashed SVG rule, 3 promise lines with a `checkmark`
  (`colorClassName="accent-accent"`), today's date.

**Sign-in and sign-up**: `Screen` under the modal header of the template (`ModalCloseButton`).
An engraved strip (`h-32 rounded-xl`, the card without the ratio) with the app name in
`text-hero-foreground`, then a `title`, the fields, the full-width primary button, and the
switch link as a ghost button.

**Onboarding** (only for the currency, the opening balance, or the shop name): one question per
screen, at most 3, with 3 `h-0.5 flex-1 rounded-full` segments on top (done `bg-accent`). The
currency list shows the ISO code in `figure text-lg` and a `checkmark` on the chosen row.

**Home, first run**. The zeros are real zeros in the chosen currency.

- H1 Card first: the date and `AppAvatar` on top, the engraved card, then one `bg-surface
  rounded-2xl` row with IN and OUT for the month (`figure text-2xl`). Then "Start the book":
  3 numbered steps (`figure text-accent` index, body line, chevron flipped in RTL), each an
  `AppPressable` row.
- H2 Receipt over navy: an engraved `h-[300px] rounded-[32px]` hero block with a month pill
  (`h-8 rounded-full bg-hero-foreground/10 px-3`) and the split figure centered at `text-6xl`,
  all text `text-hero-foreground`. A receipt slip overlaps it (`-mt-10 mx-5 bg-surface px-5
  pt-5`, square top, no grab bar): IN and OUT, a dashed SVG rule, the last 5 rows, and the W3
  zigzag at its bottom. First run: a dashed line (`h-16 rounded-2xl border border-dashed
  border-border`), "+ Add the first entry" in `text-accent`.

**Lists**: the day ledger. Filter: `flex-row rounded-full bg-default p-1` with `AppPressable`
pills, the chosen one `bg-segment`. Status: a dot and a word ("Paid" `success`, "Due" `warning`,
"Overdue" `danger`). Add button: `size-14 rounded-full bg-accent`, absolute `bottom-6 end-5`.

**Detail** (an entry or an invoice): the signed split figure centered at `text-5xl`, the title,
and the chip. Then the receipt: a `bg-surface rounded-2xl` block of key and value rows (label
style, `figure` value), dashed SVG rules between groups, and the W3 zigzag at the bottom.

**Empty state art**: an SVG ledger page, 160 x 112: a `Rect` (`rx={16}`, surface-secondary),
3 lines in `muted` (`strokeOpacity={0.35}`) with a thick end dash, a 4th line dashed
(`strokeDasharray="4 5"`) in `accent` ending in a `Circle` r 9 with a plus. Colors: `useThemeColor`.

**Tab bar**: the classic full-width bar on `background` with the hairline top border. Active
tint is the accent; the focused icon is the filled name, else `<name>-outline`;
`tabBarLabelStyle: { fontSize: 11 }`, no uppercase. No floating pill, no center button.

## 7. Motion

Quiet and exact. Money appears at once and stays still.

- Entry: `FadeIn.duration(240)`; `FadeInDown.duration(280).delay(index * 50)` on the first 3 blocks.
- A new row or a changed figure: `layout={LinearTransition.duration(220)}`. `successFeedback()`
  after a save, `tapFeedback()` on a filter change.
- Press: `AppPressable` with `animation={{ scale: { value: 0.98 } }}` on the card and the steps.
- W1: the outer `Animated.View` of each card turns once in `style`: `animationName: { from: {
  transform: [{ rotate: "-10deg" }] }, to: { transform: [{ rotate: "0deg" }] } }` (front card:
  from `"8deg"`), `animationDuration: "700ms"`, `animationTimingFunction: "ease-out"`. The inner
  View keeps the `rotate-*` class, so the cards start at -2deg and 2deg. Reduced motion: no
  animation.
- Never: a count-up on money (it shows wrong sums on the way), confetti, a loop, a bouncy spring.

## 8. Imagery

No photos: 0 generated images in the first build. All art is SVG from the tokens. A user logo
sits in the card top end (`h-6 w-24`, `resizeMode="contain"`). Never generate cash, coins, piggy
banks, people with phones, charts, or a card with a bank mark. A chart shows real rows only: one
thin bar per day (`w-2 rounded-full bg-accent`).

## 9. Bans

- No gradient except the navy block and the card. No mint fill larger than a button.
- No red for a normal expense. No count-up. No float money, no rounding in the display.
- No mono in sentences, no Manrope in amounts, no display above `text-5xl`.
- No emoji, no icon in a grey circle, no blur, no glow, no shadow above `--surface-shadow`.

## 10. Self-check

1. Every amount goes through `splitMoney` and the `figure` role, signed by hand, with small
   muted decimals.
2. Every amount comes from real rows in minor units, in the currency of the data.
3. Each screen has at most one card or navy block, with lines in `hero-accent` and text in
   `text-hero-foreground`.
4. Lists group rows by day, with a mono date header and a signed day net.
5. Mint marks only money in, the primary action, the active tab, focus, the card lines, and
   step and promise markers.
6. The first-run home shows real zeros and the steps (H1) or the dashed line (H2).
7. Reduced motion removes the W1 card turn.
