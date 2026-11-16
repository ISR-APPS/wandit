// Home page of studio sable, a design and branding studio. The "/" route renders it, and the build prerenders it.
// It stacks the masthead, the index hero, six sections, and the ink footer on one paper ground.
// It imports the site CSS and starts the entrance cascade on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useCascade } from "../hooks/use-cascade";
import { AtelierSection } from "./atelier-section";
import { BriefSection } from "./brief-section";
import { CaseSection } from "./case-section";
import { HeroSection } from "./hero-section";
import { OffersSection } from "./offers-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { StudioSection } from "./studio-section";
import { WallSection } from "./wall-section";

/** The whole public page. No two neighbour sections share a column ratio. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useCascade(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="sable-page min-h-svh overflow-x-clip bg-background font-sans text-[17px] text-foreground leading-[1.62] tracking-normal"
		>
			<a
				href="#index"
				className="sable-mono sr-only text-[12px] focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:bg-foreground focus:px-[18px] focus:py-3 focus:text-background"
			>
				{t("site.skipToIndex")}
			</a>
			<SiteHeader />
			<main>
				<HeroSection />
				<StudioSection />
				<CaseSection />
				<OffersSection />
				<WallSection />
				<AtelierSection />
				<BriefSection />
			</main>
			<SiteFooter />
		</div>
	);
}
