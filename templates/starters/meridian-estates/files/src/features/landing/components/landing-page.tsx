// Home page of Meridian, a private brokerage for landmark modern houses. The "/" route renders it,
// and the build prerenders it. It stacks the cover plate, the practice, the sideways portfolio,
// the residence, the measured band, the private viewing, and the colophon footer.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { ContactSection } from "./contact-section";
import { HeroSection } from "./hero-section";
import { IntroSection } from "./intro-section";
import { NumbersSection } from "./numbers-section";
import { PortfolioSection } from "./portfolio-section";
import { ResidenceSection } from "./residence-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The whole public page in reading order, on the dark ground of the theme with a film grain over it. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			className="mer-page min-h-svh bg-background font-sans text-base text-foreground leading-[1.6] antialiased"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:bg-card focus:px-4 focus:py-3 focus:text-foreground"
			>
				{t("site.skipToContent")}
			</a>
			<div aria-hidden="true" className="mer-grain" />
			<SiteHeader />
			<main id="top">
				<HeroSection />
				<div id="content">
					<IntroSection />
					<PortfolioSection />
					<ResidenceSection />
					<NumbersSection />
					<ContactSection />
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
