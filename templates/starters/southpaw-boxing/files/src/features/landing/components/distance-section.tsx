// Round 5, "Go the Distance": the twelve-week on-ramp as a scored fight, with four phases and four results.
// landing-page.tsx renders it. It reads DISTANCE_PHASES and DISTANCE_STATS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { DISTANCE_PHASES, DISTANCE_STATS } from "../lib/content";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";
import { RoundStrip } from "./round-strip";
import { StatFigure } from "./stat-figure";

/** Each phase column sits under its three pips, so the strip and the phases read as one chart. */
export function DistanceSection() {
	const { t } = useT();
	return (
		<section
			id="rounds"
			aria-labelledby="rounds-title"
			className="sp-gutter py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={5}
					layout="flip"
					titleId="rounds-title"
					kickerStart={t("distance.kickerStart")}
					kickerEnd={t("distance.kickerEnd")}
					titleStart={t("distance.titleStart")}
					titleAccent={t("distance.titleAccent")}
					sub={t("distance.sub")}
				/>
				<RoundStrip />
				<div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 md:grid-cols-4">
					{DISTANCE_PHASES.map((phase, index) => (
						<Reveal
							key={phase.title}
							as="article"
							delayMs={index * 90}
							className="sp-phase pt-4"
						>
							<p className="sp-faint font-bold text-[0.64rem] uppercase tracking-[0.28em]">
								{t(phase.range)}
							</p>
							<h3 className="mt-2 mb-2.5 font-display font-extrabold text-[2rem] uppercase leading-none">
								{t(phase.title)}
							</h3>
							<p className="text-[0.95rem] text-muted-foreground leading-relaxed">
								{t(phase.body)}
							</p>
						</Reveal>
					))}
				</div>
				<Reveal className="sp-line-strong mt-10 grid gap-x-10 gap-y-5 border border-dashed px-6 py-6 sm:grid-cols-2 md:px-8 xl:flex xl:justify-between">
					{DISTANCE_STATS.map((stat) => (
						<StatFigure key={stat.label} stat={stat} />
					))}
				</Reveal>
			</div>
		</section>
	);
}
