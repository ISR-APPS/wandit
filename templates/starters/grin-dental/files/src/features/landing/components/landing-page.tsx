// Home page of Grin Dental Studio, a family and kids dentist. The "/" route renders it, and the build prerenders it.
// It stacks the header, the hero, the marquee, seven sections, and the footer on a cream sticker-book page.
// It imports the site CSS and starts the scroll entrances (hooks/use-pop-in.ts) on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { usePopIn } from "../hooks/use-pop-in";
import { BookSection } from "./book-section";
import { ClubSection } from "./club-section";
import { HeroSection } from "./hero-section";
import { PricesSection } from "./prices-section";
import { PromiseMarquee } from "./promise-marquee";
import { ReviewsSection } from "./reviews-section";
import { ServicesSection } from "./services-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { StatsRow } from "./stats-row";
import { TeamSection } from "./team-section";
import { VisitSection } from "./visit-section";

/** The whole public page. The grounds go cream, ink and coral bands, dots, teal, cream, peach, cream, coral, cream, ink. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	usePopIn(pageRef);
	return (
		<div
			ref={pageRef}
			className="gd-page min-h-svh overflow-x-clip bg-background font-sans text-[1.0625rem] text-foreground leading-[1.6] antialiased"
		>
			<a
				href="#content"
				className="gd-outline gd-shadow-4 sr-only rounded-full bg-(--gd-sun) px-5 py-2.5 font-bold font-display focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<PromiseMarquee />
				<ServicesSection />
				<VisitSection />
				<StatsRow />
				<TeamSection />
				<PricesSection />
				<ReviewsSection />
				<ClubSection />
				<BookSection />
			</main>
			<SiteFooter />
		</div>
	);
}
