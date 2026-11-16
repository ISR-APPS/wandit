// Home page of Fawtara, an invoicing product for shopkeepers. The "/" route renders it, and the build prerenders it.
// It stacks the header, the nine sections, and the footer on the paper ground.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { CompareSection } from "./compare-section";
import { ContactSection } from "./contact-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { PathSection } from "./path-section";
import { PricingSection } from "./pricing-section";
import { ProductSection } from "./product-section";
import { QuoteSection } from "./quote-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { StatsSection } from "./stats-section";

/** The whole public page. No two adjacent sections share a layout. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="fw-page min-h-svh bg-card font-sans text-[1.0625rem] text-foreground leading-[1.65] tracking-normal"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-5 focus:py-3 focus:text-primary-foreground"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			{/* The clip keeps the sky halo of the hero inside the page width. The header stays outside, so it can stick. */}
			<main id="content" className="overflow-x-clip">
				<HeroSection />
				<StatsSection />
				<ProductSection />
				<PathSection />
				<CompareSection />
				<QuoteSection />
				<PricingSection />
				<FaqSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
