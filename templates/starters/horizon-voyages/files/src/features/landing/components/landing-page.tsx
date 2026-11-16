// Home page of Horizon Voyages, a travel agency in Algiers. The "/" route renders it, and the build prerenders it.
// It stacks the header, the seven sections, and the footer. The grounds alternate: paper, sable, and one deep band.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { CircuitsSection } from "./circuits-section";
import { HeroSection } from "./hero-section";
import { JourneySection } from "./journey-section";
import { LineSection } from "./line-section";
import { ProofSection } from "./proof-section";
import { QuoteSection } from "./quote-section";
import { SeasonsSection } from "./seasons-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The whole public page. The order sells hours and seasons: the window, the circuits, the line, the journey, the seasons, the proof, the quote. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="hz-scope min-h-svh bg-background font-sans text-[16px] text-foreground leading-[1.68] tracking-normal"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-0 focus:top-0 focus:z-50 focus:bg-background focus:px-5 focus:py-3 focus:text-foreground"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<CircuitsSection />
				<LineSection />
				<JourneySection />
				<SeasonsSection />
				<ProofSection />
				<QuoteSection />
			</main>
			<SiteFooter />
		</div>
	);
}
