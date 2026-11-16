// "Practice areas", the showpiece drawer: five folders on the start side, one panel per area on the end side.
// LandingPage renders it. On a wide screen the drawer stays in view, and the folder of the panel in reading position
// slides 34px forward with a brass tab. The tabs fan out of one stack when the drawer enters the screen.
// With no script every panel is in the page and every folder is an anchor, so the section reads complete.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { useActivePractice } from "../hooks/use-active-practice";
import { useFanProgress } from "../hooks/use-fan-progress";
import { PRACTICE_IDS } from "../lib/content";
import { PracticeFolder } from "./practice-folder";
import { PracticePanel } from "./practice-panel";
import { SectionHead } from "./section-head";

/** The drawer and its five panels. The current folder follows the scroll; a click on a folder jumps to its panel. */
export function PracticesSection() {
	const { t } = useT();
	const drawerRef = useRef<HTMLElement>(null);
	const panelsRef = useRef<HTMLDivElement>(null);
	const fan = useFanProgress(drawerRef);
	const activeIndex = useActivePractice(panelsRef);
	return (
		<section
			id="practices"
			aria-labelledby="practices-title"
			className="vt-section"
		>
			<div className="vt-wrap">
				<SectionHead tab="practices.tab" note="practices.note" />
				<h2 id="practices-title" className="sr-only">
					{t("practices.title")}
				</h2>
				<div className="grid gap-12 lg:grid-cols-[0.85fr_1.4fr] lg:gap-[clamp(2rem,4vw,4.5rem)]">
					<nav
						ref={drawerRef}
						aria-label={t("practices.indexLabel")}
						className="flex flex-col gap-2.5 self-start lg:sticky lg:top-28 lg:pe-9"
					>
						{PRACTICE_IDS.map((id, index) => (
							<PracticeFolder
								key={id}
								id={id}
								index={index}
								fan={fan}
								isCurrent={index === activeIndex}
							/>
						))}
					</nav>
					<div ref={panelsRef}>
						{PRACTICE_IDS.map((id, index) => (
							<PracticePanel
								key={id}
								id={id}
								index={index}
								total={PRACTICE_IDS.length}
							/>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
