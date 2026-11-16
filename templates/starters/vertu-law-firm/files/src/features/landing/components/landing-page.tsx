// Home page of Vertu & Associés, a law firm in Algiers. The "/" route renders it, and the build prerenders it.
// It stacks the header, the hero, the firm rules, the practice drawer, the team, the fees, the reference,
// the consultation, and the footer. It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { ContactSection } from "./contact-section";
import { FeesSection } from "./fees-section";
import { FirmSection } from "./firm-section";
import { HeroSection } from "./hero-section";
import { PracticesSection } from "./practices-section";
import { ReferencesSection } from "./references-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TeamSection } from "./team-section";

/** The whole public page. The grounds alternate: room, raised file, room, cream, raised file, cream, room, recess. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="vt-scope min-h-svh font-sans text-[clamp(1rem,0.96rem+0.22vw,1.0625rem)] leading-[1.62] tracking-normal"
		>
			<a
				href="#firm"
				className="sr-only focus:not-sr-only focus:absolute focus:start-0 focus:top-0 focus:z-50 focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main>
				<HeroSection />
				<FirmSection />
				<PracticesSection />
				<TeamSection />
				<FeesSection />
				<ReferencesSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
