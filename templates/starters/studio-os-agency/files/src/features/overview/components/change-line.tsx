// The delta of one figure: an arrow, the signed percent, and a color for good or bad news.
// The entity rows and the figures card render it. It follows the kpi form "icon" of the app-dashboard skill.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { KpiItem } from "../lib/series";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** The figure. Its `change` is a ratio (0.123 shows "+12.3%") or, with changeUnit "points", a difference. */
	item: Pick<KpiItem, "change" | "changeUnit" | "goodWhen">;
	/** Text size class. The default is text-sm. */
	className?: string;
};

/** A change of null (no earlier data) shows a muted line, never "0%". */
export function ChangeLine({ item, className }: ChangeLineProps) {
	const { t, locale } = useT();
	const { change } = item;
	if (change === null) {
		return (
			<p className={cn("text-muted-foreground text-sm", className)}>
				{t("kpi.noComparison")}
			</p>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	// A change in points is a difference of two shares: 0.16 shows "+16 pts".
	const points = new Intl.NumberFormat(locale, {
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const text =
		item.changeUnit === "points"
			? t("kpi.points").replace("{points}", points.format(change * 100))
			: percent.format(change);
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (item.goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<p
			className={cn(
				"flex items-center gap-1 font-medium text-sm",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
				className,
			)}
		>
			{isFlat ? null : <TrendIcon className="size-4 rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{text}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</p>
	);
}
