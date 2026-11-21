// The trend arrow at the end of a small figure card: green up for a rise, red down for a fall.
// The daily conversions card and the revenue card of the home render it in their CardAction.
// Both figures are good news when they rise. A screen reader reads the signed percent.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CardAction } from "~/shared/ui/card";

type TrendMarkProps = {
	/** Ratio against the period before: 0.12 is +12 %. null renders nothing. */
	change: number | null;
};

/** The arrow sits in a CardAction, so it takes the end of the header row. */
export function TrendMark({ change }: TrendMarkProps) {
	const { t, locale } = useT();
	if (change === null) {
		return null;
	}
	const signed = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<CardAction>
			<TrendIcon
				role="img"
				aria-label={`${signed.format(change)} ${t("kpi.vsPrevious")}`}
				className={cn(
					"size-4 rtl:-scale-x-100",
					change < 0 ? "text-destructive" : "text-success",
				)}
			/>
		</CardAction>
	);
}
