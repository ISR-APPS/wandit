// Product page of Orbe N°1 by LUME, a hand-thrown ceramic lamp. The "/" route renders it, and the build prerenders it.
// It holds the colorway state: the hero toggle, the noir button, and the reserve cards all change it.
// It imports the site CSS, lays the grain over the page, and starts the scroll entrances on its root element.
import "../landing.css";
import { useRef, useState } from "react";
import { useT } from "~/shared/i18n";
import { useReveal } from "../hooks/use-reveal";
import type { Colorway } from "../lib/colorways";
import { AnnounceBar } from "./announce-bar";
import { BreathSection } from "./breath-section";
import { DesignSection } from "./design-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { NoirSection } from "./noir-section";
import { ReserveSection } from "./reserve-section";
import { ReviewsSection } from "./reviews-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SpecsSection } from "./specs-section";
import { TickerBand } from "./ticker-band";

/** The whole public page. Ground changes (ink, paper, noir, photo, soft paper) mark the chapters, not empty space. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	// Crème at load, so the prerendered page and the first browser render match.
	const [colorway, setColorway] = useState<Colorway>("creme");
	useReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			data-colorway={colorway}
			className="lume-page relative min-h-svh bg-background font-sans text-[1.0625rem] text-foreground leading-[1.6] antialiased"
		>
			<a
				href="#main"
				className="sr-only rounded-full focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[200] focus:bg-foreground focus:px-[1.2em] focus:py-[0.7em] focus:text-background"
			>
				{t("site.skipToContent")}
			</a>
			<div className="lume-grain" aria-hidden="true" />
			<AnnounceBar />
			<SiteHeader />
			<main id="main">
				<HeroSection colorway={colorway} onColorwayChange={setColorway} />
				<TickerBand />
				<DesignSection />
				<NoirSection onColorwayChange={setColorway} />
				<BreathSection />
				<SpecsSection />
				<ReviewsSection />
				<ReserveSection colorway={colorway} onColorwayChange={setColorway} />
				<FaqSection />
			</main>
			<SiteFooter />
		</div>
	);
}
