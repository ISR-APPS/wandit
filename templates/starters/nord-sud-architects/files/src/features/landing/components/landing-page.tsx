// Home page of Atelier Nord-Sud, an architecture studio in Algiers. The "/" route renders it, and the build prerenders it.
// The page is one working drawing: the title sheet, the plan that draws itself, three project sheets,
// the schedule of missions, the method chain, the figures, the contact, and the title block as the footer.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { ArrowMarkerDefs } from "./arrow-marker-defs";
import { CartoucheFooter } from "./cartouche-footer";
import { ContactSection } from "./contact-section";
import { FiguresSection } from "./figures-section";
import { HeroSection } from "./hero-section";
import { MethodSection } from "./method-section";
import { MissionsSection } from "./missions-section";
import { PlanSection } from "./plan-section";
import { SheetsSection } from "./sheets-section";
import { SiteHeader } from "./site-header";

/** The whole public page, folios PL·01 to PL·07 in reading order. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			className="ns-scope ns-paper min-h-svh font-sans text-base text-foreground leading-[1.65]"
		>
			<a
				href="#top"
				className="sr-only focus:not-sr-only focus:absolute focus:start-0 focus:top-0 focus:z-50 focus:bg-foreground focus:px-4 focus:py-3 focus:text-background"
			>
				{t("site.skipToContent")}
			</a>
			<ArrowMarkerDefs />
			<SiteHeader />
			<main id="top">
				<HeroSection />
				<PlanSection />
				<SheetsSection />
				<MissionsSection />
				<MethodSection />
				<FiguresSection />
				<ContactSection />
			</main>
			<CartoucheFooter />
		</div>
	);
}
