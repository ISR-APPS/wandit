// Home page of Clinique Lumia, a dermatology and skin clinic in Hydra, Algiers. The "/" route renders it,
// and the build prerenders it. It stacks the header, the six sections, and the footer, from the photo orbit
// to the booking panel. It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { CareSection } from "./care-section";
import { ContactSection } from "./contact-section";
import { HeroSection } from "./hero-section";
import { PractitionerSection } from "./practitioner-section";
import { RitualSection } from "./ritual-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WindowSection } from "./window-section";

/** The whole public page. The two creams alternate from section to section; the blush comes once, at the booking. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="lumia-scope min-h-svh overflow-x-clip bg-background font-sans text-[16px] text-foreground leading-[1.68] tracking-normal sm:text-[17px]"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-background"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<CareSection />
				<RitualSection />
				<WindowSection />
				<PractitionerSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
