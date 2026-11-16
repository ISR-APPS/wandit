// The first screen: the whole offer on the start side, the lamp on its stage on the end side, a fact rail under both.
// LandingPage renders it with the colorway state. The ground follows the colorway through landing.css.
// The entrance is CSS only (.lume-enter with a delay each), so the page is complete with no script.
import { useT } from "~/shared/i18n";
import type { Colorway } from "../lib/colorways";
import { formatPrice, PRICE_USD, REGULAR_PRICE_USD } from "../lib/offer";
import { WRAP } from "../lib/type-styles";
import { HeroStage } from "./hero-stage";
import { PillArrow } from "./pill-arrow";

type HeroSectionProps = {
	colorway: Colorway;
	onColorwayChange: (colorway: Colorway) => void;
};

/** Grid 1.05fr / .95fr from 1024px. Below, the copy comes first and the stage under it.
 * The phone measures are tighter, so the top of the lamp shows on the first screen. */
export function HeroSection({ colorway, onColorwayChange }: HeroSectionProps) {
	const { t } = useT();
	const rail = [
		t("hero.rail1"),
		t("hero.rail2"),
		t("hero.rail3"),
		t("hero.rail4"),
	];
	return (
		<section aria-labelledby="hero-title" className="lume-hero overflow-clip">
			<div
				className={`${WRAP} lume-hero-grid grid items-center gap-10 pt-6 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-[clamp(2rem,5vw,5rem)] lg:pt-[clamp(2rem,5vh,4rem)] lg:pb-[clamp(4rem,8vh,6rem)]`}
			>
				<div className="max-w-[36rem]">
					<p className="lume-ruled lume-enter mb-5 flex items-center gap-[0.9em] font-medium text-(--lume-accent) text-[0.75rem] uppercase tracking-[0.22em] [--lume-delay:0.15s] lg:mb-[1.6rem]">
						{t("hero.eyebrow")}
					</p>
					<h1
						id="hero-title"
						className="mb-5 font-display font-medium text-[clamp(2.8rem,8.4vw,7.2rem)] leading-[0.98] tracking-[-0.015em] lg:mb-[1.6rem]"
					>
						<span className="lume-enter block [--lume-delay:0.24s]">
							{t("hero.titleLine1")}
						</span>
						<span className="lume-enter block [--lume-delay:0.33s]">
							{t("hero.titleLine2")}
						</span>
						<span className="lume-enter block [--lume-delay:0.42s]">
							{t("hero.titleLine3")}{" "}
							<em className="lume-turn">{t("hero.titleTurn")}</em>
						</span>
					</h1>
					<p className="lume-enter mb-6 max-w-[30em] text-(--lume-ink-muted) text-[clamp(1rem,1.35vw,1.15rem)] leading-[1.65] transition-colors duration-700 [--lume-delay:0.51s] lg:mb-[2.2rem]">
						{t("hero.lede")}
					</p>
					<div className="lume-enter mb-6 flex flex-wrap items-baseline gap-4 [--lume-delay:0.6s] lg:mb-8">
						<span className="font-display font-semibold text-[clamp(2.4rem,4vw,3.4rem)] tabular-nums tracking-[-0.01em]">
							<span className="lume-sup">{t("hero.currency")}</span>
							{PRICE_USD}
						</span>
						<span className="lume-struck text-(--lume-ink-muted) text-[1.15rem] tabular-nums">
							<span className="sr-only">{t("hero.regularPrice")} </span>
							{formatPrice(REGULAR_PRICE_USD)}
						</span>
						<span className="rounded-full border border-(--lume-line) px-[1.1em] py-[0.55em] font-medium text-[0.72rem] uppercase tracking-[0.16em] transition-colors duration-700">
							{t("hero.badge")}
						</span>
					</div>
					<div className="lume-enter mb-[1.1rem] flex flex-wrap items-center gap-x-[1.6rem] gap-y-2 [--lume-delay:0.69s]">
						<a href="#reserve" className="lume-btn lume-btn-stage">
							{t("hero.cta")}
							<PillArrow />
						</a>
						<a href="#design" className="lume-quiet font-medium text-[0.9rem]">
							<span>{t("hero.explore")}</span>
						</a>
					</div>
					<p className="lume-enter text-(--lume-ink-muted) text-[0.82rem] [--lume-delay:0.78s]">
						{t("hero.note")}
					</p>
				</div>
				<HeroStage colorway={colorway} onColorwayChange={onColorwayChange} />
			</div>
			<div className="lume-enter border-(--lume-line) border-t transition-colors duration-700 [--lume-delay:0.87s]">
				<ul
					className={`${WRAP} grid grid-cols-2 gap-x-5 gap-y-[0.9rem] py-[1.3rem] sm:flex sm:flex-wrap sm:gap-x-10 sm:py-[1.1rem]`}
				>
					{rail.map((fact) => (
						<li
							key={fact}
							className="lume-dot flex items-center gap-[0.7em] text-(--lume-ink-muted) text-[0.68rem] uppercase tracking-[0.08em] sm:text-[0.8rem] sm:tracking-[0.1em]"
						>
							{fact}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
