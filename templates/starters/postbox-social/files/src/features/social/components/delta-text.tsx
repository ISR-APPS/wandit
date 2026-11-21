// A signed percent in the color of its news: "+12.4%" in green, "-3%" in red.
// The list rows of the home, the channel table, and the audience cards render it inline in a sentence or a badge.
// No previous value gives a dash with a screen reader text, never "0%".
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// One decimal shows 0.05 % and more. A smaller change reads as flat, with no color.
const FLAT_CHANGE = 0.0005;

type DeltaTextProps = {
	/** Ratio against the previous period: 0.12 is +12 %. null when the previous period has no value. */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen?: "up" | "down";
	className?: string;
};

/** The colored percent. The caller writes the words around it, for example "from the previous period". */
export function DeltaText({
	change,
	goodWhen = "up",
	className,
}: DeltaTextProps) {
	const { t, locale } = useT();
	if (change === null) {
		return (
			<span className={cn("text-muted-foreground", className)}>
				<span aria-hidden="true">–</span>
				<span className="sr-only">{t("kpi.noComparison")}</span>
			</span>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	// The color shows good or bad news. A fall of a cost is good news, so goodWhen decides.
	const isGood = change > 0 === (goodWhen === "up");
	return (
		// dir="ltr" keeps "+12%" in this order in an Arabic page.
		<bdi
			dir="ltr"
			className={cn(
				"tabular-nums",
				isFlat
					? "text-muted-foreground"
					: isGood
						? "text-success"
						: "text-destructive",
				className,
			)}
		>
			{percent.format(change)}
		</bdi>
	);
}
