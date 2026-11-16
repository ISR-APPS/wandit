// The first screen of the page: the claim on the start side, the floating tableau on the end side.
// LandingPage renders it. The h1 has one blue word with the warm marker under it.
// landing.css plays the entrance at page load. The scroll hook drifts the two satellite cards.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import {
	type ScrollProgressOf,
	useScrollProgress,
} from "../hooks/use-scroll-progress";
import { TRUST_LINE, WRAP } from "../lib/class-names";
import { HeroTableau } from "./hero-tableau";
import { LabelPill } from "./label-pill";
import { PillLink } from "./pill-link";

// 0 while the top of the hero is on screen, 1 when the whole hero is above the screen.
const heroProgressOf: ScrollProgressOf = (rect) => -rect.top / rect.height;

/** The only h1 of the page. From 1024px the two columns have the ratio 55 to 45. */
export function HeroSection() {
	const { t } = useT();
	const heroRef = useRef<HTMLElement>(null);
	useScrollProgress(heroRef, "--fw-hero", heroProgressOf, {
		keepsHighest: false,
	});
	return (
		<section ref={heroRef} aria-labelledby="hero-title" className="fw-hero">
			<div
				className={`${WRAP} grid items-center gap-[clamp(2.75rem,5vw,4rem)] pt-[clamp(2.75rem,7vh,5.5rem)] pb-[clamp(3.5rem,8vh,6rem)] lg:min-h-[min(82vh,760px)] lg:grid-cols-[1.15fr_1fr]`}
			>
				<div>
					<LabelPill className="fw-rise">{t("hero.label")}</LabelPill>
					<h1
						id="hero-title"
						className="fw-rise isolate mt-6 text-balance font-display font-extrabold text-[clamp(2.5rem,5.4vw,4.3rem)] leading-[1.06] tracking-[-0.02em] [--fw-order:1]"
					>
						<span className="relative whitespace-nowrap text-primary">
							{t("hero.titleAccent")}
							{/* Warm moment 1 of 3: the marker under the one blue word. */}
							<span
								aria-hidden="true"
								className="dark fw-warm absolute inset-x-0 bottom-[0.04em] -z-10 h-[0.16em] rounded-full"
							/>
						</span>
						{t("hero.titleRest")}
					</h1>
					<p className="fw-rise mt-6 max-w-[32em] text-[clamp(1.0625rem,1.4vw,1.15rem)] text-muted-foreground leading-[1.65] [--fw-order:2]">
						{t("hero.subtitle")}
					</p>
					<div className="fw-rise mt-7 flex flex-wrap gap-3.5 [--fw-order:3]">
						<PillLink href="#contact" tone="primary">
							{t("hero.primaryCta")}
						</PillLink>
						<PillLink href="#path" tone="secondary">
							{t("hero.secondaryCta")}
						</PillLink>
					</div>
					<p className={`fw-rise mt-4 [--fw-order:4] ${TRUST_LINE}`}>
						{t("hero.trust")}
					</p>
				</div>
				<HeroTableau />
			</div>
		</section>
	);
}
