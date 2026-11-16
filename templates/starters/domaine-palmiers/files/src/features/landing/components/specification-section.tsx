// The specification: one tall photo beside two ledgers of what the price includes.
// LandingPage renders it on the second ground. The header has no link to it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CAPTION, H3, SECTION, WRAP } from "../lib/type-styles";
import { Aperture } from "./aperture";
import { Ledger } from "./ledger";
import { SectionHead } from "./section-head";

/** A split of 4 to 8 from 1024px. Each ledger row puts its key above its value, because the values are long. */
export function SpecificationSection() {
	const { t } = useT();
	return (
		<section
			id="specification"
			aria-labelledby="specification-title"
			className={cn(SECTION, "scroll-mt-16 bg-canvas")}
		>
			<div className={WRAP}>
				<SectionHead
					titleId="specification-title"
					label={t("spec.label")}
					titleLines={[t("spec.titleLine1"), t("spec.titleLine2")]}
					lede={t("spec.lede")}
					className="mb-[clamp(2.2rem,3.6vw,3.4rem)]"
				/>
				<div className="grid gap-[clamp(2.2rem,4vw,4rem)] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-start">
					<div>
						<Aperture
							src="/images/bathroom.webp"
							alt={t("spec.imageAlt")}
							width={1200}
							height={1600}
							className="aspect-[4/5] sm:aspect-[3/2] lg:aspect-[3/4]"
							imageClassName="object-[50%_70%]"
						/>
						<p
							data-reveal="lift"
							className={cn(
								CAPTION,
								"mt-[0.9rem] border-foreground/12 border-t pt-[0.8rem]",
							)}
						>
							{/* The rule is as wide as the photo. Only the text has a measure. */}
							<span className="block max-w-[38ch]">
								{t("spec.imageCaption")}
							</span>
						</p>
					</div>
					<div className="grid gap-[clamp(1.8rem,3vw,3rem)] sm:grid-cols-2">
						<div data-reveal="lift">
							<h3 className={cn(H3, "mb-[1.1rem]")}>
								{t("spec.structureTitle")}
							</h3>
							<Ledger
								layout="stacked"
								rows={[
									{ label: t("spec.shellLabel"), value: t("spec.shellValue") },
									{
										label: t("spec.joineryLabel"),
										value: t("spec.joineryValue"),
									},
									{
										label: t("spec.floorsLabel"),
										value: t("spec.floorsValue"),
									},
									{ label: t("spec.wallsLabel"), value: t("spec.wallsValue") },
									{
										label: t("spec.kitchenLabel"),
										value: t("spec.kitchenValue"),
									},
									{
										label: t("spec.heatingLabel"),
										value: t("spec.heatingValue"),
									},
								]}
							/>
						</div>
						<div data-reveal="lift">
							<h3 className={cn(H3, "mb-[1.1rem]")}>
								{t("spec.groundsTitle")}
							</h3>
							<Ledger
								layout="stacked"
								rows={[
									{ label: t("spec.poolLabel"), value: t("spec.poolValue") },
									{
										label: t("spec.gardenLabel"),
										value: t("spec.gardenValue"),
									},
									{
										label: t("spec.parkingLabel"),
										value: t("spec.parkingValue"),
									},
									{
										label: t("spec.securityLabel"),
										value: t("spec.securityValue"),
									},
									{ label: t("spec.powerLabel"), value: t("spec.powerValue") },
									{ label: t("spec.fibreLabel"), value: t("spec.fibreValue") },
								]}
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
