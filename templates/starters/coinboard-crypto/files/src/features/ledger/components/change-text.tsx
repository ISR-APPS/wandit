// A signed percent in the color of its direction: green for a rise, red for a fall, muted for a flat move.
// Table cells and list rows show a price change with it. The sign carries the meaning, so color is not the only mark.

import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { signedPercentFormat } from "../lib/format";

type ChangeTextProps = {
	/** The change as a ratio: 0.0241 shows "+2.41%". */
	change: number;
	/** A change under this ratio shows muted. Pass FLAT_MOVE_RATIO where a "Flat" tab or badge sits near the value. */
	flatBelow?: number;
	className?: string;
};

// Two decimals show 0.005 % and more. A smaller change prints as 0.00 %.
const ROUNDS_TO_ZERO_RATIO = 0.00005;

/** A change that rounds to 0.00 % shows muted, with no sign. */
export function ChangeText({
	change,
	flatBelow = ROUNDS_TO_ZERO_RATIO,
	className,
}: ChangeTextProps) {
	const { locale } = useT();
	const isZero = Math.abs(change) < ROUNDS_TO_ZERO_RATIO;
	const isFlat = Math.abs(change) < flatBelow;
	return (
		// dir="ltr" keeps "+2.41%" in this order in an Arabic page.
		<bdi
			dir="ltr"
			className={cn(
				"tabular-nums",
				isFlat
					? "text-muted-foreground"
					: change > 0
						? "text-success"
						: "text-destructive",
				className,
			)}
		>
			{signedPercentFormat(locale).format(isZero ? 0 : change)}
		</bdi>
	);
}
