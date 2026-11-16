// Home page of Festival Siroco, a three-day music festival by the sea. The "/" route renders it, and the build prerenders it.
// It stacks the header, the hero, five poster sheets, and the ink footer. Each sheet has its own flat ground.
// It imports the site CSS, and starts the fit script and the slab entrances on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useFitLines } from "../hooks/use-fit-lines";
import { useSlabReveal } from "../hooks/use-slab-reveal";
import { BookingSection } from "./booking-section";
import { HeadlinersSection } from "./headliners-section";
import { HeroSection } from "./hero-section";
import { InfoSection } from "./info-section";
import { ManifestoSection } from "./manifesto-section";
import { ProgrammeSection } from "./programme-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TicketsSection } from "./tickets-section";

/** The whole poster wall. The grounds go cream, vermilion, the four posters, cobalt, mustard, cream, vermilion, then ink. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useFitLines(pageRef);
	useSlabReveal(pageRef);
	return (
		<div
			ref={pageRef}
			className="sf-page sf-cream relative min-h-svh overflow-x-clip font-sans text-base leading-[1.55] tracking-normal"
		>
			<a
				href="#content"
				className="sf-btn sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:px-5 focus:py-3"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<ManifestoSection />
				<HeadlinersSection />
				<ProgrammeSection />
				<TicketsSection />
				<InfoSection />
				<BookingSection />
			</main>
			<SiteFooter />
		</div>
	);
}
