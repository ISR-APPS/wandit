// One membership of round 6 as a title belt: strap, plate, price, benefits, and the action.
// belts-section.tsx renders one for each entry of BELTS.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { Belt } from "../lib/content";
import { BeltPlate } from "./belt-plate";
import { Star } from "./star";

/** A belt card. The champion card has the gold frame and the "The Strap" flag. Its action leads to the booking ticket. */
export function BeltCard({ belt }: { belt: Belt }) {
	const { t } = useT();
	const isChampion = belt.id === "champion";
	return (
		<div
			className={cn(
				"sp-belt flex h-full flex-col px-6 pb-8 text-center md:px-7",
				isChampion && "sp-belt-champion",
			)}
		>
			{isChampion && (
				<span className="sp-belt-flag absolute -end-2.5 top-7 z-10 px-3 py-1.5 font-bold text-[0.6rem] uppercase leading-none tracking-[0.22em]">
					{t("belts.flag")}
				</span>
			)}
			<div aria-hidden="true" className="sp-strap -mx-6 h-3.5 md:-mx-7" />
			<div className="relative mx-auto -mt-2 size-30">
				<BeltPlate belt={belt.id} />
			</div>
			<h3
				className={cn(
					"mt-4 font-display font-extrabold text-[2.5rem] uppercase leading-none",
					isChampion && "sp-gold",
				)}
			>
				{t(`belts.${belt.id}.tier`)}
			</h3>
			<p className="mt-3 font-display font-extrabold text-[3.75rem] tabular-nums leading-none">
				{t(`belts.${belt.id}.price`)}
				<small className="sp-faint ms-1 font-bold font-sans text-xs uppercase tracking-[0.24em]">
					{t("belts.perMonth")}
				</small>
			</p>
			<p className="sp-faint mt-2 mb-5 text-sm tracking-[0.04em]">
				{t(`belts.${belt.id}.blurb`)}
			</p>
			<ul className="mb-7 flex-1 text-start">
				{belt.perks.map((perk) => (
					<li
						key={perk}
						className="sp-line flex gap-3 border-b border-dashed py-2.5 text-[0.92rem] text-muted-foreground"
					>
						<Star
							className={cn(
								"mt-1 text-sm",
								isChampion ? "sp-gold" : "text-primary",
							)}
						/>
						{t(perk)}
					</li>
				))}
			</ul>
			<a
				href="#book"
				className={cn(
					"sp-btn inline-block self-center px-7 pt-3.5 pb-3 font-display font-extrabold text-xl uppercase leading-tight tracking-[0.07em]",
					belt.isFilledAction ? "sp-btn-primary" : "sp-btn-ghost",
				)}
			>
				{t(`belts.${belt.id}.cta`)}
			</a>
			<p className="sp-faint mt-4 text-balance font-bold text-[0.6rem] uppercase tracking-[0.26em]">
				{t(`belts.${belt.id}.terms`)}
			</p>
		</div>
	);
}
