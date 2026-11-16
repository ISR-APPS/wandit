// The cover plate of the home page: the cliffside villa as the full-bleed ground, the title anchored to the floor
// like a film title card, and a ruled masthead with the subline and the dateline. LandingPage renders it first.
// The entrance is pure CSS (landing.css), so it completes with no script. useParallax drifts the photo on scroll.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useParallax } from "../hooks/use-parallax";
import { AccentWords } from "./accent-words";

/** The first screen. It has no button: the action lives in the header pill. */
export function HeroSection() {
	const { t } = useT();
	const frameRef = useRef<HTMLElement>(null);
	useParallax(frameRef);
	return (
		<section
			ref={frameRef}
			aria-label={t("hero.eyebrow")}
			className="relative flex min-h-svh flex-col justify-end overflow-clip"
		>
			<div className="mer-hero-photo">
				<img
					src="/images/hero-villa.webp"
					alt={t("hero.imageAlt")}
					width={1600}
					height={894}
					fetchPriority="high"
				/>
			</div>
			<div aria-hidden="true" className="mer-hero-scrim" />
			<div aria-hidden="true" className="mer-cue z-[3]" />

			<div className="mer-gutter relative z-[2] pt-32">
				<p className="mer-fade-up mer-hero-shadow mb-[clamp(1.2rem,3vh,2.2rem)] flex items-center gap-5 text-[0.6875rem] text-foreground/80 uppercase tracking-[0.22em]">
					<span aria-hidden="true" className="h-px w-11 bg-primary" />
					{t("hero.eyebrow")}
				</p>
				<h1 className="mer-hero-shadow max-w-[12em] font-display font-normal text-[clamp(3.1rem,9.6vw,10.2rem)] leading-[0.98] tracking-[-0.02em]">
					<span className="mer-line">
						<span>{t("hero.titleLine1")}</span>
					</span>
					<span className="mer-line [--mer-line:1]">
						<span>
							<AccentWords
								start={t("hero.titleLine2")}
								accent={t("hero.titleAccent")}
							/>
						</span>
					</span>
				</h1>
			</div>

			<div className="mer-fade-up mer-gutter relative z-[2] mt-[clamp(1.6rem,4vh,3rem)] flex flex-col gap-5 border-foreground/8 border-t pt-6 pb-16 md:flex-row md:items-end md:justify-between md:gap-8 md:pb-8">
				<p className="max-w-[34ch] text-[0.875rem] text-foreground/70 leading-[1.75]">
					{t("hero.sub")}
				</p>
				<p className="text-[0.6875rem] text-foreground/55 uppercase leading-[2.1] tracking-[0.18em] md:text-end">
					{t("hero.currentLabel")} —{" "}
					<b className="font-medium text-foreground/85">
						{t("hero.currentName")}
					</b>
					<br />
					{t("hero.dateline")}
				</p>
			</div>
		</section>
	);
}
