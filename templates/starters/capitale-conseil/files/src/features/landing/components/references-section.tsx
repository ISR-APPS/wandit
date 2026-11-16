// Movement 04, "References": the dossier of one mandate. LandingPage renders it after the deep band.
// A 3:4 duotone plate stands beside three numbered beats, a result figure, and a closing row of meta cells.
// The meta row makes the text column end level with the caption of the plate.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CASE_BEATS, MANDATE_FACTS } from "../lib/content";
import { MICRO, MOVEMENT, SECTION_TITLE, SOFT } from "../lib/type-styles";
import { DuotonePlate } from "./duotone-plate";
import { FactCells } from "./fact-cells";
import { SectionLabel } from "./section-label";

/** One case study: context, engagement, outcome, then the amount that the mandate raised. */
export function ReferencesSection() {
	const { t } = useT();
	const facts = MANDATE_FACTS.map((fact) => ({
		term: t(`references.${fact}Label`),
		value: t(`references.${fact}Value`),
	}));
	return (
		<section id="references" data-movement className={MOVEMENT}>
			<div className="cap-wrap">
				<SectionLabel data-reveal className="mb-[1.4rem]">
					{t("references.label")}
				</SectionLabel>
				<div className="grid grid-cols-1 items-start gap-[clamp(1.8rem,4vw,3.2rem)] min-[56.25rem]:grid-cols-[minmax(0,38%)_minmax(0,1fr)]">
					<div data-reveal>
						<DuotonePlate
							src="/images/boardroom.webp"
							alt={t("references.plateAlt")}
							width={1200}
							height={1600}
							isLazy
							isLifted
							frameClassName="aspect-[3/4]"
							captionLine={t("references.plateLine")}
							captionNote={t("references.plateNote")}
						/>
					</div>
					<div>
						<h2 data-reveal className={SECTION_TITLE}>
							{t("references.title")}
						</h2>
						<div
							data-reveal="rule"
							className="mt-[1.6rem] h-px bg-foreground/18"
						/>
						<div data-reveal-group>
							{CASE_BEATS.map((beat, index) => (
								<div
									key={beat}
									data-reveal
									className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-x-4 border-foreground/12 border-b py-5"
								>
									<p className="pt-1 font-semibold text-[0.6875rem] text-primary tabular-nums tracking-[0.1em]">
										{String(index + 1).padStart(2, "0")}
									</p>
									<div>
										<h3 className="mb-1 font-sans font-semibold text-[1.05rem] leading-snug tracking-[0.01em]">
											{t(`references.${beat}Title`)}
										</h3>
										<p className={cn(SOFT, "max-w-[56ch] text-[0.96875rem]")}>
											{t(`references.${beat}Body`)}
										</p>
									</div>
								</div>
							))}
						</div>
						<p data-reveal className="flex items-end gap-[1.1rem] pt-6">
							<span className="whitespace-nowrap font-display text-[clamp(2.6rem,5vw,4rem)] leading-[0.95] tracking-[-0.02em]">
								{t("references.resultValue")}
								<span className="ms-[0.25em] text-[0.42em] text-primary tracking-normal">
									{t("references.resultUnit")}
								</span>
							</span>
							<span className={cn(MICRO, SOFT, "pb-2")}>
								{t("references.resultLabel")}
							</span>
						</p>
						<div data-reveal>
							<FactCells cells={facts} className="mt-[1.6rem]" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
