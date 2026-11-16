// The price board: a list with the price first, in a fixed column, and the name second. It has no rules.
// SidesSection renders one for the shakes and one for the sides. It reads the items of lib/content.ts.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { MenuItem } from "../lib/content";
import { DISPLAY_TEXT } from "../lib/type-styles";
import { Price } from "./price";

type PriceBoardProps = {
	/** The lines of the board, in menu order. */
	items: readonly MenuItem[];
};

/** The price column is 2.3em of the price size. The widest price, "650 DA", takes 2.1em. So all names start on one edge. */
export function PriceBoard({ items }: PriceBoardProps) {
	const { t } = useT();
	return (
		<ul className="mt-1.5">
			{items.map((item) => (
				<li key={item.id} className="flex items-baseline gap-3 py-2.5">
					<Price
						amountDa={item.priceDa}
						unitTone="hot"
						className="w-[2.3em] shrink-0"
					/>
					<span
						className={cn(
							DISPLAY_TEXT,
							"text-[clamp(1.15rem,1.7vw,1.4rem)] leading-none",
						)}
					>
						{t(item.nameKey)}
					</span>
				</li>
			))}
		</ul>
	);
}
