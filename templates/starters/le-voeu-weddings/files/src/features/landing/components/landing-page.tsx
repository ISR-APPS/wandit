// Home page of Le Vœu, a wedding planner in Algiers. The "/" route renders it, and the build prerenders it.
// It stacks the header, the eight sections, and the footer: the opened invitation first, the reply card last.
// It imports the site CSS and starts the scroll reveals and the scroll scrub on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { useScrollScrub } from "../hooks/use-scroll-scrub";
import { EveningBand } from "./evening-band";
import { HeroSection } from "./hero-section";
import { PackagesSection } from "./packages-section";
import { ProcessSection } from "./process-section";
import { ReplySection } from "./reply-section";
import { ServicesSection } from "./services-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { StationerySection } from "./stationery-section";
import { WeddingsSection } from "./weddings-section";

/** The whole public page. The liner ground comes two times only: the weddings and the packages. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	useScrollScrub(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="voeu-scope min-h-svh bg-background font-sans text-[clamp(1rem,0.96rem+0.18vw,1.075rem)] text-foreground leading-[1.76] tracking-normal"
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
				<ServicesSection />
				<WeddingsSection />
				<EveningBand />
				<ProcessSection />
				<PackagesSection />
				<StationerySection />
				<ReplySection />
			</main>
			<SiteFooter />
		</div>
	);
}
