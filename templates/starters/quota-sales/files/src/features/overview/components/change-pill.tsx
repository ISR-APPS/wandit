// The delta pill of one KPI figure: an arrow, a signed percent, and a good or bad color.
// KpiFigures renders it next to each value that has an earlier period.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { fillMessage, type KpiItem } from "~/features/sales";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % (or 0.05 pts) and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangePillProps = {
	/** The change against the previous period, read as `changeKind` says. */
	change: number;
	changeKind: KpiItem["changeKind"];
	goodWhen: KpiItem["goodWhen"];
};

/** The figure shows no pill when its change is null. A "points" change shows "-0.9 pts". */
export function ChangePill({ change, changeKind, goodWhen }: ChangePillProps) {
	const { t, locale } = useT();
	const signed = {
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	} as const;
	const label =
		changeKind === "points"
			? fillMessage(t("kpi.points"), {
					// A ratio difference of 0.009 is 0.9 percentage points.
					value: new Intl.NumberFormat(locale, signed).format(change * 100),
				})
			: new Intl.NumberFormat(locale, { ...signed, style: "percent" }).format(
					change,
				);
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
				{label}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</Badge>
	);
}
