// The Campus Numidia home page. The "/" route renders it, and the build prerenders it.
// It stacks the sections in the order of the campus world and starts the block-pop reveals.
// Every text is in the message groups `site` to `footer`; the photos are in public/images.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useBlockPop } from "../hooks/use-block-pop";
import "../landing.css";
import { AdmissionSection } from "./admission-section";
import { CampusSection } from "./campus-section";
import { DatesStrip } from "./dates-strip";
import { EnrolSection } from "./enrol-section";
import { FaqSection } from "./faq-section";
import { HeroSection } from "./hero-section";
import { ProgrammesSection } from "./programmes-section";
import { ResultsSection } from "./results-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TimetableSection } from "./timetable-section";

/** One public page: white, sand strip, white, pale sky, white, navy, pale sky, white, pale sky, then the navy footer. */
export function LandingPage() {
	const { t } = useT();
	const rootRef = useRef<HTMLDivElement>(null);
	useBlockPop(rootRef);
	return (
		<div ref={rootRef} id="top" className="cn-page min-h-svh bg-background">
			<a
				href="#main"
				className="sr-only rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground text-sm focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60]"
			>
				{t("site.skipLink")}
			</a>
			<SiteHeader />
			<main id="main">
				<HeroSection />
				<DatesStrip />
				<ProgrammesSection />
				<TimetableSection />
				<CampusSection />
				<AdmissionSection />
				<ResultsSection />
				<FaqSection />
				<EnrolSection />
			</main>
			<SiteFooter />
		</div>
	);
}
