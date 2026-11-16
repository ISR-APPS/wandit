// The delta line of one figure: the arrow, the signed percent, and a screen reader text.
// The figures card of the home renders it under each label.
// A change of null (no earlier data) never shows "0%".
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { KpiItem } from "../lib/series";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** The figure. The line reads its change and its goodWhen. */
	item: KpiItem;
};

/** The arrow shows the direction. The color shows good or bad news, from goodWhen ("neutral": muted). */
export function ChangeLine({ item }: ChangeLineProps) {
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
	const isGood = change > 0 === (item.goodWhen === "up");
	// A neutral figure keeps its arrow, but no color claims good or bad news.
	const isColored = !isFlat && item.goodWhen !== "neutral";
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<p
			className={cn(
				"flex items-center gap-1 text-xs",
				!isColored
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
