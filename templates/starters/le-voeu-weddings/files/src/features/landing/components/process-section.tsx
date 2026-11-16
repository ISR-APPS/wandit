// The process: a sticky side column against three stages on leader dots.
// LandingPage renders it after the evening band. The side column ends on the honest limit of the studio and a ghost button.
// Each stage row reads like an order of service: numeral, title, dotted gold rule, duration.
import { type TranslationKey, useT } from "~/shared/i18n";
import { revealDelay } from "../lib/reveal-delay";
import {
	BODY,
	BUTTON_GHOST,
	H2,
	LABEL,
	SECTION,
	WRAP,
} from "../lib/type-styles";

/** One stage: its numeral and the keys of its title, its duration, and its text. */
type ProcessStage = {
	/** Two-digit numeral, set in the display face. */
	numeral: string;
	titleKey: TranslationKey;
	metaKey: TranslationKey;
	bodyKey: TranslationKey;
};

/** The three stages, in time order. */
const PROCESS_STAGES: readonly ProcessStage[] = [
	{
		numeral: "01",
		titleKey: "process.meetingTitle",
		metaKey: "process.meetingMeta",
		bodyKey: "process.meetingBody",
	},
	{
		numeral: "02",
		titleKey: "process.designTitle",
		metaKey: "process.designMeta",
		bodyKey: "process.designBody",
	},
	{
		numeral: "03",
		titleKey: "process.dayTitle",
		metaKey: "process.dayMeta",
		bodyKey: "process.dayBody",
	},
];

/** The section: 0.36fr of side column and 0.64fr of stages. The side column sticks from 900px. */
export function ProcessSection() {
	const { t } = useT();
	return (
		<section id="process" aria-labelledby="process-title" className={SECTION}>
			<div
				className={`${WRAP} grid items-start gap-[30px] min-[1080px]:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] min-[900px]:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] min-[900px]:gap-[clamp(30px,5vw,80px)]`}
			>
				<div
					data-reveal="lift"
					className="min-[900px]:sticky min-[900px]:top-[clamp(24px,7vh,72px)]"
				>
					<p className={LABEL}>{t("process.label")}</p>
					<h2 id="process-title" className={`${H2} mt-5`}>
						<span className="block">{t("process.titleLine1")}</span>
						<span className="block">{t("process.titleLine2")}</span>
					</h2>
					<p className={`${BODY} mt-[22px]`}>{t("process.intro")}</p>
					<p className="mt-[30px] border-(--voeu-gold-soft) border-t pt-[22px] font-display text-[clamp(1.15rem,1.6vw,1.4rem)] leading-[1.32]">
						<span className="block">{t("process.limitLine1")}</span>
						<span className="block">{t("process.limitLine2")}</span>
					</p>
					<a href="#reply" className={`${BUTTON_GHOST} mt-[26px]`}>
						{t("process.cta")}
					</a>
				</div>
				<ol className="border-(--voeu-gold-soft) border-t">
					{PROCESS_STAGES.map((stage, index) => (
						<li
							key={stage.numeral}
							data-reveal="lift"
							style={revealDelay(index)}
							className="border-(--voeu-hair) border-b py-[clamp(24px,2.6vw,34px)]"
						>
							<div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-2">
								<span className="flex-none font-display text-(--voeu-rose-deep) text-[1rem] tracking-[0.04em]">
									{stage.numeral}
								</span>
								<h3 className="flex-none font-display font-normal text-[clamp(1.5rem,2.4vw,2.1rem)] leading-[1.1]">
									{t(stage.titleKey)}
								</h3>
								<span
									aria-hidden="true"
									className="voeu-leader max-sm:hidden"
								/>
								<span className="flex-none font-bold text-[10.5px] text-foreground/68 uppercase tracking-[0.15em] max-sm:basis-full max-sm:ps-[calc(1rem+14px)]">
									{t(stage.metaKey)}
								</span>
							</div>
							<p className={`${BODY} mt-3`}>{t(stage.bodyKey)}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
