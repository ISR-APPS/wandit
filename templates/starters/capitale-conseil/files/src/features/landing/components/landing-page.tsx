// Home page of Capitale Conseil, a strategy consulting firm. The "/" route renders it, and the build prerenders it.
// It stacks the header, the index spine, the hero, five numbered movements with three interludes, and the footer.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { ContactSection } from "./contact-section";
import { FiguresSection } from "./figures-section";
import { FirmSection } from "./firm-section";
import { HeroSection } from "./hero-section";
import { IndexSpine } from "./index-spine";
import { OfficeSection } from "./office-section";
import { PartnersSection } from "./partners-section";
import { PracticesSection } from "./practices-section";
import { QuoteSection } from "./quote-section";
import { ReferencesSection } from "./references-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The whole public page. The order is the one of an annual report: the firm, its practices, its figures, one mandate, the contact. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			className="cap-scope min-h-svh bg-background font-sans text-[1.0625rem] text-foreground leading-[1.62] tracking-normal min-[56.25rem]:text-lg"
		>
			<a
				href="#firm"
				className="sr-only focus:not-sr-only focus:absolute focus:start-0 focus:top-0 focus:z-50 focus:bg-foreground focus:px-4 focus:py-3 focus:font-semibold focus:text-background focus:text-xs focus:uppercase focus:tracking-[0.12em]"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<IndexSpine />
			<main>
				<HeroSection />
				<FirmSection />
				<PracticesSection />
				<FiguresSection />
				<ReferencesSection />
				<QuoteSection />
				<PartnersSection />
				<OfficeSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
