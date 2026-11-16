// The programme of the three nights. The day stands in display caps at the start,
// the four sets of the night in the middle, the opening hours at the end. 2px rules split the nights.
// LandingPage renders it on cobalt, after the headliner paste-up.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PROGRAMME } from "../lib/content";
import { LABEL, SHEET_PAD, SUB_DISPLAY, WRAP } from "../lib/type-styles";

/** The row of the middle night steps in from 1024px, so the column never reads as a plain list. */
export function ProgrammeSection() {
	const { t } = useT();
	return (
		<section
			id="programme"
			aria-labelledby="programme-title"
			className="sf-cobalt relative overflow-clip"
		>
			<div className={cn(WRAP, SHEET_PAD)}>
				<div data-slab="">
					<p className={LABEL}>{t("programme.label")}</p>
					<h2
						id="programme-title"
						className={cn(SUB_DISPLAY, "mt-5 mb-12 max-w-[12em]")}
					>
						{t("programme.title")}
					</h2>
				</div>
				<ol className="border-current border-b-2">
					{PROGRAMME.map((day, index) => (
						<li
							key={day.id}
							data-slab=""
							className={cn(
								"grid gap-x-10 gap-y-5 border-current border-t-2 py-8 lg:grid-cols-[minmax(10rem,17rem)_1fr_auto] lg:items-baseline lg:py-9",
								// The whole middle row steps in, as a poster pasted a little off the line.
								index % 2 === 1 && "lg:ps-[clamp(0rem,6vw,6rem)]",
							)}
						>
							<div className="flex items-baseline justify-between gap-4 lg:block">
								<h3 className="font-display text-[clamp(2.6rem,6vw,5rem)] uppercase leading-[0.9] tracking-[0.01em]">
									{t(day.dayKey)}
								</h3>
								<p className="font-display text-[1.35rem] tabular-nums leading-none lg:hidden">
									{t(day.hoursKey)}
								</p>
							</div>
							<div>
								<ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
									{day.acts.map((act) => (
										<li
											key={act.nameKey}
											className="grid grid-cols-[3.6rem_1fr] items-baseline gap-x-3"
										>
											<span className="font-display text-[1.15rem] tabular-nums">
												{act.time}
											</span>
											<span>
												<span
													className={cn(
														"block",
														act.isHeadliner
															? "font-display text-[clamp(1.45rem,2.2vw,1.9rem)] uppercase leading-[1.05] tracking-[0.02em]"
															: "font-bold text-[clamp(1.02rem,1.3vw,1.15rem)]",
													)}
												>
													{t(act.nameKey)}
												</span>
												<span className="font-semibold text-[0.74rem] uppercase tracking-[0.08em] opacity-70">
													{t(act.stageKey)}
												</span>
											</span>
										</li>
									))}
								</ul>
								<p className="mt-5 border-current/40 border-t-2 pt-3 font-semibold text-[0.8rem] uppercase tracking-[0.06em]">
									{t(day.noteKey)}
								</p>
							</div>
							<p className="hidden whitespace-nowrap font-display text-[clamp(1.3rem,2vw,1.8rem)] tabular-nums lg:block">
								{t(day.hoursKey)}
							</p>
						</li>
					))}
				</ol>
				<p
					data-slab=""
					className="mt-6 max-w-[34em] text-pretty font-semibold text-[clamp(1rem,1.3vw,1.15rem)]"
				>
					{t("programme.moreNote")}
				</p>
			</div>
		</section>
	);
}
