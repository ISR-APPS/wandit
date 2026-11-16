// Home page of Onde, a hammam and spa on the Oran seafront. The "/" route renders it, and the build prerenders it.
// It stacks the header, the seven sections, and the footer, from the steam room to the booking.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { BookingSection } from "./booking-section";
import { GiftCardsSection } from "./gift-cards-section";
import { HeroSection } from "./hero-section";
import { HouseSection } from "./house-section";
import { RitualSection } from "./ritual-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TreatmentsSection } from "./treatments-section";
import { WaterSection } from "./water-section";

/** The whole public page. The two sands alternate from section to section, and no section is dark. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="onde-scope relative min-h-svh overflow-x-clip bg-background font-sans text-[clamp(15.5px,1.04vw,17px)] text-foreground leading-[1.72] antialiased"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-5 focus:py-3 focus:text-primary-foreground"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<RitualSection />
				<TreatmentsSection />
				<WaterSection />
				<HouseSection />
				<GiftCardsSection />
				<BookingSection />
			</main>
			<SiteFooter />
		</div>
	);
}
