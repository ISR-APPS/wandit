// One program on the fight card: tier, "program vs. opponent", facts, and the claim button.
// fight-card-section.tsx renders one for each entry of BOUTS. landing.css ignites the row on hover and when it is claimed.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useInView } from "../hooks/use-in-view";
import type { Bout, BoutId } from "../lib/content";

type BoutRowProps = {
	bout: Bout;
	/** The place of the row on the card, 1 to 4. The stamp shows it after the "R" of "Round". */
	round: number;
	/** True when the booking ticket holds this program. The row then stays ignited. */
	isClaimed: boolean;
	/** Puts this program on the booking ticket and scrolls to the ticket. */
	onClaim: (id: BoutId) => void;
};

/** A row of the fight card. Its claim button hands the program to the booking ticket. */
export function BoutRow({ bout, round, isClaimed, onClaim }: BoutRowProps) {
	const { t } = useT();
	const { ref, phase } = useInView();
	return (
		<article
			ref={ref}
			data-reveal={phase}
			data-claimed={isClaimed}
			className="sp-bout grid gap-4 px-5 py-6 md:grid-cols-[8.5rem_1fr_8rem] md:items-center md:gap-5 md:px-8 md:py-8 xl:grid-cols-[8.5rem_1fr_auto_8rem]"
		>
			<div className="md:self-start md:pt-1">
				<span
					className={cn(
						"inline-block border px-2 py-1.5 font-bold text-[0.62rem] uppercase leading-none tracking-[0.24em]",
						bout.isMainEvent
							? "sp-gold border-current"
							: "sp-line-strong text-muted-foreground",
					)}
				>
					{t(`card.${bout.id}.tier`)}
				</span>
				<span className="sp-faint ms-3 text-[0.64rem] uppercase tracking-[0.2em] md:ms-0 md:mt-2.5 md:block">
					{t(`card.${bout.id}.rounds`)}
				</span>
			</div>

			<div className="min-w-0">
				<h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pe-16 font-display uppercase md:pe-0">
					<span className="sp-bout-name font-extrabold text-[clamp(2rem,4vw,3.4rem)] leading-[0.95]">
						{t(`card.${bout.id}.name`)}
					</span>
					<span className="sp-hot font-extrabold text-[clamp(1.05rem,2vw,1.5rem)] lowercase tracking-[0.1em]">
						{t("card.versus")}
					</span>
					<span className="sp-bout-foe font-extrabold text-[clamp(1.3rem,2.7vw,2.1rem)] text-muted-foreground leading-none">
						{t(`card.${bout.id}.foe`)}
					</span>
				</h3>
				<p className="mt-3 max-w-[62ch] text-[0.95rem] text-muted-foreground leading-relaxed">
					{t(`card.${bout.id}.body`)}
				</p>
				<p className="sp-faint mt-3.5 text-balance font-bold text-[0.66rem] uppercase leading-relaxed tracking-[0.22em]">
					{t(`card.${bout.id}.meta`)}
					{/* The no-break space keeps the dash at the end of a line, never at the start. */}
					<span className="hidden sm:inline">{"\u00a0— "}</span>
					<span className="sp-gold block whitespace-nowrap sm:inline">
						{t(`card.${bout.id}.price`)}
					</span>
				</p>
			</div>

			{/* The ghost number has its own grid column from xl, so it never sits under the text. Below xl the row has no room for it. */}
			<span
				aria-hidden="true"
				className="sp-bout-ghost pointer-events-none -z-10 me-4 hidden font-display font-extrabold text-[clamp(6rem,7.5vw,8.5rem)] leading-none xl:block"
			>
				{bout.number}
			</span>

			<div className="flex items-center justify-end md:flex-col md:justify-center md:gap-1">
				<div
					aria-hidden="true"
					className="sp-bout-stamp absolute end-4 top-4 grid size-14 place-content-center text-center font-display font-extrabold text-xl leading-none md:static md:size-19 md:text-[1.75rem]"
				>
					<span>
						{t("card.stampPrefix")}
						{round}
						<small className="block font-bold font-sans text-[0.5rem] uppercase tracking-[0.24em]">
							{t("card.stampNote")}
						</small>
					</span>
				</div>
				<button
					type="button"
					aria-pressed={isClaimed}
					onClick={() => onClaim(bout.id)}
					className="sp-claim -mt-3 cursor-pointer whitespace-nowrap pt-3 pb-1.5 font-bold text-[0.66rem] uppercase tracking-[0.22em] md:mt-0"
				>
					{isClaimed ? t("card.claimed") : t("card.claim")}
				</button>
			</div>
		</article>
	);
}
