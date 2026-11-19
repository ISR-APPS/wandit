// The mark of one asset, a circle or a square tile: its ticker, or the first two letters of a long ticker, on a tint of its category color.
// Tables, lists, and the asset page render it before the asset name.
// The app ships no logo image, so the glyph is the visual identity of an asset.
import { cn } from "~/shared/lib/utils";
import type { AssetCategory } from "../lib/ledger-codes";

/** Tint and edge per category, from the chart tokens. The letters stay in the text color, so they keep 4.5:1. */
const CATEGORY_TINT = {
	layer1: "border-chart-1/40 bg-chart-1/15",
	defi: "border-chart-2/40 bg-chart-2/15",
	stablecoin: "border-muted-foreground/40 bg-muted-foreground/15",
	infrastructure: "border-chart-5/40 bg-chart-5/15",
	payments: "border-chart-4/40 bg-chart-4/15",
	gaming: "border-chart-3/40 bg-chart-3/15",
} satisfies Record<AssetCategory, string>;

/** Circle and letter size per glyph size. */
const GLYPH_SIZE = {
	sm: "size-6 text-[8px]",
	md: "size-8 text-[10px]",
	lg: "size-12 text-sm",
	xl: "size-20 text-xl",
} satisfies Record<NonNullable<AssetGlyphProps["size"]>, string>;

type AssetGlyphProps = {
	/** The ticker of the asset: 3 or 4 capital letters. "AUR" shows "AUR", "KUSD" shows "KU". */
	symbol: string;
	category: AssetCategory;
	/** "sm" fits a select row, "md" a list row, "lg" an activity row or a table thumbnail, "xl" the asset profile card. */
	size?: "sm" | "md" | "lg" | "xl";
	/** "square" is the thumbnail tile of a list table. The other places use the circle. */
	shape?: "circle" | "square";
};

/** Decoration only: the name beside it gives the asset, so screen readers skip the glyph. */
export function AssetGlyph({
	symbol,
	category,
	size = "md",
	shape = "circle",
}: AssetGlyphProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center border font-display font-semibold tracking-tight",
				shape === "square" ? "rounded-md" : "rounded-full",
				// The letter size keeps three letters inside the circle: 8 px in 24 px, 10 px in 32 px.
				GLYPH_SIZE[size],
				CATEGORY_TINT[category],
			)}
		>
			{/* Three-letter tickers never repeat, so they show whole. Four letters do not fit, so they show two. */}
			{symbol.length <= 3 ? symbol : symbol.slice(0, 2)}
		</span>
	);
}
