// The showpiece of the page: the path of the money, from the shop to the accountant.
// LandingPage renders it. From 1024px it shows PathDiagram and three numbered steps.
// The scroll hook sets --fw-path on the scene, and landing.css draws the lit path from it.
// Under 1024px it shows PathRail.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	type ScrollProgressOf,
	useScrollProgress,
} from "../hooks/use-scroll-progress";
import { SECTION_SPACE, WRAP } from "../lib/class-names";
import { PathDiagram } from "./path-diagram";
import { PathRail } from "./path-rail";
import { SectionHead } from "./section-head";

// 0 when the top of the scene is at 85% of the screen height, 1 when it is at 18%.
// So the path draws over two thirds of a screen of scroll, and ends with the whole diagram in view.
const pathProgressOf: ScrollProgressOf = (rect, viewportHeight) =>
	(viewportHeight * 0.85 - rect.top) / (viewportHeight * 0.67);

// The three beats of the diagram. landing.css lights each step when its beat starts.
const STEPS = [
	{ textKey: "path.step1", beatClassName: "fw-step-send" },
	{ textKey: "path.step2", beatClassName: "fw-step-pay" },
	{ textKey: "path.step3", beatClassName: "fw-step-g50" },
] as const;

/** The progress never goes down: a drawn path stays drawn when the visitor scrolls up again. */
export function PathSection() {
	const { t } = useT();
	const sceneRef = useRef<HTMLDivElement>(null);
	useScrollProgress(sceneRef, "--fw-path", pathProgressOf, {
		keepsHighest: true,
	});
	return (
		<section
			id="path"
			aria-label={t("path.label")}
			className={cn("bg-background", SECTION_SPACE)}
		>
			<div className={WRAP}>
				<SectionHead
					label={t("path.label")}
					title={t("path.title")}
					lead={t("path.lead")}
					align="center"
				/>
				<div
					ref={sceneRef}
					data-reveal
					className="fw-path-scene mt-4 hidden lg:block"
				>
					<PathDiagram />
					<ol className="mx-auto mt-9 grid max-w-[1000px] grid-cols-3 gap-7">
						{STEPS.map((step, index) => (
							<li
								key={step.textKey}
								className={cn(
									"fw-step flex items-start gap-3",
									step.beatClassName,
								)}
							>
								<span className="fw-step-number grid size-7 shrink-0 place-items-center rounded-full font-bold font-display text-[0.82rem] tabular-nums">
									{index + 1}
								</span>
								<p className="pt-0.5 text-[0.95rem] text-muted-foreground leading-normal">
									{t(step.textKey)}
								</p>
							</li>
						))}
					</ol>
				</div>
				<PathRail />
			</div>
		</section>
	);
}
