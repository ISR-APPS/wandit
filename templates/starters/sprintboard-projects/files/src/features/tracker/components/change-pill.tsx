// The delta pill of one figure: the change against the previous period, colored as good or bad news.
// The overview entity rows and the figures list render it. It follows the kpi form "delta" of the app-dashboard skill.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangePillProps = {
	/** The change as a ratio from changeRatio: 0.123 shows "+12.3%". */
	change: number;
	/** "down" for a figure where a fall is good news, such as bugs or cycle time. */
	goodWhen: "up" | "down";
};

/** The figure shows no pill when its change is null. Then it shows "No earlier data" instead. */
export function ChangePill({ change, goodWhen }: ChangePillProps) {
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
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
