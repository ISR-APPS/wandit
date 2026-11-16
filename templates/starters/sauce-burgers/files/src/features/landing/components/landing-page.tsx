// Home page of SAUCE!, a smash burger counter. The "/" route renders it, and the build prerenders it.
// It stacks the header, the hero, the info band, six sections, and the footer.
// It imports the site CSS and starts the flick entrances on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useFlickServe } from "../hooks/use-flick-serve";
import { DriveSection } from "./drive-section";
import { ExplodedSection } from "./exploded-section";
import { HeroSection } from "./hero-section";
import { InfoBand } from "./info-band";
import { MenuSection } from "./menu-section";
import { OrderSection } from "./order-section";
import { SaucesSection } from "./sauces-section";
import { SidesSection } from "./sides-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The whole public page. From the menu the grounds go cream, hot, mustard, cream (with a hot quote band), cream, hot, then the ink footer. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useFlickServe(pageRef);
	return (
		<div
			ref={pageRef}
			className="sc-page min-h-svh overflow-x-clip bg-background font-sans text-[clamp(15px,1.02vw,17px)] text-foreground leading-[1.55] tracking-normal"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:bg-foreground focus:px-4 focus:py-2.5 focus:font-bold focus:text-background"
			>
				{t("site.skipToContent")}
			</a>
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<InfoBand />
				<MenuSection />
				<ExplodedSection />
				<SaucesSection />
				<DriveSection />
				<SidesSection />
				<OrderSection />
			</main>
			<SiteFooter />
		</div>
	);
}
