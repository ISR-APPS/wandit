// The villas section: the three villa types in an asymmetric grid of 12 columns.
// LandingPage renders it on the first ground. Its id "villas" is the target of the header link.
// The lead card is 7 columns wide and sits 4.6rem lower. The portrait card is 5 wide. The last card is a full band.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { SECTION, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";
import { VillaLot } from "./villa-lot";

/** Each card states a surface, a bedroom count, a view, a reference, and a price or "on request". */
export function VillasSection() {
	const { t } = useT();
	return (
		<section
			id="villas"
			aria-labelledby="villas-title"
			className={cn(SECTION, "scroll-mt-16")}
		>
			<div className={WRAP}>
				<SectionHead
					titleId="villas-title"
					label={t("villas.label")}
					titleLines={[t("villas.titleLine1"), t("villas.titleLine2")]}
					lede={t("villas.lede")}
					className="mb-[clamp(2.8rem,4vw,4rem)]"
				/>
				<div className="grid gap-x-[clamp(1.6rem,2.6vw,2.6rem)] gap-y-[clamp(3.4rem,4.4vw,4.4rem)] lg:grid-cols-12">
					<VillaLot
						name={t("villas.pinName")}
						text={t("villas.pinText")}
						image={{
							src: "/images/living-room.webp",
							alt: t("villas.pinAlt"),
							width: 1600,
							height: 900,
						}}
						plate={{
							label: t("villas.fromLabel"),
							value: t("villas.pinPrice"),
						}}
						plateCorner="start"
						cells={[
							{
								label: t("villas.surfaceLabel"),
								value: t("villas.pinSurface"),
							},
							{
								label: t("villas.bedroomsLabel"),
								value: t("villas.pinBedrooms"),
							},
							{ label: t("villas.viewLabel"), value: t("villas.pinView") },
							{ label: t("villas.refLabel"), value: t("villas.pinRef") },
						]}
						className="lg:col-span-7 lg:mt-[4.6rem]"
						frameClassName="aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/3]"
					/>
					<VillaLot
						name={t("villas.cypresName")}
						text={t("villas.cypresText")}
						image={{
							src: "/images/bedroom.webp",
							alt: t("villas.cypresAlt"),
							width: 1200,
							height: 1600,
						}}
						plate={{
							label: t("villas.fromLabel"),
							value: t("villas.cypresPrice"),
						}}
						plateCorner="end"
						cells={[
							{
								label: t("villas.surfaceLabel"),
								value: t("villas.cypresSurface"),
							},
							{
								label: t("villas.bedroomsLabel"),
								value: t("villas.cypresBedrooms"),
							},
							{ label: t("villas.viewLabel"), value: t("villas.cypresView") },
							{ label: t("villas.refLabel"), value: t("villas.cypresRef") },
						]}
						className="lg:col-span-5"
						frameClassName="aspect-[4/5] sm:aspect-[16/11] lg:aspect-[3/4]"
					/>
					<VillaLot
						name={t("villas.palmierName")}
						text={t("villas.palmierText")}
						image={{
							src: "/images/villa-facade.webp",
							alt: t("villas.palmierAlt"),
							width: 1600,
							height: 900,
						}}
						plate={{
							label: t("villas.palmierPlateLabel"),
							value: t("villas.palmierPrice"),
						}}
						plateCorner="start"
						cells={[
							{
								label: t("villas.surfaceLabel"),
								value: t("villas.palmierSurface"),
							},
							{
								label: t("villas.bedroomsLabel"),
								value: t("villas.palmierBedrooms"),
							},
							{ label: t("villas.viewLabel"), value: t("villas.palmierView") },
							{ label: t("villas.refLabel"), value: t("villas.palmierRef") },
						]}
						className="lg:col-span-12"
						frameClassName="aspect-[4/5] sm:aspect-[4/3] lg:aspect-[21/9]"
						// The hero shows the same facade, centred. This crop moves to the terrace and the pool.
						imageClassName="object-[72%_50%] lg:object-[50%_100%]"
						isBand
					/>
				</div>
			</div>
		</section>
	);
}
