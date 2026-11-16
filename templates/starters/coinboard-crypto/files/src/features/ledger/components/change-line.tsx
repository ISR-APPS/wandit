// The delta line of a figure: a trend arrow, a signed percent, and a text for screen readers.
// The home figures, the price card, and the position card render it.
// It follows the delta rules of the KPI forms of the app-dashboard skill.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no arrow and no color.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** Ratio against the earlier value: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** What the percent compares with, already translated, for example "against 30 days ago". Screen readers read it. */
	comparison: string;
};

/** A rise is good news in this app. A change of null (no earlier data) never shows "0%". */
export function ChangeLine({ change, comparison }: ChangeLineProps) {
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
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<p
			className={cn(
				"flex items-center gap-1 font-medium text-sm",
				isFlat
					? "text-muted-foreground"
					: change > 0
						? "text-success"
						: "text-destructive",
			)}
		>
			{isFlat ? null : <TrendIcon className="size-4 rtl:-scale-x-100" />}
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{comparison}</span>
		</p>
	);
}
