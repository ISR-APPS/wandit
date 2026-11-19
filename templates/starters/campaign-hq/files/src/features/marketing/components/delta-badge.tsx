// A change against the previous period as a small badge: a trend arrow and a signed percent.
// The home stat cards, the result rows, and the spend card render it. Green is good news, red is bad news.
// A change of null (no earlier data) shows "No earlier data" as muted text, never "0%".
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % and more. A smaller change gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type DeltaBadgeProps = {
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for a cost: a fall is good news. "none" for a figure where a change is neither good nor bad. */
	goodWhen: "up" | "down" | "none";
	/** The text after the percent for screen readers. The default is the message `kpi.vsPrevious`. */
	srLabel?: string;
	/** False hides the arrow, for a narrow column of badges. */
	withIcon?: boolean;
	className?: string;
};

/** dir="ltr" keeps "+12%" in this order in an Arabic page. */
export function DeltaBadge({
	change,
	goodWhen,
	srLabel,
	withIcon = true,
	className,
}: DeltaBadgeProps) {
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
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	const isNeutral = isFlat || goodWhen === "none";
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<Badge
			variant={isNeutral ? "outline" : isGood ? "success" : "outline"}
			className={cn(
				"tabular-nums",
				!isNeutral &&
					!isGood &&
					"border-destructive/25 bg-destructive/12 text-destructive",
				className,
			)}
		>
			{withIcon && !isFlat ? (
				<TrendIcon className="rtl:-scale-x-100" aria-hidden="true" />
			) : null}
			<bdi dir="ltr">{percent.format(change)}</bdi>
			<span className="sr-only">{srLabel ?? t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
