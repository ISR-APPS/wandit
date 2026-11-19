// The change of a figure against the period before: a signed percent in a color that says good or bad news.
// The home cards, the item list figures, and the family list render it, as plain text or in an outline badge.
// A change of null (no earlier data) never shows "0%".
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no color.
const FLAT_CHANGE = 0.0005;

type DeltaProps = {
	/** Ratio against the period before: 0.12 is +12 %. null when no earlier data exists. */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example low stock items. "neutral" gets no color. */
	goodWhen: "up" | "down" | "neutral";
	/** "text" is a colored percent in the line; "badge" puts it in an outline badge, as the kit list rows do. */
	variant?: "text" | "badge";
	className?: string;
};

/** The screen reader text says what the percent compares. */
export function Delta({
	change,
	goodWhen,
	variant = "text",
	className,
}: DeltaProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<span className={cn("text-muted-foreground text-xs", className)}>
				{t("kpi.noComparison")}
			</span>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isColored = Math.abs(change) >= FLAT_CHANGE && goodWhen !== "neutral";
	const isGood = change > 0 === (goodWhen === "up");
	const tone = !isColored
		? "text-muted-foreground"
		: isGood
			? "text-success"
			: "text-destructive";
	const text = (
		<>
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi dir="ltr" className="tabular-nums">
				{percent.format(change)}
			</bdi>
			<span className="sr-only">{t("kpi.vsPrevious")}</span>
		</>
	);
	return variant === "badge" ? (
		<Badge variant="outline" className={cn(tone, className)}>
			{text}
		</Badge>
	) : (
		<span className={cn("font-medium text-sm", tone, className)}>{text}</span>
	);
}
