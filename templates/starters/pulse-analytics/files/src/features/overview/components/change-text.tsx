// A signed percent in the color of its news: green for good news, red for bad news, muted when flat.
// The top accounts, sign-up weeks, and product areas cards of the home render it inside a line or a badge.

import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

// One decimal shows 0.05 % and more. A smaller change shows "0%", so it gets no color.
const FLAT_CHANGE = 0.0005;

type ChangeTextProps = {
	/** Ratio against the period before: 0.12 is +12 %. null shows a dash: the period before had nothing. */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen?: "up" | "down";
	className?: string;
};

/** The text "+12.3%". dir="ltr" keeps the sign before the number in an Arabic page. */
export function ChangeText({
	change,
	goodWhen = "up",
	className,
}: ChangeTextProps) {
	const { locale } = useT();
	if (change === null) {
		return <span className={cn("text-muted-foreground", className)}>–</span>;
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const isFlat = Math.abs(change) < FLAT_CHANGE;
	const isGood = change > 0 === (goodWhen === "up");
	return (
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
