// The first screen: three soft color fields, the breathing rings behind the headline, the two buttons,
// the small breathing guide, and the scroll cue. LandingPage renders it first.
// The hero scrub detunes the rings into parallax while the hero leaves the screen.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { GHOST_BUTTON, INK_BUTTON } from "../lib/styles";
import { BreathGuide } from "./breath-guide";

/** The hero, one full screen tall. Its content is centered on the rings. */
export function HeroSection() {
	const { t } = useT();
	const heroRef = useRef<HTMLElement>(null);
	// Progress 0 at the top of the page, 1 when the hero bottom leaves the top of the screen.
	useScrollProgress(heroRef, "--hero-scroll", { startAt: 0, endAt: 0 });
	return (
		<section
			ref={heroRef}
			aria-labelledby="hero-title"
			className="relative flex min-h-svh flex-col items-center justify-center overflow-x-clip px-[clamp(22px,5vw,72px)] pt-[clamp(120px,16vh,150px)] pb-[clamp(110px,14vh,130px)] text-center"
		>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0">
				<div
					data-tone="sage"
					className="sp-blob -start-[10%] -top-[12%] aspect-square w-[max(44vw,320px)] max-w-[600px]"
				/>
				<div
					data-tone="clay"
					className="sp-blob -end-[8%] -bottom-[8%] aspect-square w-[max(36vw,260px)] max-w-[520px]"
				/>
				<div
					data-tone="bone"
					className="sp-blob end-[16%] top-[34%] aspect-square w-[26vw] max-w-[380px]"
				/>
			</div>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 flex items-center justify-center"
			>
				<div className="sp-stage">
					<div className="sp-halo sp-breathe" />
					<div data-ring="3" className="sp-ring sp-breathe-late2" />
					<div data-ring="2" className="sp-ring sp-breathe-late" />
					<div data-ring="1" className="sp-ring sp-breathe" />
				</div>
			</div>
			<div className="sp-hero-content relative z-2 max-w-[1080px]">
				<p className="text-balance font-bold font-sans text-[0.68rem] text-primary uppercase leading-[1.6] tracking-[0.2em] sm:text-[0.72rem] sm:tracking-[0.3em]">
					{t("hero.eyebrow")}
				</p>
				<h1
					id="hero-title"
					className="mt-7 text-balance font-display font-normal text-[clamp(2.9rem,8.4vw,7rem)] leading-[1.02] tracking-[-0.025em]"
				>
					{t("hero.titleLine1")}
					<br />
					{t("hero.titleLead")}{" "}
					<span className="whitespace-nowrap">
						<em className="text-primary italic">{t("hero.titleEm")}</em>{" "}
						{t("hero.titleTail")}
					</span>
				</h1>
				<p className="mx-auto mt-[30px] max-w-[46ch] text-pretty text-(--sp-ink-78) text-[clamp(1rem,1.35vw,1.15rem)]">
					{t("hero.body")}
				</p>
				<div className="mt-[38px] flex flex-wrap justify-center gap-4">
					<a href="#begin" className={INK_BUTTON}>
						{t("hero.primaryCta")}
					</a>
					<a href="#schedule" className={cn(GHOST_BUTTON, "bg-background/40")}>
						{t("hero.secondaryCta")}
					</a>
				</div>
				<BreathGuide />
			</div>
			<div
				aria-hidden="true"
				className="absolute inset-x-0 bottom-6 z-2 mx-auto hidden w-fit flex-col items-center gap-3 font-bold font-sans text-(--sp-ink-64) text-[0.66rem] uppercase tracking-[0.3em] [@media(min-height:760px)]:flex"
			>
				<i className="sp-cue-line relative block h-[52px] w-px overflow-hidden bg-(--sp-line)" />
				{t("hero.scrollCue")}
			</div>
		</section>
	);
}
