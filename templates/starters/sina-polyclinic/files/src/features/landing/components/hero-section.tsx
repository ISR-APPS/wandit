// The first screen: the promise of the clinic, two actions, three facts, and the corridor photo.
// LandingPage renders it. The photo leaves the container and reaches the end edge of the screen from 900px.
// Its entrances are CSS animations of landing.css, so they also run with no script.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BOOKING_HREF } from "../lib/content";
import {
	BUTTON_FILLED,
	BUTTON_GHOST,
	LABEL,
	LEDE,
	WRAP,
} from "../lib/type-styles";
import { PhotoPlate } from "./photo-plate";
import { VitalsLine } from "./vitals-line";

// The three facts of the strip under the actions: the label key and the value key of each cell.
const META_CELLS = [
	{ label: "hero.openingLabel", value: "hero.openingValue" },
	{ label: "hero.insuranceLabel", value: "hero.insuranceValue" },
	{ label: "hero.resultsLabel", value: "hero.resultsValue" },
] as const;

/**
 * The text column pays the 26px of the photo caption as bottom padding.
 * So the bottom rule of the fact strip lands on the foot of the photo.
 */
export function HeroSection() {
	const { t } = useT();
	return (
		<section className="pt-[clamp(40px,5vw,72px)]">
			<div
				className={cn(
					WRAP,
					"grid gap-8 min-[56.25rem]:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] min-[56.25rem]:gap-[clamp(28px,4vw,56px)]",
				)}
			>
				<div className="flex flex-col min-[56.25rem]:pb-6.5">
					<p
						className={cn(
							LABEL,
							"sp-rise text-(--sp-teal-deep) leading-normal",
						)}
					>
						{t("hero.label")}
					</p>
					<h1 className="sp-rise mt-4.5 mb-5.5 max-w-[18ch] text-balance font-display font-normal text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.04] tracking-[-0.022em] [--sp-rise-delay:75ms] min-[56.25rem]:max-w-[12ch]">
						{t("hero.titleStart")}{" "}
						<span className="text-primary">{t("hero.titleAccent")}</span>
						{t("hero.titleEnd")}
					</h1>
					<p className={cn(LEDE, "sp-rise [--sp-rise-delay:150ms]")}>
						{t("hero.lede")}
					</p>
					<div className="sp-rise mt-7.5 flex flex-wrap gap-3 [--sp-rise-delay:225ms]">
						<a href={BOOKING_HREF} className={cn(BUTTON_FILLED, "sp-pulse")}>
							{t("site.book")}
						</a>
						<a href="#specialties" className={BUTTON_GHOST}>
							{t("hero.ctaSecondary")}
						</a>
					</div>
					{/* mt-auto pins the strip to the foot of the column. The top padding keeps a gap under the actions. */}
					<div className="sp-rise pt-[clamp(30px,4vw,44px)] [--sp-rise-delay:300ms] min-[56.25rem]:mt-auto">
						<dl className="grid border-border border-y md:grid-cols-3">
							{META_CELLS.map((cell, index) => (
								<div
									key={cell.label}
									className={cn(
										"py-3.5 md:py-4 md:pe-4.5",
										index > 0 &&
											"border-border/70 border-t md:border-border md:border-s md:border-t-0 md:ps-4.5",
									)}
								>
									<dt
										className={cn(
											LABEL,
											"mb-1.5 text-muted-foreground tracking-[0.14em]",
										)}
									>
										{t(cell.label)}
									</dt>
									<dd className="text-pretty text-[0.9375rem] leading-[1.4]">
										{t(cell.value)}
									</dd>
								</div>
							))}
						</dl>
					</div>
				</div>
				<PhotoPlate
					src="/images/corridor.webp"
					alt={t("hero.photoAlt")}
					width={1440}
					height={1920}
					caption={t("hero.photoCaption")}
					isEager
					className="sp-rise [--sp-rise-delay:180ms] [--sp-rise-time:850ms] min-[56.25rem]:me-(--sp-bleed)"
					// From 900px to 1079px the text column is narrow and short, so the photo is shorter too.
					frameClassName="aspect-4/3 md:aspect-16/11 min-[56.25rem]:aspect-auto min-[56.25rem]:h-[min(60vh,540px)] min-[56.25rem]:min-h-90 min-[67.5rem]:h-[min(68vh,660px)] min-[56.25rem]:rounded-e-none min-[56.25rem]:border-e-0"
					// From 900px the image is 136% of the frame width. The frame cuts the empty wall at its end side.
					imageClassName="object-[50%_52%] min-[56.25rem]:w-[136%] min-[56.25rem]:max-w-none min-[56.25rem]:object-[50%_46%]"
				/>
			</div>
			<VitalsLine
				entrance="load"
				className="mt-[clamp(38px,5vw,64px)] text-primary opacity-85"
			/>
		</section>
	);
}
