// The admission section, the one navy band of the page: three numbered steps on a rail that ends on the first day.
// LandingPage renders it after the campus mosaic. useRailProgress fills the rail while the visitor scrolls.
// Without script, or with reduced motion, the rail is full and every disc is sand.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useRailProgress } from "../hooks/use-rail-progress";
import { BUTTON, H2, WRAP } from "../lib/type-styles";
import { ArrowGlyph } from "./arrow-glyph";

/** Horizontal rail from 900px, vertical rail with the discs on the start side below. */
export function AdmissionSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useRailProgress(sectionRef);
	// `at` is the rail progress (0 to 1) where a step turns solid. The flag lands last.
	const steps = [
		{
			number: "1",
			at: 0.06,
			title: t("admission.step1Title"),
			chip: t("admission.step1Chip"),
			body: t("admission.step1Body"),
		},
		{
			number: "2",
			at: 0.37,
			title: t("admission.step2Title"),
			chip: t("admission.step2Chip"),
			body: t("admission.step2Body"),
		},
		{
			number: "3",
			at: 0.67,
			title: t("admission.step3Title"),
			chip: t("admission.step3Chip"),
			body: t("admission.step3Body"),
		},
	];
	return (
		<section
			ref={sectionRef}
			id="admission"
			aria-labelledby="admission-title"
			className="bg-foreground py-[clamp(72px,9vw,128px)] text-background"
		>
			<div className={WRAP}>
				<div
					data-stagger=""
					className="mb-[clamp(38px,4.6vw,62px)] grid items-start gap-[18px] min-[820px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] min-[820px]:items-end min-[820px]:gap-[clamp(20px,3vw,56px)]"
				>
					<div data-pop="" className="min-w-0">
						<span className="mb-3.5 block font-semibold text-(--cn-sky-lift) text-[0.6875rem] uppercase leading-none tracking-[0.15em]">
							{t("admission.eyebrow")}
						</span>
						<h2 id="admission-title" className={H2}>
							{t("admission.title")}
						</h2>
					</div>
					<p
						data-pop=""
						className="max-w-[52ch] text-[clamp(1.02rem,1.15vw,1.14rem)] text-background/75 leading-[1.62]"
					>
						{t("admission.lede")}
					</p>
				</div>

				<div className="relative">
					<div
						aria-hidden="true"
						className="cn-rail-track absolute start-6 top-[27px] bottom-[27px] w-1.5 rounded-full min-[900px]:start-[27px] min-[900px]:end-0 min-[900px]:top-[25px] min-[900px]:bottom-auto min-[900px]:h-1.5 min-[900px]:w-auto"
					>
						<span className="cn-rail-fill absolute inset-0 rounded-full" />
					</div>
					<ol
						aria-label={t("admission.stepsLabel")}
						className="relative grid grid-cols-1 gap-[26px] min-[900px]:grid-cols-[repeat(3,minmax(0,1fr))_auto] min-[900px]:gap-[clamp(18px,2.4vw,34px)]"
					>
						{steps.map((step) => (
							<li
								key={step.number}
								data-at={step.at}
								className="cn-step flex flex-row items-start gap-[18px] min-[900px]:flex-col min-[900px]:gap-3"
							>
								<span className="cn-disc relative z-[1] flex size-[50px] flex-none items-center justify-center rounded-full font-bold font-display text-[1.2rem] tracking-[-0.02em] min-[900px]:size-[54px] min-[900px]:text-[1.3rem]">
									{step.number}
								</span>
								<div className="flex min-w-0 flex-col items-start gap-2.5 pt-0.5 min-[900px]:pt-0">
									<h3 className="font-display font-semibold text-[clamp(1.15rem,1.6vw,1.42rem)] leading-[1.15] tracking-[-0.016em]">
										{step.title}
									</h3>
									<span className="inline-flex rounded-full bg-background/12 px-[15px] py-[7px] font-semibold text-[0.75rem] leading-tight tracking-[0.02em]">
										{step.chip}
									</span>
									<p className="max-w-[38ch] text-[0.9375rem] text-background/75 leading-[1.58]">
										{step.body}
									</p>
								</div>
							</li>
						))}
						<li
							data-at="0.97"
							className="cn-flag-wrap flex self-start ps-[68px] min-[900px]:justify-self-end min-[900px]:ps-0"
						>
							<span className="cn-flag cn-r inline-flex min-h-[54px] flex-col justify-center gap-[5px] px-[18px] py-[13px]">
								<i className="font-semibold text-(--cn-sand-ink) text-[0.625rem] uppercase not-italic leading-none tracking-[0.15em]">
									{t("admission.flagLabel")}
								</i>
								<b className="whitespace-nowrap font-bold font-display text-[1.05rem] tracking-[-0.02em]">
									{t("admission.flagValue")}
								</b>
							</span>
						</li>
					</ol>
				</div>

				<div className="mt-[clamp(34px,4vw,52px)] flex flex-wrap items-center gap-x-[22px] gap-y-3.5 border-background/18 border-t pt-[clamp(22px,2.6vw,30px)]">
					<a href="#enrol" className={`${BUTTON} cn-btn-sand`}>
						{t("admission.cta")}
						<ArrowGlyph />
					</a>
					<p className="max-w-[46ch] text-[0.875rem] text-background/70">
						{t("admission.ctaNote")}
					</p>
				</div>
			</div>
		</section>
	);
}
