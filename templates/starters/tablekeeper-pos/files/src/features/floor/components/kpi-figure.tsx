// One KPI figure: the label, the value, and the change against the same day last week.
// OrdersHeatPanel renders 2 figures in its header. The day report renders 4 in its band, at size lg.
// It follows the "number" KPI form of the app-dashboard skill. It writes nothing.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { formatCents, wholeMoneyFormat } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { KpiItem } from "../lib/series";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type KpiFigureProps = {
	item: KpiItem;
	/** The value size: md in a panel header, lg in the figures band of the day report. */
	size?: "md" | "lg";
};

/** The label, the value in the numeral face, and one delta line. A change of null never shows "0%". */
export function KpiFigure({ item, size = "md" }: KpiFigureProps) {
	const { t, locale } = useT();
	const value = item.isMoney
		? formatCents(wholeMoneyFormat(locale), item.value)
		: new Intl.NumberFormat(locale).format(item.value);

	return (
		<div className="grid gap-1">
			<span className="label-text text-muted-foreground text-xs">
				{t(item.labelKey)}
			</span>
			<span
				className={cn(
					"font-numeric font-semibold tabular-nums leading-none",
					size === "lg" ? "text-3xl" : "text-2xl",
				)}
			>
				{value}
			</span>
			<ChangeLine item={item} />
		</div>
	);
}

/** The delta line: an arrow for the direction, a color for good or bad news, and the percent. */
function ChangeLine({ item }: { item: KpiItem }) {
	const { t, locale } = useT();
	const { change } = item;
	if (change === null) {
		return (
			<p className="text-muted-foreground text-xs">{t("kpi.noComparison")}</p>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (item.goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<p
			className={cn(
				"flex items-center gap-1 text-xs",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
			)}
		>
			{isFlat ? null : <TrendIcon className="size-3.5 rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</p>
	);
}
