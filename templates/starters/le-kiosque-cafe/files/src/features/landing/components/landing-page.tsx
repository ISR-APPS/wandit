// The Le Kiosque home page: a café on the Presqu'île in Lyon, set as one edition of its own newspaper.
// The "/" route renders it, and the build prerenders it. It stacks the masthead, the pages, and the imprint,
// and starts the press-roll reveals. kiosque.css holds the world layouts and the motion.
import { useRef } from "react";
import { usePressRoll } from "../hooks/use-press-roll";
import "../kiosque.css";
import { ArchivesSection } from "./archives-section";
import { FrontPageSection } from "./front-page-section";
import { HalftoneDefs } from "./halftone-defs";
import { ImprintFooter } from "./imprint-footer";
import { LettersSection } from "./letters-section";
import { Masthead } from "./masthead";
import { MenuSection } from "./menu-section";
import { NewsroomSection } from "./newsroom-section";
import { PressSection } from "./press-section";
import { RoastSection } from "./roast-section";
import { StopPressBand } from "./stop-press-band";

/** The page, in the order of the paper: page 1, page 2, the press, stop press, pages 3, 4, and 5. */
export function LandingPage() {
	const rootRef = useRef<HTMLDivElement>(null);
	usePressRoll(rootRef);

	return (
		<div ref={rootRef} className="ks-page min-h-svh">
			<HalftoneDefs />
			<Masthead />
			<main>
				<FrontPageSection />
				<RoastSection />
				<PressSection />
				<StopPressBand />
				<MenuSection />
				<ArchivesSection />
				<NewsroomSection />
				<LettersSection />
			</main>
			<ImprintFooter />
		</div>
	);
}
