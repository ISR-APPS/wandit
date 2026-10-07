# KPI form meter

Each figure shows its value as a share of a whole from the data, with a bar or an arc.

## Data

- The figures read `KpiItem[]` from `overviewKpisQueryOptions()` (data.md, sections 4 and 6).
  The home turns each `labelKey` into `label` with `t()` and keeps the first `KPI_COUNT` items.
- The home decides where the figures go and how many it shows. This file gives the parts of one figure.
- One component draws the figures of one slot. It takes `items` and the layout class of the home.
  Its skeleton takes `count` and the same class.
- The KPI function always returns one row. On a first visit, each value is a real 0 and each change is `null`.
- `item.target` holds the whole of the value. Set it from the data, in this order of choice:
  1. A count of all: done of all orders, rooms in use of all rooms, machines running of all machines.
  2. A capacity in the data: seats, beds, slots of the day, places in stock.
  3. The same metric in the previous period, also when it is 0: `totals.units_yesterday` for "units today".
  4. A target that the user gave. Never invent one.
- The `buildOverviewKpis` example of data.md sets only the kind-1 whole of "machines-running".
  Give a kind-3 whole to each KPI that has a previous value and no whole of kind 1 or 2.
  For "units-today", add this line: `target: totals.units_yesterday,`.
- Needs no user target. Most KPIs with a history have a whole of kind 3.

## Anatomy

1. Label: `item.label`, in the label look of the style (`label-text`).
2. Value line: the value, with `font-numeric tabular-nums`. For a whole of kind 1, 2, or 4, a muted " / whole" follows.
   Format both with `new Intl.NumberFormat(locale, item.format)`.
3. Meter: a bar (`Progress` from `~/shared/ui/progress`), or the arc or ring that the style names.
4. Share line: the share and the words of the whole, for example "75% of all".
5. Delta: a pill at the end of the value line, as in `kpis/delta.md`. A whole of kind 3 shows no pill.

- The style gives the panel of a figure: a card, a ruled cell, a tile, a slip, or no box.
- The style gives the meter shape, its thickness, the sizes, and the weights.
- The snippet shows the logic. Its `Progress` bar and its text size are the no-style defaults.
- The skeleton keeps the label, the value, the meter, and the share line in their final sizes.

## Rules

- The meter clamps at the whole: a value above it shows a full meter. The share text keeps the real number.
- The share has one decimal. Under the whole, it stops at 99.9 %, so "100%" never shows too early.
- The share sits in `<bdi dir="ltr">`, so "75%" keeps its order in Arabic.
- `WHOLE_WORDS` maps each `KpiItem.id` with a `target` to the message key of its whole.
  The key `kpi.ofPrevious` marks a whole of kind 3: no " / whole" and no pill, because the share says it.
- No `target`: the KPI has no whole of any kind. The figure shows the value and the delta only, with no meter.
- A whole of 0 (a first visit): the figure draws the empty meter track and no share. `Progress` accepts a `max` of 0.
  A kind-3 whole of 0 also shows the muted line "No earlier data". The first preview keeps the meter form.
- An SVG arc or ring has `aria-hidden="true"`: the share line gives the facts.
  It fills from the start side. Mirror it with `rtl:-scale-x-100`.
- The pill is a `Badge` or the status mark of the style, as `kpis/delta.md` says.
  Good news is `success`, bad news is a tinted destructive pill, "0%" is `secondary`.
  Format the change with `signDisplay: "exceptZero"` and one decimal. A change under 0.05 % shows "0%" with no arrow.
- The pill arrow mirrors with `rtl:-scale-x-100`, never with `rtl:rotate-180`. A rotation turns a rise into a fall.
- The pill holds a screen reader text that names the comparison. `change: null` shows no pill.
  A figure with no pill and no meter shows "No earlier data". Never show "0%" for it.
- The home names the period once. No figure repeats it.

The meter and the share, with imports from `~/shared/i18n` and `~/shared/ui/progress`:

```tsx
// One decimal rounds 0.9996 up to "100%". A value under its whole stops at 99.9 %.
const MAX_SHARE_UNDER_WHOLE = 0.999;
/** Words after the share, keyed by KpiItem.id. Each KPI with a `target` has one entry. */
const WHOLE_WORDS: Record<string, TranslationKey> = { "machines-running": "kpi.ofAll", "units-today": "kpi.ofPrevious" };
/** Meter and share of one figure. `whole` is `item.target`. A whole of 0 draws the empty track and no share. */
function MeterShare({ item, whole }: { item: KpiItem; whole: number }) {
	const { t, locale } = useT();
	const share = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
	const ratio = item.value / whole;
	const words = WHOLE_WORDS[item.id];
	// No-style defaults: the Progress bar and text-sm. The style Anatomy can give an arc or a ring.
	return (
		<>
			<Progress value={item.value} max={whole} aria-label={item.label} />
			{whole > 0 ? (
				<p className="text-muted-foreground text-sm">
					<bdi dir="ltr" className="tabular-nums">{share.format(item.value < whole ? Math.min(ratio, MAX_SHARE_UNDER_WHOLE) : ratio)}</bdi>
					{words ? ` ${t(words)}` : null}
				</p>
			) : null}
			{/* A previous period of 0 (a first visit) gives no share. The empty track stays, and this line tells why. */}
			{whole === 0 && words === "kpi.ofPrevious" ? <p className="text-muted-foreground text-sm">{t("kpi.noComparison")}</p> : null}
		</>
	);
}
```

## Fallback

No shown KPI has a count of all, a capacity, or a history (a value of the previous period). Use `kpis/delta.md`.
Decide it from the schema at build time. Empty tables on a first build do not count.

## Messages

Add a `kpi` group to `messages` in `src/shared/i18n/messages.ts`. Write the text in the app language.
Add only the keys of the wholes that the app uses.

- `kpi.noComparison`: "No earlier data"
- `kpi.vsPrevious`: "against the previous period". Screen readers read it in the pill.
- `kpi.ofAll`: "of all"
- `kpi.ofCapacity`: "of capacity"
- `kpi.ofPrevious`: "of the previous period"
- `kpi.ofTarget`: "of target". Only for a target that the user gave.
