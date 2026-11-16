// Public home page of Yacine R., a film photographer in Algiers. The "/" route renders it, and the build prerenders it.
// It puts the header, the eight sections, and the footer in order. Each section is one file in this folder.
// landing.css gives the film furniture and the motion; the page is complete with no script.
import "../landing.css";
import { useT } from "~/shared/i18n";
import { AboutSection } from "./about-section";
import { ContactSection } from "./contact-section";
import { ContactSheetSection } from "./contact-sheet-section";
import { GallerySection } from "./gallery-section";
import { HeroSection } from "./hero-section";
import { PrintsSection } from "./prints-section";
import { SeriesSection } from "./series-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TestimonialSection } from "./testimonial-section";

/** Panels (Gallery, About, Contact) never follow each other: a ground section always sits between two panels. */
export function LandingPage() {
	const { t } = useT();
	return (
		<div className="yr-page min-h-svh bg-background text-foreground">
			<a
				href="#main"
				className="yr-mono sr-only z-[60] bg-foreground px-3.5 py-2.5 text-[0.72rem] text-background focus:not-sr-only focus:absolute focus:start-(--yr-gutter) focus:top-2"
			>
				{t("site.skipLink")}
			</a>
			<SiteHeader />
			<main id="main">
				<HeroSection />
				<SeriesSection />
				<GallerySection />
				<ContactSheetSection />
				<AboutSection />
				<TestimonialSection />
				<PrintsSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
