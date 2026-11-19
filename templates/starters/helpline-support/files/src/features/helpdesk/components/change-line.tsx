// The delta line of a figure: an arrow, a signed percent, and a text for screen readers.
// The KPI cards of the home render it under each value. The article figures use the same delta rule.
// It follows the KPI form "number" of the app-dashboard skill.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example a reply time. */
	goodWhen: "up" | "down";
	className?: string;
};

/** A change of null (no earlier data) never shows "0%". */
export function ChangeLine({ change, goodWhen, className }: ChangeLineProps) {
	const { t, locale } = useT();
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
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (goodWhen === "up");
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
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</p>
	);
}
