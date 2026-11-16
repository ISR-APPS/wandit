// Home page of Domaine Les Palmiers, a developer of twelve villas. The "/" route renders it, and the build prerenders it.
// It stacks the header, the eight sections, and the footer on two alternating grounds.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { ContactSection } from "./contact-section";
import { EstateSection } from "./estate-section";
import { EveningBand } from "./evening-band";
import { HeroSection } from "./hero-section";
import { LotsSection } from "./lots-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SpecificationSection } from "./specification-section";
import { VillasSection } from "./villas-section";
import { VisitSection } from "./visit-section";

/** The whole public page. The section order is the order of a sales folder: the place, the houses, the visit, the terms, the prices. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="dlp-scope min-h-svh bg-background font-sans text-[17px] text-foreground leading-[1.7] tracking-normal"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-0 focus:top-0 focus:z-50 focus:bg-foreground focus:px-5 focus:py-3 focus:text-background"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<EstateSection />
				<VillasSection />
				<VisitSection />
				<EveningBand />
				<SpecificationSection />
				<LotsSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
