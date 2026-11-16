// Round 3, "The Corner Men": the three coaches as fighter cards with records.
// landing-page.tsx renders it. It reads COACH_IDS of lib/content.ts.
import { useT } from "~/shared/i18n";
import { COACH_IDS } from "../lib/content";
import { CoachCard } from "./coach-card";
import { Reveal } from "./reveal";
import { RoundHeader } from "./round-header";

/** The coach cards share one row on desktop and stack in one column below 1024px. */
export function CornerSection() {
	const { t } = useT();
	return (
		<section
			id="corner"
			aria-labelledby="corner-title"
			className="sp-gutter py-14 md:py-20"
		>
			<div className="mx-auto max-w-7xl">
				<RoundHeader
					round={3}
					layout="flip"
					titleId="corner-title"
					kickerStart={t("corner.kicker")}
					titleStart={t("corner.titleStart")}
					titleAccent={t("corner.titleAccent")}
					sub={t("corner.sub")}
				/>
				<div className="mx-auto grid max-w-xl gap-6 lg:max-w-none lg:grid-cols-3">
					{COACH_IDS.map((coach, index) => (
						<Reveal key={coach} as="article" delayMs={index * 90}>
							<CoachCard coach={coach} />
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}
