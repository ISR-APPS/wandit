// Home page of NOUR Objets, a concept store of objects and furniture.
// The "/" route renders it, and the build prerenders it.
// It stacks the header, the storefront hero, six sections, and the footer on one white ground.
// It imports the site CSS and holds the basket of the visitor. It starts the fade entrances on its root.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useReveal } from "../hooks/use-reveal";
import { FocusSection } from "./focus-section";
import { HeroSection } from "./hero-section";
import { QuoteSection } from "./quote-section";
import { ReservationProvider } from "./reservation-provider";
import { RulesSection } from "./rules-section";
import { ShelfSection } from "./shelf-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { VisitSection } from "./visit-section";
import { WindowSection } from "./window-section";

/** The whole public page. No two neighbour sections share a layout. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useReveal(pageRef);
	return (
		<ReservationProvider>
			<div
				ref={pageRef}
				id="top"
				className="nour-page min-h-svh bg-background font-sans text-[16px] text-foreground leading-[1.62] tracking-normal"
			>
				<a
					href="#shelf"
					className="nour-mono sr-only text-[11px] uppercase tracking-[0.11em] focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:bg-foreground focus:px-[18px] focus:py-3 focus:text-background"
				>
					{t("site.skipToShelf")}
				</a>
				<SiteHeader />
				<main>
					<HeroSection />
					<ShelfSection />
					<WindowSection />
					<FocusSection />
					<RulesSection />
					<QuoteSection />
					<VisitSection />
				</main>
				<SiteFooter />
			</div>
		</ReservationProvider>
	);
}
