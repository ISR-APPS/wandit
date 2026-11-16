// The side rail of the plan: the folio, the title, the six plotter phases, and the "Trace — NN %" readout.
// PlanSection renders it next to the stage. It owns the scroll progress, so only the rail renders again on scroll.
// A phase is "todo", "on" while the plotter draws it, or "done". The last phase, the red visa, stays "on" at the end.
import type { RefObject } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { usePlanProgress } from "../hooks/use-plan-progress";
import { PLAN_PHASE_STARTS, PLAN_PHASES } from "../lib/content";
import { BODY, LABEL } from "../lib/styles";

type PlanRailProps = {
	/** The element that carries --plot for the plan drawing. */
	stageRef: RefObject<HTMLDivElement | null>;
};

type PhaseState = "todo" | "on" | "done";

/** The state of phase `index` at `progress` (0 to 1). */
function phaseStateOf(index: number, progress: number): PhaseState {
	const start = PLAN_PHASE_STARTS[index] ?? 1;
	const end = PLAN_PHASE_STARTS[index + 1] ?? 1;
	const isLast = index === PLAN_PHASES.length - 1;
	if (progress <= 0 || progress < start) {
		return "todo";
	}
	// The red visa is the payoff: it stays lit when the plan is complete.
	return progress >= end && !isLast ? "done" : "on";
}

/** On a phone the phases form a static row of tags under the text. */
export function PlanRail({ stageRef }: PlanRailProps) {
	const { t } = useT();
	const percent = usePlanProgress(stageRef);
	const progress = percent / 100;
	return (
		<div>
			<span
				className={`${LABEL} inline-block border-[1.5px] border-foreground px-2.5 py-1`}
			>
				{t("plan.folio")}
			</span>
			<h2
				id="plan-title"
				className="ns-title mt-4 mb-4 text-balance text-[clamp(1.8rem,3vw,2.5rem)] leading-[1.06]"
			>
				{t("plan.title")}
			</h2>
			<p className={`${BODY} max-w-[38ch] text-[0.95rem] leading-[1.65]`}>
				{t("plan.body")}
			</p>
			<ol
				aria-label={t("plan.phasesLabel")}
				className="mt-7 flex flex-wrap gap-2 lg:block"
			>
				{PLAN_PHASES.map((phase, index) => {
					const state = phaseStateOf(index, progress);
					const isVisa = index === PLAN_PHASES.length - 1;
					return (
						<li
							key={phase}
							className={cn(
								LABEL,
								"border px-2.5 py-1.5 font-normal text-xs transition-colors duration-150 ease-linear lg:border-0 lg:border-s-2 lg:px-0 lg:py-2 lg:ps-3.5",
								state === "todo" && "border-foreground/12 text-foreground/55",
								state === "done" && "border-foreground/35 text-foreground/70",
								state === "on" &&
									(isVisa
										? "border-primary text-primary"
										: "border-(--ns-cyan) text-foreground"),
							)}
						>
							<span className="me-2.5 tabular-nums">
								{String(index + 1).padStart(2, "0")}
							</span>
							{t(phase)}
						</li>
					);
				})}
			</ol>
			<p
				aria-hidden="true"
				className={`${LABEL} mt-6 font-normal text-xs tabular-nums`}
			>
				{t("plan.trace")} {percent}&nbsp;%
			</p>
		</div>
	);
}
