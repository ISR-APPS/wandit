// The selvedge band of the hero: a cobalt strip that carries one line, the lineup of the year.
// HeroSection renders it as the last row of the first screen.
// Under 1024px the line is wider than the screen, so it runs as a slow loop (landing.css, sf-band).
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { GUTTER } from "../lib/type-styles";

/** One line of display caps. The second copy only fills the loop, so screen readers skip it. */
export function LineupBand() {
	const { t } = useT();
	const lineClass =
		"shrink-0 whitespace-nowrap pe-[clamp(2rem,5vw,4rem)] font-display text-[clamp(1.1rem,1.75vw,1.5rem)] uppercase leading-none tracking-[0.04em]";
	return (
		<div
			className={cn(
				GUTTER,
				"sf-cobalt sf-hero-band flex h-[clamp(3.6rem,8vh,5.2rem)] items-center overflow-clip",
			)}
		>
			<p className="sr-only">{t("hero.bandLabel")}</p>
			<div className="sf-band-track flex">
				<p className={lineClass}>{t("hero.lineup")}</p>
				<p className={`${lineClass} lg:hidden`} aria-hidden="true">
					{t("hero.lineup")}
				</p>
			</div>
		</div>
	);
}
