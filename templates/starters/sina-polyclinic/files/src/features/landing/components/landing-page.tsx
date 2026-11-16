// Home page of Sina Polyclinic, a multi-specialty clinic. The "/" route renders it, and the build prerenders it.
// It stacks the header, the seven sections, and the footer. One deep band and two quiet bands give the rhythm.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { BookingSection } from "./booking-section";
import { FaqSection } from "./faq-section";
import { FiguresSection } from "./figures-section";
import { HeroSection } from "./hero-section";
import { OathSection } from "./oath-section";
import { PractitionersSection } from "./practitioners-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SpecialtiesSection } from "./specialties-section";

/** The whole public page. The order follows a visit: what it costs, who sees you, what we promise, how to book. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="sp-scope min-h-svh overflow-x-clip bg-background font-sans text-foreground tracking-normal"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-2.5 focus:top-2.5 focus:z-50 focus:bg-(--sp-teal-deep) focus:px-4 focus:py-2.5 focus:text-card"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<SpecialtiesSection />
				<FiguresSection />
				<PractitionersSection />
				<OathSection />
				<BookingSection />
				<FaqSection />
			</main>
			<SiteFooter />
		</div>
	);
}
