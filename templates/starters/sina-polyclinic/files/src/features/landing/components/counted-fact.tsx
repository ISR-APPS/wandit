// One counted fact of the deep band: a figure in the serif face, its label, and where the figure comes from.
// FiguresSection renders four of them and gives each one its share of the scroll.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { CountedFigure } from "../lib/content";
import { LABEL } from "../lib/type-styles";

type CountedFactProps = {
	fact: CountedFigure;
	/** The place of the fact in the row, from 0. It picks the hairlines of the 2 by 2 grid and of the row of four. */
	index: number;
	/** How far the fact has landed, from 0 (the trace did not reach it) to 1 (final figure). */
	landedShare: number;
};

// A dim fact is still readable. The trace lifts it to full ink.
const DIM_OPACITY = 0.14;
// A fact rises by 10px while it lands.
const RISE_PX = 10;

/** The figure counts from 0 to its total while the fact lands. At 1 it shows the true total. */
export function CountedFact({ fact, index, landedShare }: CountedFactProps) {
	const { t, locale } = useT();
	// The count slows down near the total, so the last digits are easy to read.
	const eased = 1 - (1 - landedShare) ** 2;
	const shownTotal = Math.round(fact.total * eased);
	return (
		<div
			className={cn(
				"sp-fact flex flex-col border-background/20 pe-3.5 pt-5.5 pb-4.5 min-[56.25rem]:pb-0",
				index % 2 === 1 && "border-s ps-[clamp(14px,2vw,26px)]",
				index === 2 &&
					"min-[56.25rem]:border-s min-[56.25rem]:ps-[clamp(14px,2vw,26px)]",
				index >= 2 && "border-t min-[56.25rem]:border-t-0",
			)}
			style={{
				opacity: DIM_OPACITY + (1 - DIM_OPACITY) * landedShare,
				transform: `translateY(${(1 - landedShare) * RISE_PX}px)`,
			}}
		>
			<dt
				className={cn(
					LABEL,
					"order-2 mt-3 text-(--sp-teal-lift) tracking-[0.14em]",
				)}
			>
				{t(`figures.${fact.id}.label`)}
			</dt>
			<dd className="order-1 font-display text-[clamp(2rem,3.6vw,3.1rem)] tabular-nums leading-none tracking-[-0.02em]">
				{new Intl.NumberFormat(locale).format(shownTotal)}
			</dd>
			<dd className="order-3 mt-1.75 text-[0.8125rem] text-background/60 leading-normal">
				{t(`figures.${fact.id}.note`)}
			</dd>
		</div>
	);
}
