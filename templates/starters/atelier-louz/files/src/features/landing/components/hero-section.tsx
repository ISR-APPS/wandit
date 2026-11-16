// The fixed opening of the page: the statement, the two arch buttons, and the drawn arcade scene.
// LandingPage renders it first. The entrance is CSS only (landing.css), so it also runs before hydration.
import { useT } from "~/shared/i18n";
import { ArcadeScene } from "./arcade-scene";
import { ArchTag } from "./arch-tag";

/** The hero: copy on the start side, the arcade on the end side; stacked on a phone. */
export function HeroSection() {
	const { t } = useT();
	return (
		<section aria-label={t("site.brand")} className="relative">
			<div className="mx-auto grid max-w-[1340px] items-center gap-10 px-5 pt-28 pb-14 sm:px-8 lg:min-h-svh lg:grid-cols-[48fr_52fr] lg:gap-14 lg:pt-24 lg:pb-10">
				<div>
					<ArchTag className="louz-enter mb-6">{t("hero.tag")}</ArchTag>
					<h1 className="louz-enter louz-enter-2 mb-6 font-display font-normal text-[clamp(2.8rem,6.2vw,5.4rem)] leading-[1.04] tracking-[-0.01em]">
						{t("hero.titleStart")}{" "}
						<span className="louz-tint-text">{t("hero.titleAccent")}</span>
					</h1>
					<p className="louz-enter louz-enter-3 mb-9 max-w-[42ch] text-[1.15rem] leading-relaxed">
						{t("hero.subtitle")}
					</p>
					<div className="louz-enter louz-enter-4 mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
						<a
							href={t("site.phoneHref")}
							className="louz-btn inline-flex min-h-14 items-center justify-center px-7 pt-[0.15em] font-bold text-[1.02rem]"
						>
							{t("hero.callLabel")}
						</a>
						<a
							href="#materials"
							className="louz-btn-ghost inline-flex min-h-14 items-center justify-center px-7 pt-[0.15em] font-bold text-[1.02rem]"
						>
							{t("hero.materialsCta")}
						</a>
					</div>
					<p className="louz-enter louz-enter-5 text-[0.92rem] text-foreground/75">
						{t("hero.note")}
					</p>
				</div>
				<div className="flex justify-center lg:justify-end">
					<ArcadeScene />
				</div>
			</div>
		</section>
	);
}
