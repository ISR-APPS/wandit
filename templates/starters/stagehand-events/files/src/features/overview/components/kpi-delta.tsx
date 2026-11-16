// The change line of a figure: an arrow, the signed percent, and a muted comparison, or "No earlier data".
// The revenue hero and the facts row render it. The color says good or bad news from `goodWhen`.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type KpiDeltaProps = {
	/** Ratio against the previous period: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" when a fall is good news, for example refunds. */
	goodWhen: "up" | "down";
	/** The visible comparison after the percent, for example "against the previous 30 days". */
	comparison?: string;
	className?: string;
};

// Under 0.05 %, the change shows "0%" with no arrow and no color.
const FLAT_CHANGE = 0.0005;

/** A screen reader reads the percent, then the comparison text of the kpi group. */
export function KpiDelta({
	change,
	goodWhen,
	comparison,
	className,
}: KpiDeltaProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<p className={cn("text-muted-foreground text-xs", className)}>
				{t("kpi.noComparison")}
			</p>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	const isRise = change > 0;
	const isGood = isRise === (goodWhen === "up");
	const Arrow = isRise ? TrendUpIcon : TrendDownIcon;
	return (
		<p
			className={cn(
				"flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs",
				className,
			)}
		>
			<span
				className={cn(
					"inline-flex items-center gap-1 font-medium tabular-nums",
					isFlat
						? "text-muted-foreground"
						: isGood
							? "text-success"
							: "text-destructive",
				)}
			>
				{isFlat ? null : <Arrow className="size-3.5 rtl:-scale-x-100" />}
				<bdi dir="ltr">{percent.format(isFlat ? 0 : change)}</bdi>
			</span>
			<span className={comparison ? "text-muted-foreground" : "sr-only"}>
				{comparison ?? t("kpi.vsPrevious")}
			</span>
		</p>
	);
}
