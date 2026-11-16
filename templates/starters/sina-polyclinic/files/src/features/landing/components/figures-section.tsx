// The counted band: the one deep band of the page. A vitals line draws across it while the visitor scrolls.
// LandingPage renders it. Each of the four beats of the line lands one fact of the front desk register.
// use-beat-progress.ts gives the scroll progress. The server page shows the band complete.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useBeatProgress } from "../hooks/use-beat-progress";
import { COUNTED_FIGURES } from "../lib/content";
import { SECTION_TITLE, WRAP } from "../lib/type-styles";
import { CountedFact } from "./counted-fact";
import { SectionLabel } from "./section-label";

// One beat, 300 units wide, with a tall QRS spike. Four beats fill the 1200 units of the drawing.
const BEAT =
	"h110 l12 -5 l12 5 h22 l7 5 l8 -62 l8 74 l7 -17 h26 l16 -11 l16 11 h56";
const TRACE_PATH = `M0 70 ${Array.from({ length: COUNTED_FIGURES.length }, () => BEAT).join(" ")}`;
// The spike of a beat is 171 units after the start of the beat: 0.1425 of the drawing width for the first one.
const SPIKE_SHARE = 171 / 1200;
const BEAT_SHARE = 1 / COUNTED_FIGURES.length;
// The trace is complete at 85% of the scroll, so the last fact lands before the band leaves the screen.
const DRAW_END = 0.85;
// A fact lands while the trace moves 10% of its width past the spike.
const LANDING_SHARE = 0.1;

/** The section with the id "figures". The facts are final in the HTML, and the scroll only replays them one time. */
export function FiguresSection() {
	const { t } = useT();
	const bandRef = useRef<HTMLElement>(null);
	const progress = useBeatProgress(bandRef);
	const drawnShare = Math.min(1, progress / DRAW_END);
	return (
		<section
			ref={bandRef}
			id="figures"
			aria-labelledby="figures-title"
			className="sp-deep overflow-hidden"
		>
			<div className={cn(WRAP, "py-[clamp(3.4rem,6vw,5rem)]")}>
				<SectionLabel tone="deep">{t("figures.label")}</SectionLabel>
				<div className="grid gap-5 min-[56.25rem]:grid-cols-[1.1fr_0.9fr] min-[56.25rem]:items-end min-[56.25rem]:gap-[clamp(20px,4vw,60px)]">
					<h2
						id="figures-title"
						className={cn(
							SECTION_TITLE,
							"max-w-[22ch] min-[56.25rem]:max-w-[24ch]",
						)}
					>
						{t("figures.title")}
					</h2>
					<p className="max-w-[40ch] text-[0.9375rem] text-background/65 leading-[1.7]">
						{t("figures.body")}
					</p>
				</div>
				<svg
					viewBox="0 0 1200 140"
					preserveAspectRatio="none"
					aria-hidden="true"
					className="sp-ecg mt-[clamp(20px,2.6vw,34px)] block h-[clamp(96px,12vw,150px)] w-full text-(--sp-teal-lift)"
					// The clip hides the part of the trace that the scroll did not reach yet.
					style={{ clipPath: `inset(0 ${(1 - drawnShare) * 100}% 0 0)` }}
				>
					<path d={TRACE_PATH} strokeWidth="2" />
				</svg>
				<dl className="grid grid-cols-2 border-background/20 border-t min-[56.25rem]:grid-cols-4">
					{COUNTED_FIGURES.map((fact, index) => {
						const spikeAt = SPIKE_SHARE + index * BEAT_SHARE;
						const landedShare = Math.min(
							1,
							Math.max(0, (drawnShare - spikeAt) / LANDING_SHARE),
						);
						return (
							<CountedFact
								key={fact.id}
								fact={fact}
								index={index}
								landedShare={landedShare}
							/>
						);
					})}
				</dl>
				<p className="mt-[clamp(22px,3vw,34px)] flex flex-wrap justify-between gap-x-6 gap-y-2 border-background/20 border-t pt-4 text-background/60 text-xs uppercase tracking-[0.06em]">
					<span className="text-pretty">{t("figures.footSource")}</span>
					<span>{t("figures.footAccess")}</span>
				</p>
			</div>
		</section>
	);
}
