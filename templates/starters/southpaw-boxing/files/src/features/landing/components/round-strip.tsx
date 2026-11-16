// The strip of twelve week pips of the distance section. Week 12 is the gold pip.
// distance-section.tsx renders it. landing.css lights the pips in order when use-in-view.ts reports the entrance.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useInView } from "../hooks/use-in-view";
import { Star } from "./star";

/** The weeks of the program, 1 to 12. */
const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** Time between two pips, in milliseconds. Twelve pips light in about 0.9 s. */
const PIP_STEP_MS = 50;

/** The strip reads as one image for screen readers. The pips group in threes, like the four phases under them. */
export function RoundStrip() {
	const { t } = useT();
	const { ref, phase } = useInView();
	return (
		<div
			ref={ref}
			data-reveal={phase}
			role="img"
			aria-label={t("distance.stripLabel")}
			className="sp-strip mb-9 grid grid-cols-6 gap-2 md:mb-10 md:grid-cols-4 md:gap-5"
		>
			{[0, 3, 6, 9].map((offset) => (
				<div
					key={offset}
					className="col-span-3 grid grid-cols-3 gap-2 md:col-span-1"
				>
					{WEEKS.slice(offset, offset + 3).map((week) => (
						<div
							key={week}
							className={cn(
								"sp-pip grid aspect-[1/0.9] place-content-center font-display font-extrabold text-2xl leading-none md:text-[clamp(1.5rem,2.6vw,2.4rem)]",
								week === 12 && "sp-pip-champ",
							)}
							style={{ animationDelay: `${(week - 1) * PIP_STEP_MS}ms` }}
						>
							<small className="absolute start-1.5 top-1.5 hidden font-bold font-sans text-[0.5rem] uppercase leading-none tracking-[0.2em] opacity-75 md:block">
								{t("distance.week")}
							</small>
							{week}
							{week === 12 && (
								<Star className="absolute end-1.5 bottom-1.5 text-[0.65rem] opacity-80" />
							)}
						</div>
					))}
				</div>
			))}
		</div>
	);
}
