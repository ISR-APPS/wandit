// Home page of Stillpoint, a yoga and pilates studio. The "/" route renders it, and the build prerenders it.
// It stacks the header, the nine bands from the breathing hero to the booking, the exhale strip, and the footer.
// It imports the site CSS and starts the scroll reveals on its root element.
import "../landing.css";
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import { BeginSection } from "./begin-section";
import { ExhaleStrip } from "./exhale-strip";
import { HeroSection } from "./hero-section";
import { ManifestoSection } from "./manifesto-section";
import { MembershipsSection } from "./memberships-section";
import { PracticesSection } from "./practices-section";
import { ScheduleSection } from "./schedule-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { StudioSection } from "./studio-section";
import { TeachersSection } from "./teachers-section";
import { WhispersSection } from "./whispers-section";

/** The whole public page, on bone, with one ink band at the foot. */
export function LandingPage() {
	const { t } = useT();
	const pageRef = useRef<HTMLDivElement>(null);
	useScrollReveal(pageRef);
	return (
		<div
			ref={pageRef}
			id="top"
			className="sp-scope relative min-h-svh overflow-x-clip bg-background font-sans text-[clamp(16px,1.1vw,17px)] text-foreground leading-[1.7] tracking-normal antialiased"
		>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-5 focus:py-3 focus:text-background"
			>
				{t("site.skipToContent")}
			</a>
			<div aria-hidden="true" className="sp-grain" />
			<SiteHeader />
			<main id="content">
				<HeroSection />
				<ManifestoSection />
				<PracticesSection />
				<TeachersSection />
				<ScheduleSection />
				<StudioSection />
				<MembershipsSection />
				<WhispersSection />
				<BeginSection />
				<ExhaleStrip />
			</main>
			<SiteFooter />
		</div>
	);
}
