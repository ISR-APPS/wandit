// The phase timeline of one fixed or hourly project: discovery, design, production, review, then delivery.
// The project detail page renders it in its rail. Each phase shows its date range; the current one is marked.
import {
	addDays,
	daysBetween,
	PHASE_ENDS,
	type Phase,
	TIMELINE_PHASES,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CheckIcon } from "~/shared/ui/icons";

type PhaseTimelineCardProps = {
	startDay: string;
	dueDay: string;
	/** The phase of the project now. "delivered" marks every step done. */
	phase: Phase;
};

/** A vertical list of steps. A done step has a check, the current step a filled dot. */
export function PhaseTimelineCard({
	startDay,
	dueDay,
	phase,
}: PhaseTimelineCardProps) {
	const { t } = useT();
	const format = useFormatters();
	const durationDays = daysBetween(startDay, dueDay);
	let previousEnd = 0;
	const steps = TIMELINE_PHASES.map((step) => {
		const from = addDays(startDay, Math.round(durationDays * previousEnd));
		previousEnd = PHASE_ENDS[step];
		const to = addDays(startDay, Math.round(durationDays * PHASE_ENDS[step]));
		return { step, from, to };
	});
	// A delivered project has every step done, so its current index is past the last step.
	const currentIndex =
		phase === "delivered"
			? steps.length
			: steps.findIndex((row) => row.step === phase);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("projectDetail.timeline")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="grid">
					{steps.map(({ step, from, to }, index) => {
						const state =
							index < currentIndex
								? "done"
								: index === currentIndex
									? "current"
									: "next";
						return (
							<li
								key={step}
								className="relative grid grid-cols-[1.5rem_1fr] gap-3 pb-5"
							>
								{/* The rail between two dots. */}
								<span
									aria-hidden="true"
									className="absolute start-3 top-6 bottom-0 w-px -translate-x-1/2 bg-border rtl:translate-x-1/2"
								/>
								<span
									className={cn(
										"z-10 flex size-6 items-center justify-center rounded-full border",
										state === "done" &&
											"border-primary bg-primary text-primary-foreground",
										state === "current" &&
											"border-primary bg-secondary text-secondary-foreground",
										state === "next" && "bg-card",
									)}
								>
									{state === "done" ? <CheckIcon className="size-3.5" /> : null}
									{state === "current" ? (
										<span className="size-2 rounded-full bg-primary" />
									) : null}
								</span>
								<div className="grid gap-0.5">
									<p
										className={cn(
											"text-sm",
											state === "current" ? "font-semibold" : "font-medium",
										)}
									>
										{t(`codes.phases.${step}`)}
										{state === "current" ? (
											<span className="ms-2 font-normal text-muted-foreground text-xs">
												{t("projectDetail.now")}
											</span>
										) : null}
									</p>
									<p className="text-muted-foreground text-xs tabular-nums">
										{`${format.shortDate(from)} – ${format.shortDate(to)}`}
									</p>
								</div>
							</li>
						);
					})}
					<li className="grid grid-cols-[1.5rem_1fr] gap-3">
						<span
							className={cn(
								"flex size-6 items-center justify-center rounded-full border",
								phase === "delivered"
									? "border-success bg-success text-card"
									: "bg-card",
							)}
						>
							{phase === "delivered" ? (
								<CheckIcon className="size-3.5" />
							) : null}
						</span>
						<div className="grid gap-0.5">
							<p className="font-medium text-sm">
								{t("codes.phases.delivered")}
							</p>
							<p className="text-muted-foreground text-xs tabular-nums">
								{format.longDate(dueDay)}
							</p>
						</div>
					</li>
				</ol>
			</CardContent>
		</Card>
	);
}
