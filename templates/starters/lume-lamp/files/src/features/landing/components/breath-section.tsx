// The breath of the page: a full-bleed photo of the lamp at home with one line of serif voice over it.
// LandingPage renders it after the noir chapter. No heading, no button: the photo is the whole section.
// useScrollProgress moves the photo slowly against the scroll (the one parallax of the page).
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollProgress } from "../hooks/use-scroll-progress";
import { WRAP } from "../lib/type-styles";

/** As tall as the screen, at most 54rem. The quote sits on a scrim that is dark only at the bottom. */
export function BreathSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useScrollProgress(sectionRef);
	return (
		<section
			ref={sectionRef}
			aria-label={t("breath.label")}
			className="lume-breath relative h-[74svh] overflow-hidden sm:h-[min(92svh,54rem)]"
		>
			<img
				src="/images/lamp-desk.webp"
				width={1600}
				height={1067}
				alt={t("breath.imageAlt")}
				loading="lazy"
			/>
			<div
				className={`${WRAP} absolute inset-x-0 bottom-[clamp(2.5rem,8vh,5.5rem)] z-[2] text-background`}
			>
				<blockquote data-reveal>
					<p className="lume-serif max-w-[20em] text-balance text-[clamp(1.7rem,3.6vw,3rem)] leading-[1.25]">
						{t("breath.quote")}
					</p>
					<footer className="mt-[1.2rem] text-(--lume-brass-light) text-[0.8rem] uppercase tracking-[0.18em]">
						{t("breath.cite")}
					</footer>
				</blockquote>
			</div>
		</section>
	);
}
