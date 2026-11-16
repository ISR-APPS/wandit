// The first section of the home page: an ivory band with the headline, then the first photo across the page.
// LandingPage renders it. The headline never sits on the photo: this is the rule of the DOMAINE world.
// The photo carries a price plate on its top corner and a reference strip on its bottom edge.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	BUTTON,
	H1,
	LEDE,
	RULE_LABEL,
	TEXT_LINK,
	TEXT_LINK_RULE,
	WRAP,
} from "../lib/type-styles";
import { Aperture } from "./aperture";
import { PricePlate } from "./price-plate";
import { ReferenceStrip } from "./reference-strip";

/** The headline band rises at page load with CSS only. The photo is 66% of the screen height at most on a phone, 62% from 768px. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section aria-labelledby="hero-title">
			<div
				className={cn(
					WRAP,
					"grid gap-[clamp(1.4rem,2.6vw,2.6rem)] pt-[clamp(2.6rem,5vw,5rem)] pb-[clamp(2.4rem,3.4vw,3.2rem)] lg:grid-cols-[minmax(0,15fr)_minmax(0,9fr)] lg:items-end lg:gap-x-[clamp(2rem,4vw,4.5rem)]",
				)}
			>
				<p className={cn(RULE_LABEL, "dlp-enter lg:col-span-2")}>
					{t("hero.label")}
				</p>
				<h1 id="hero-title" className={cn(H1, "dlp-enter dlp-enter-2")}>
					<span className="block">{t("hero.titleLine1")}</span>
					<span className="block">{t("hero.titleLine2")}</span>
					<span className="block">{t("hero.titleLine3")}</span>
				</h1>
				<div className="flex flex-col items-start gap-6 lg:pb-2">
					<p className={cn(LEDE, "dlp-enter dlp-enter-3")}>{t("hero.lede")}</p>
					<div className="dlp-enter dlp-enter-4 flex flex-wrap items-center gap-x-6 gap-y-3">
						<a href="#contact" className={BUTTON}>
							{t("hero.ctaVisit")}
						</a>
						<a href="#lots" className={TEXT_LINK}>
							<span className={TEXT_LINK_RULE}>{t("hero.ctaLots")}</span>
						</a>
					</div>
				</div>
			</div>
			<Aperture
				src="/images/villa-facade.webp"
				alt={t("hero.imageAlt")}
				width={1600}
				height={900}
				isEager
				className="dlp-enter-photo aspect-[4/5] max-h-[66vh] border-x-0 md:aspect-video md:max-h-[62vh]"
			>
				{/* The plate sits in the page column, so its edge is on the edge of the text above. */}
				<div className="pointer-events-none absolute inset-x-0 top-0 z-3">
					<div className={cn(WRAP, "relative")}>
						{/* The plate gives the entry price of the estate: the price of Villa Pin, the smallest type. */}
						<PricePlate
							label={t("hero.plateLabel")}
							value={t("villas.pinPrice")}
							corner="end"
							className="dlp-enter dlp-enter-4 pointer-events-auto end-(--dlp-pad)"
						/>
					</div>
				</div>
				<ReferenceStrip
					isBleed
					cells={[
						{
							label: t("hero.stripSurfaceLabel"),
							value: t("hero.stripSurfaceValue"),
						},
						{
							label: t("hero.stripBedroomsLabel"),
							value: t("hero.stripBedroomsValue"),
						},
						{
							label: t("hero.stripViewLabel"),
							value: t("hero.stripViewValue"),
						},
						{
							label: t("hero.stripRefLabel"),
							value: t("hero.stripRefValue"),
						},
					]}
				/>
			</Aperture>
		</section>
	);
}
