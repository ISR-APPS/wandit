// Section 02, the studio: a narrow column with the wordmark and the studio ledger, and a wide column with the statement.
// LandingPage renders it. The texts are in the `studio` message group.
import { useT } from "~/shared/i18n";
import { BAND, MONO, PROSE, SECTION_MARK, WRAP } from "../lib/type-styles";
import { AccentDot } from "./accent-dot";
import { ArrowLink } from "./arrow-link";
import { type Fact, FactsLedger } from "./facts-ledger";
import { SectionHead } from "./section-head";
import { Wordmark } from "./wordmark";

/** The statement split: 4 parts for the ledger, 8 parts for the statement over a two-column body. */
export function StudioSection() {
	const { t } = useT();
	const facts: Fact[] = [
		{ label: t("studio.factFounded"), value: t("studio.factFoundedValue") },
		{ label: t("studio.factTeam"), value: t("studio.factTeamValue") },
		{ label: t("studio.factWorkshop"), value: t("studio.factWorkshopValue") },
		{ label: t("studio.factLanguages"), value: t("studio.factLanguagesValue") },
		{ label: t("studio.factCapacity"), value: t("studio.factCapacityValue") },
	];
	return (
		<section
			id="studio"
			aria-labelledby="studio-title"
			data-cascade=""
			className={BAND}
		>
			<div className={WRAP}>
				<SectionHead label={t("studio.label")} />
				<div className="grid items-start gap-[clamp(28px,5vw,90px)] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
					<div>
						<p className={SECTION_MARK}>
							<Wordmark />
						</p>
						<FactsLedger facts={facts} />
						<p
							className={`${MONO} sable-fade mt-5 max-w-[38ch] text-foreground/55 leading-[1.62]`}
						>
							{t("studio.note")}
						</p>
					</div>
					<div>
						<h2
							id="studio-title"
							className="sable-fade max-w-[24ch] font-display font-medium text-[clamp(1.5rem,2.6vw,2.3rem)] leading-[1.16] tracking-[-0.03em]"
						>
							{t("studio.statement")}
							<AccentDot />
						</h2>
						<div className="mt-[clamp(18px,2.6vh,30px)] grid gap-4 min-[861px]:grid-cols-2 min-[861px]:gap-[clamp(20px,3vw,48px)]">
							<p className={`${PROSE} sable-fade max-w-[62ch]`}>
								{t("studio.bodySteps")}
							</p>
							<p className={`${PROSE} sable-fade max-w-[62ch]`}>
								{t("studio.bodyRules")}
							</p>
						</div>
						<ArrowLink
							href="#services"
							label={t("studio.link")}
							className="sable-fade mt-3"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
