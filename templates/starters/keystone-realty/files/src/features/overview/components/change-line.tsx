// The delta line of one figure: an arrow, the percent, and a color for good or bad news.
// FiguresCard and LeadsTrendCard render it under a value.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** Ratio against the previous period: 0.12 is +12 %. null when the previous period has no data. */
	change: number | null;
	/** "down" for a delay: a fall is good news. */
	goodWhen: "up" | "down";
};

/** A change of null (no earlier data) never shows "0%". */
export function ChangeLine({ change, goodWhen }: ChangeLineProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<p className="text-muted-foreground text-sm">{t("kpi.noComparison")}</p>
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
				"flex items-center gap-1 text-sm",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
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
