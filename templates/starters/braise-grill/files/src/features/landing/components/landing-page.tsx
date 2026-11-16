// The Braise home page: a charcoal grill house, on one page. The "/" route renders it, and the build prerenders it.
// It stacks the header, the six sections, and the footer, and starts the scroll reveals.
// landing.css holds the world layouts and motion; lib/content.ts and messages.ts hold the sample content.
import { useRef } from "react";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import "../landing.css";
import { BookingSection } from "./booking-section";
import { ChefSection } from "./chef-section";
import { EveningSection } from "./evening-section";
import { HearthSection } from "./hearth-section";
import { HeroSection } from "./hero-section";
import { MenuSection } from "./menu-section";
import { RoomSection } from "./room-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The page. Sections alternate the two grounds; the evening takes the one ash panel. */
export function LandingPage() {
	const rootRef = useRef<HTMLDivElement>(null);
	useScrollReveal(rootRef);

	return (
		<div ref={rootRef} className="br-page min-h-svh font-sans">
			<SiteHeader />
			<main id="top">
				<HeroSection />
				<HearthSection />
				<MenuSection />
				<ChefSection />
				<RoomSection />
				<EveningSection />
				<BookingSection />
			</main>
			<SiteFooter />
		</div>
	);
}
