// The delta pill of a figure: an arrow, a signed percent, and a text for screen readers.
// The KPI figures of the home and the channel cards render it.
// It follows the KPI form "delta" of the app-dashboard skill.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangePillProps = {
	/** Ratio against the previous period of the same length: 0.12 is +12 %. */
	change: number;
	/** "down" for a figure where a fall is good news. */
	goodWhen: "up" | "down";
	/** Screen reader text after the percent, already translated. The default names the previous period. */
	comparison?: string;
};

/** The caller renders no pill when a figure has no earlier data. This part never shows "0%" for that case. */
export function ChangePill({ change, goodWhen, comparison }: ChangePillProps) {
	const { t, locale } = useT();
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
		<Badge
			variant={isFlat ? "secondary" : isGood ? "success" : "destructive"}
			// The destructive variant is solid red. This gives it the tinted look of success.
			className={cn(
				!isFlat &&
					!isGood &&
					"border-destructive/25 bg-destructive/12 text-destructive hover:bg-destructive/12",
			)}
		>
			{isFlat ? null : <TrendIcon className="rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{comparison ?? t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
