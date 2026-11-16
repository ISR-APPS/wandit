// The first section of the page: two mono eyebrows, the title, a short note, then the project index.
// LandingPage renders it. The index is inside the hero on purpose: the list of work opens the page.
// Its entrance is a CSS animation of landing.css, so it runs with no script.
import { useT } from "~/shared/i18n";
import { MONO_LABEL, WRAP } from "../lib/type-styles";
import { AccentDot } from "./accent-dot";
import { ArrowLink } from "./arrow-link";
import { ProjectIndex } from "./project-index";

/** The index hero. At 1440 x 900 five project rows sit above the fold. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section
			id="index"
			aria-labelledby="hero-title"
			className="sable-hero pt-[clamp(24px,4vh,44px)]"
		>
			<div className={WRAP}>
				<div className="flex flex-wrap justify-between gap-x-4 gap-y-2 pb-[clamp(18px,3vh,34px)]">
					<p className={`${MONO_LABEL} sable-fade`}>{t("hero.eyebrowTrade")}</p>
					<p className={`${MONO_LABEL} sable-fade [--sable-i:1]`}>
						{t("hero.eyebrowSelection")}
					</p>
				</div>
				<div className="grid items-start gap-[26px] pb-[clamp(28px,5vh,56px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-end lg:gap-[clamp(24px,4vw,64px)]">
					<h1
						id="hero-title"
						className="sable-fade max-w-[18ch] text-balance font-display font-medium text-[clamp(2.9rem,6.4vw,6rem)] leading-[1.02] tracking-[-0.035em] [--sable-i:2] lg:max-w-[12ch]"
					>
						{t("hero.title")}
						<AccentDot />
					</h1>
					<div className="sable-fade max-w-[44ch] [--sable-i:3]">
						<p className="text-[clamp(1rem,1.15vw,1.08rem)] text-foreground/80 leading-[1.55]">
							{t("hero.note")}
						</p>
						<ArrowLink href="#contact" label={t("hero.cta")} />
					</div>
				</div>
				<ProjectIndex />
			</div>
		</section>
	);
}
