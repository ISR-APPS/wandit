// The delta of a figure as a small outline badge: the signed percent and an arrow, in green or red.
// The KPI cards of the home and of the listings page render it beside or above their value.
// A change of null means no earlier data: the badge then says so and never shows "0%".
import { ArrowDownRightIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % and more. A smaller change prints "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeBadgeProps = {
	/** Ratio against the earlier value: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example the days on the market. */
	goodWhen: "up" | "down";
	/** What the change compares, for screen readers, for example "against 30 days ago". */
	comparison: string;
	className?: string;
};

/** The arrow shows the direction. The color shows good or bad news, from goodWhen. */
export function ChangeBadge({
	change,
	goodWhen,
	comparison,
	className,
}: ChangeBadgeProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<Badge
				variant="outline"
				className={cn("font-normal text-muted-foreground", className)}
			>
				{t("kpi.noComparison")}
			</Badge>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	const isGood = change > 0 === (goodWhen === "up");
	const TrendIcon = change < 0 ? ArrowDownRightIcon : ArrowUpRightIcon;
	return (
		<Badge
			variant="outline"
			className={cn(
				"gap-1 font-medium",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
				className,
			)}
		>
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			{isFlat ? null : <TrendIcon className="size-3 rtl:-scale-x-100" />}
			<span className="sr-only">{comparison}</span>
		</Badge>
	);
}
