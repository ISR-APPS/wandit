// The change of one figure against the period before: an arrow, a signed percent, and a color.
// The totals line of the overview and the summary of the accounts page render it.
// It follows the delta rules of the app-dashboard skill: green is good news, red is bad news.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type ChangeLineProps = {
	/** Ratio against the period before: 0.12 is +12 %. null means the period before had no value. */
	change: number | null;
	/** "down" for costs and debts: a fall is good news. */
	goodWhen: "up" | "down";
	className?: string;
};

// Under 0.05 % the percent rounds to 0.0, so the line shows no direction.
const FLAT_BELOW = 0.0005;

/** "No earlier data" when `change` is null. Never "0%" for a missing comparison. */
export function ChangeLine({ change, goodWhen, className }: ChangeLineProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<span className={cn("text-muted-foreground text-xs", className)}>
				{t("kpi.noComparison")}
			</span>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_BELOW;
	const isGood = goodWhen === "up" ? change > 0 : change < 0;
	const Arrow = change > 0 ? TrendUpIcon : TrendDownIcon;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 text-xs tabular-nums",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
				className,
			)}
		>
			{/* A trend arrow mirrors in Arabic. A rotation would turn a rise into a fall. */}
			{isFlat ? null : <Arrow className="size-3.5 rtl:-scale-x-100" />}
			<bdi dir="ltr">{percent.format(isFlat ? 0 : change)}</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</span>
	);
}
