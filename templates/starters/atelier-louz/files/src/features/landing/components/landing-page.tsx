// The Atelier Louz home page. The "/" route renders it, and the build prerenders it.
// It stacks the sections and owns the chosen material: data-material on the root retints the page (landing.css).
// It also starts the scroll reveals of every [data-reveal] block.
import { useRef, useState } from "react";
import { useScrollReveal } from "../hooks/use-scroll-reveal";
import "../landing.css";
import { DEFAULT_MATERIAL, type MaterialId } from "../lib/materials";
import { ContactSection } from "./contact-section";
import { HeroSection } from "./hero-section";
import { InterludeSection } from "./interlude-section";
import { MaterialBand } from "./material-band";
import { MaterialsSection } from "./materials-section";
import { MethodSection } from "./method-section";
import { ProjectsSection } from "./projects-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** The one public page: hero, marquee, material library, projects, interlude, method, contact, footer. */
export function LandingPage() {
	const rootRef = useRef<HTMLDivElement>(null);
	const [material, setMaterial] = useState<MaterialId>(DEFAULT_MATERIAL);
	useScrollReveal(rootRef);
	return (
		<div
			id="top"
			ref={rootRef}
			data-material={material}
			className="louz relative min-h-svh bg-background font-sans text-[1.05rem] text-foreground leading-relaxed tracking-normal"
		>
			<div aria-hidden="true" className="louz-grain" />
			<SiteHeader material={material} />
			<main>
				<HeroSection />
				<MaterialBand />
				<MaterialsSection material={material} onSelect={setMaterial} />
				<ProjectsSection />
				<InterludeSection />
				<MethodSection />
				<ContactSection />
			</main>
			<SiteFooter />
		</div>
	);
}
