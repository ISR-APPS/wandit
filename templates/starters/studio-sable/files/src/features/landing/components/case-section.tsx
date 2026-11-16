// Section 03, the case study: row 01 of the index opens into a band with its cover, its story, and its ledger.
// LandingPage renders it. From 1200px the band opens with the scroll (use-case-scrub.ts and landing.css).
// Below 1200px, with reduced motion, and with no script, the band is open.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useCaseScrub } from "../hooks/use-case-scrub";
import { CASE_PROJECT, PROJECTS } from "../lib/projects";
import {
	LEDGER_LABEL,
	MONO,
	MONO_LABEL,
	PROSE,
	ROW_NAME,
	RULED_LINK,
	RULED_LINK_TEXT,
	SQUARE,
	WRAP,
} from "../lib/type-styles";
import { type Fact, FactsLedger } from "./facts-ledger";
import { Plate } from "./plate";
import { SectionHead } from "./section-head";

/** The showpiece of the page. The other rows wait under the open row as compact rows, then leave. */
export function CaseSection() {
	const { t } = useT();
	const stageRef = useRef<HTMLDivElement>(null);
	useCaseScrub(stageRef);
	const deliverables = [
		t("case.deliverableGuidelines"),
		t("case.deliverableTemplate"),
		t("case.deliverableLabels"),
		t("case.deliverableSheet"),
	];
	const facts: Fact[] = [
		{ label: t("case.factYear"), value: CASE_PROJECT.year },
		{ label: t("case.factRole"), value: t("case.factRoleValue") },
		{ label: t("case.factScope"), value: t("case.factScopeValue") },
		{ label: t("case.factTeam"), value: t("case.factTeamValue") },
		{ label: t("case.factDuration"), value: t("case.factDurationValue") },
	];
	return (
		<section
			id="case"
			aria-labelledby="case-title"
			data-cascade=""
			className="py-[clamp(2.6rem,5vh,4.2rem)]"
		>
			<div className={WRAP}>
				<SectionHead label={t("case.label")}>
					{/* The hint is true only where the band opens with the scroll. */}
					<p
						className={`${MONO_LABEL} sable-fade hidden whitespace-nowrap motion-safe:min-[1200px]:block`}
					>
						{t("case.hint")}
					</p>
				</SectionHead>
				<div ref={stageRef} className="sable-case-stage">
					<div className="sable-case-head">
						<span className="sable-mono text-[12px] text-foreground/30">
							{CASE_PROJECT.number}
						</span>
						<h2 id="case-title" className={ROW_NAME}>
							{t(`projects.${CASE_PROJECT.id}.name`)}
						</h2>
						<span className={`${MONO} text-foreground/80`}>
							{t(`projects.${CASE_PROJECT.id}.sector`)}
						</span>
						<span className={`${MONO} text-foreground/55`}>
							{CASE_PROJECT.year}
						</span>
						<span
							aria-hidden="true"
							className="sable-case-arrow text-[19px] text-primary leading-none"
						>
							↓
						</span>
					</div>
					<div className="sable-case-body">
						<div className="sable-case-band pt-[clamp(22px,3.4vh,36px)]">
							<div className="grid items-start gap-[26px] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-[clamp(24px,4vw,64px)]">
								<div>
									<Plate
										project={CASE_PROJECT}
										aspectClassName="sable-case-cover aspect-[16/10] lg:max-h-[38vh]"
									/>
									<p className={`${LEDGER_LABEL} sable-fade mt-[9px]`}>
										{t("case.caption")}
									</p>
									<ul
										className={`${MONO} sable-fade mt-[18px] flex flex-wrap gap-x-[22px] gap-y-2.5 text-foreground/80 [--sable-step:1]`}
									>
										{deliverables.map((deliverable) => (
											<li
												key={deliverable}
												className="flex items-center gap-[9px]"
											>
												<span
													aria-hidden="true"
													className={`${SQUARE} bg-primary`}
												/>
												{deliverable}
											</li>
										))}
									</ul>
								</div>
								<div>
									<p className="sable-fade max-w-[40ch] text-[clamp(1.12rem,1.6vw,1.34rem)] leading-[1.4] tracking-[-0.015em] [--sable-step:2]">
										{t("case.lead")}
									</p>
									<p
										className={`${PROSE} sable-fade mt-3.5 max-w-[52ch] leading-[1.55] [--sable-step:3]`}
									>
										{t("case.text")}
									</p>
									{/* The wrapper fades with the first row, so the ink rule of the ledger does not show before its rows. */}
									<div className="sable-fade mt-[clamp(18px,2.4vh,26px)] [--sable-step:4]">
										<FactsLedger facts={facts} isCompact />
									</div>
								</div>
							</div>
						</div>
						<div aria-hidden="true" className="sable-case-ghosts">
							{PROJECTS.filter((project) => project.id !== CASE_PROJECT.id).map(
								(project) => (
									<div
										key={project.id}
										className="sable-ghost-row sable-mono text-[12px] text-foreground/55"
									>
										<span>{project.number}</span>
										<span className="font-display font-medium text-[clamp(1.05rem,1.5vw,1.35rem)] text-foreground/80 tracking-[-0.02em]">
											{t(`projects.${project.id}.name`)}
										</span>
										<span>{t(`projects.${project.id}.role`)}</span>
										<span>{project.year}</span>
										<span />
									</div>
								),
							)}
						</div>
					</div>
				</div>
				<p
					className={`${MONO} sable-fade mt-[18px] flex flex-wrap items-center justify-between gap-x-4 border-foreground/14 border-t pt-1 text-foreground/55`}
				>
					<span>{t("case.footIndex")}</span>
					<a href="#wall" className={RULED_LINK}>
						<span className={RULED_LINK_TEXT}>
							{t("case.footLink")} <span aria-hidden="true">↓</span>
						</span>
					</a>
				</p>
			</div>
		</section>
	);
}
