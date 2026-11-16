// PL·02, the held breath of the page: the villa plan draws itself in plotter order.
// LandingPage renders it after the hero. From 1024px the scroll drives --plot while the plan comes into view
// (use-plan-progress.ts). On a phone the plan plots once when it enters the screen.
import { useRef } from "react";
import { PlanRail } from "./plan-rail";
import { VillaPlan } from "./villa-plan";

/** The rail on the start side (300px), the stage with the plan on the rest of the width. */
export function PlanSection() {
	const stageRef = useRef<HTMLDivElement>(null);
	return (
		<section
			id="plan"
			aria-labelledby="plan-title"
			className="ns-paper-2 scroll-mt-(--ns-bar) border-foreground/15 border-y"
		>
			<div className="py-[clamp(4rem,9vh,6rem)]">
				<div className="ns-wrap grid items-center gap-10 lg:grid-cols-[300px_1fr] lg:gap-[clamp(2rem,4vw,4rem)]">
					<PlanRail stageRef={stageRef} />
					<div
						ref={stageRef}
						data-reveal
						className="ns-figure ns-plan-stage flex justify-center"
					>
						<VillaPlan />
					</div>
				</div>
			</div>
		</section>
	);
}
