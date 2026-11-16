// PL·04, the schedule of missions: the services of the studio as the legend table of a drawing.
// LandingPage renders it after the sheets. It reads MISSIONS of lib/content.ts and renders one MissionRow each.
// The head row of the table shows from 860px; on a phone each row reads as a short block.
import { useT } from "~/shared/i18n";
import { MISSIONS } from "../lib/content";
import { LABEL, SECTION } from "../lib/styles";
import { MissionRow } from "./mission-row";
import { SectionHead } from "./section-head";

/** A full-width legend under one ink rule. */
export function MissionsSection() {
	const { t } = useT();
	return (
		<section
			id="missions"
			aria-labelledby="missions-title"
			className={`${SECTION} ns-paper pt-0`}
		>
			<div className="ns-wrap">
				<SectionHead
					folio="missions.folio"
					title="missions.title"
					titleId="missions-title"
				/>
				<div className="border-foreground border-t-[1.5px]">
					<div
						aria-hidden="true"
						className={`${LABEL} hidden grid-cols-[4rem_5.25rem_1.1fr_1.6fr_13rem] gap-x-5 border-foreground/20 border-b py-2.5 font-normal text-[0.5625rem] text-foreground/60 tracking-[0.1em] min-[53.75rem]:grid`}
					>
						<span>{t("missions.headNumber")}</span>
						<span>{t("missions.headSymbol")}</span>
						<span>{t("missions.headDesignation")}</span>
						<span>{t("missions.headContent")}</span>
						<span>{t("missions.headFees")}</span>
					</div>
					{MISSIONS.map((mission) => (
						<MissionRow key={mission.number} mission={mission} />
					))}
				</div>
			</div>
		</section>
	);
}
