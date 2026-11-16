// Home page of Maison Sud, an interior architecture studio. The "/" route renders it, and the build prerenders it.
// It stacks the header, the seven sections, and the footer on two alternating grounds.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { ContactSection } from "./contact-section";
import { HeroSection } from "./hero-section";
import { MaterialsSection } from "./materials-section";
import { MethodSection } from "./method-section";
import { PressSection } from "./press-section";
import { ProjectsSection } from "./projects-section";
import { RoomsSection } from "./rooms-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The whole public page. The section order is the order a visitor is walked through the studio. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="ms-page min-h-svh overflow-x-clip bg-background font-sans text-foreground tracking-normal"
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
				<ProjectsSection />
				<MethodSection />
				<RoomsSection />
				<MaterialsSection />
				<PressSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
