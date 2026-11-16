// The hero: the poster pasted this morning. The festival name and the dates are fitted to the full width.
// LandingPage renders it first, on cream. The cobalt lineup band closes the first screen.
// On a phone the date line splits in two fitted lines, so the type fills the narrow sheet.
// The h1 slides in as one slab: a line that changes its display would restart its own animation.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BUTTON, GUTTER, LINK } from "../lib/type-styles";
import { FittedLine } from "./fitted-line";
import { LineupBand } from "./lineup-band";

/** Fit shares of the hero lines, measured for Anton caps. */
const FIT = { name: 0.3735, dates: 0.0997, days: 0.1842, city: 0.2432 };

/**
 * The full first screen from 768px, but never taller than 75vw, the height of its type.
 * On a phone it takes its content height, so the next sheet shows.
 */
export function HeroSection() {
	const { t } = useT();
	return (
		<section
			id="top"
			aria-label={t("hero.label")}
			className="sf-cream relative flex flex-col overflow-clip md:min-h-[min(100svh,75vw)]"
		>
			<div className="flex flex-1 flex-col justify-end pt-[clamp(4.75rem,12vh,7rem)]">
				<h1 className="sf-hero-line">
					<FittedLine text={t("site.brand")} fit={FIT.name} />
					<FittedLine
						text={t("hero.dates")}
						fit={FIT.dates}
						className="mt-[1.1vw] hidden md:block"
					/>
					<FittedLine
						text={t("hero.datesDays")}
						fit={FIT.days}
						className="mt-2 md:hidden"
					/>
					<FittedLine
						text={t("hero.datesCity")}
						fit={FIT.city}
						className="mt-2 md:hidden"
					/>
				</h1>
			</div>
			<div
				className={cn(
					GUTTER,
					"flex flex-wrap items-end justify-between gap-x-12 gap-y-6 pt-7 pb-9 md:pt-[clamp(1.1rem,2.4vh,1.8rem)] md:pb-[clamp(1.4rem,3vh,2.2rem)]",
				)}
			>
				<p className="sf-hero-line max-w-[32em] text-[clamp(1.02rem,1.3vw,1.2rem)] [--sf-i:1]">
					{t("hero.lede")}
				</p>
				<div className="sf-hero-line flex flex-wrap items-center gap-x-6 gap-y-4 [--sf-i:2]">
					<a href="#tickets" className={BUTTON}>
						{t("hero.cta")}
					</a>
					<a
						href="#programme"
						className={cn(LINK, "inline-flex min-h-11 items-center")}
					>
						{t("hero.programmeLink")}
					</a>
				</div>
			</div>
			<LineupBand />
		</section>
	);
}
