// The mini price line of one market row: 7 days of prices, green for a rise, red for a fall, and gray for no move.
// MarketsPage renders one in the last column of each row. It has no axis, no grid, and no tooltip.
import { Line, LineChart, YAxis } from "recharts";
import { FLAT_MOVE_RATIO } from "~/features/ledger";
import { type ChartConfig, ChartContainer } from "~/shared/ui/chart";

// A market list colors a price line by its direction, so the line reads the status tokens, not a chart color.
const RISING_CONFIG = {
	price: { color: "var(--success)" },
} satisfies ChartConfig;
const FALLING_CONFIG = {
	price: { color: "var(--destructive)" },
} satisfies ChartConfig;
const FLAT_CONFIG = {
	price: { color: "var(--muted-foreground)" },
} satisfies ChartConfig;

type PriceSparkProps = {
	/** Prices, oldest first. Fewer than 2 prices draw nothing. */
	prices: number[];
	/** The text for screen readers, already translated: the asset and its change over the period. */
	label: string;
};

/** Time runs from the left to the right in every language, like the price lines of an exchange. */
export function PriceSpark({ prices, label }: PriceSparkProps) {
	const first = prices[0] ?? 0;
	const last = prices.at(-1) ?? 0;
	if (prices.length < 2) {
		return null;
	}
	const data = prices.map((price, step) => ({ step, price }));
	const low = Math.min(...prices);
	const high = Math.max(...prices);
	// The scale covers 2 % of the price or more. So a stablecoin draws a flat line, not a storm of 0.1 % moves.
	const padding = Math.max(0, (last * 0.02 - (high - low)) / 2);
	return (
		<ChartContainer
			config={
				// A move under FLAT_MOVE_RATIO over the period reads as flat, like the 24-hour direction of priceMoveOf().
				Math.abs(last - first) < first * FLAT_MOVE_RATIO
					? FLAT_CONFIG
					: last > first
						? RISING_CONFIG
						: FALLING_CONFIG
			}
			className="ms-auto aspect-auto h-9 w-28"
			role="img"
			aria-label={label}
		>
			{/* The 2 px margins keep the stroke of the highest and of the lowest price inside the chart. */}
			<LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
				<YAxis hide domain={[low - padding, high + padding]} />
				<Line
					dataKey="price"
					type="monotone"
					stroke="var(--color-price)"
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}
