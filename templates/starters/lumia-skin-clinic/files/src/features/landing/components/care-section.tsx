// The treatments: three cards in an asymmetric 7 + 5 grid, with a wide third card that sets its photo beside the text.
// LandingPage renders it on the deeper cream. Prices are stated plainly in dinars, as care and not as offers.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PHOTOS } from "../lib/photos";
import { GUTTER, SECTION_TITLE, SECTION_Y, WRAP } from "../lib/type-styles";
import { CapsuleBadge } from "./capsule-badge";
import { CareCard } from "./care-card";

/** The <section id="care"> that the header link "Treatments" opens. */
export function CareSection() {
	const { t } = useT();
	return (
		<section
			id="care"
			aria-labelledby="care-title"
			className={cn("scroll-mt-4 bg-(--lumia-cream-deep)", GUTTER, SECTION_Y)}
		>
			<div className={WRAP}>
				<div
					data-reveal=""
					className="mb-[clamp(2.5rem,5vw,4.5rem)] grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-end"
				>
					<div className="grid max-w-[760px] gap-[1.1rem]">
						<CapsuleBadge tone="cream">{t("care.badge")}</CapsuleBadge>
						<h2 id="care-title" className={SECTION_TITLE}>
							{t("care.title")}
						</h2>
					</div>
					<p className="text-pretty text-(--lumia-ink-soft) text-[16px] md:pb-2">
						{t("care.intro")}
					</p>
				</div>
				<div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12 md:gap-[clamp(1rem,2vw,1.5rem)]">
					<CareCard
						layout="stacked"
						photo={PHOTOS.facial}
						alt={t("care.facialAlt")}
						badge={t("care.facialBadge")}
						title={t("care.facialTitle")}
						body={t("care.facialBody")}
						price={t("care.facialPrice")}
						duration={t("care.facialDuration")}
						className="md:col-span-6 lg:col-[1/span_7]"
						maskHeightClassName="md:h-[clamp(240px,30vw,355px)]"
						imageClassName="object-[center_48%]"
					/>
					<CareCard
						layout="stacked"
						photo={PHOTOS.serum}
						alt={t("care.serumAlt")}
						badge={t("care.serumBadge")}
						title={t("care.serumTitle")}
						body={t("care.serumBody")}
						price={t("care.serumPrice")}
						duration={t("care.serumDuration")}
						className="[--lumia-reveal-delay:150ms] md:col-span-6 md:mt-14 lg:col-[8/-1] lg:mt-[clamp(2.5rem,7vw,5rem)]"
						maskHeightClassName="md:h-[clamp(220px,25vw,310px)]"
						imageClassName="object-[center_55%]"
					/>
					<CareCard
						layout="split"
						photo={PHOTOS.hands}
						alt={t("care.consultAlt")}
						badge={t("care.consultBadge")}
						title={t("care.consultTitle")}
						body={t("care.consultBody")}
						price={t("care.consultPrice")}
						duration={t("care.consultDuration")}
						className="md:col-[2/span_10] lg:col-[3/span_8] lg:mt-[clamp(0.5rem,2vw,1.5rem)]"
					/>
				</div>
			</div>
		</section>
	);
}
