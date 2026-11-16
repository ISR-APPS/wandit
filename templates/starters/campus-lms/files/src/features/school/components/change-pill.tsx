// The delta pill of a figure: an arrow, a signed percent, and a text for screen readers.
// The section headings of the home render it beside their totals.
// It follows the pill rules of the KPI forms of the app-dashboard skill.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { FLAT_CHANGE } from "../lib/series";

type ChangePillProps = {
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example late work. */
	goodWhen?: "up" | "down";
	className?: string;
};

/** A change of null (no earlier data) renders nothing: it never shows "0%". */
export function ChangePill({
	change,
	goodWhen = "up",
	className,
}: ChangePillProps) {
	const { t, locale } = useT();
	if (change === null) {
		return null;
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	// A flat change shows "0%", so it gets no arrow and no color.
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<Badge
			variant={isFlat ? "secondary" : isGood ? "success" : "outline"}
			className={cn(
				!isFlat &&
					!isGood &&
					"border-destructive/25 bg-destructive/10 text-destructive",
				className,
			)}
		>
			{/* A trend arrow mirrors in Arabic. A rotation would turn a rise into a fall. */}
			{isFlat ? null : <TrendIcon className="rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(isFlat ? 0 : change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
