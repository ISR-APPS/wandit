// The trend arrow at the end of a small card head: up in the success color, down in the destructive color.
// The average daily events card and the devices card of the home render it in their CardAction.
import { MinusIcon, TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";

type TrendMarkProps = {
	/** Ratio against the period before: 0.12 is +12 %. null draws a muted dash: the period before had nothing. */
	change: number | null;
};

/** The arrow has a text for screen readers that says the direction against the period before. */
export function TrendMark({ change }: TrendMarkProps) {
	const { t } = useT();
	if (change === null || change === 0) {
		return (
			<span className="text-muted-foreground">
				<MinusIcon className="size-4" />
				<span className="sr-only">{t("kpi.noComparison")}</span>
			</span>
		);
	}
	const isUp = change > 0;
	const Icon = isUp ? TrendUpIcon : TrendDownIcon;
	return (
		<span className={isUp ? "text-success" : "text-destructive"}>
			<Icon className="size-4 rtl:-scale-x-100" />
			<span className="sr-only">
				{t(isUp ? "overview.trendUp" : "overview.trendDown")}
			</span>
		</span>
	);
}
