// The delta line of a figure: an arrow, a signed percent, and a text for screen readers.
// The KPI cards of the home and of the venues page render it.
// It follows the KPI form "number" of the app-dashboard skill.
// It renders a span, so a caller can put a context text in the same line and let it wrap by word.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// One decimal shows 0.05 % and more. A smaller change counts as no change.
const FLAT_CHANGE = 0.0005;

type ChangeLineProps = {
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example refunds. */
	goodWhen: "up" | "down";
	className?: string;
};

/** A change of null (no earlier data) or a flat change never shows "0%". */
export function ChangeLine({ change, goodWhen, className }: ChangeLineProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)}>
				{t("kpi.noComparison")}
			</span>
		);
	}
	// A change under 0.05 % would read "0%". The kit rule says never "0%", so it reads "No change".
	if (Math.abs(change) < FLAT_CHANGE) {
		return (
			<span className={cn("text-muted-foreground text-sm", className)}>
				{t("kpi.noChange")}
			</span>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	// The arrow shows the direction. The color shows good or bad news, from goodWhen.
	const isGood = change > 0 === (goodWhen === "up");
	const TrendIcon = change < 0 ? TrendDownIcon : TrendUpIcon;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 align-middle font-medium text-sm",
				isGood ? "text-success" : "text-destructive",
				className,
			)}
		>
			<TrendIcon className="size-4 rtl:-scale-x-100" />
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</span>
	);
}
