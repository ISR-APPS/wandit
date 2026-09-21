/**
 * Live task list of one builder turn: a title, a percent bar, and the steps.
 * Rendered by chat-message.tsx for each `data-progress` part.
 * Pure presentation: the part data decides every icon and the bar.
 */

import { Progress } from "@wandit/ui/components/progress";
import { cn } from "@wandit/ui/lib/utils";
import { Circle, CircleCheck, LoaderCircle } from "lucide-react";

import { formatNumber, useTranslation } from "@/lib/i18n";
import type { BuilderProgressStep } from "../../api/dto";

export type ProgressCardProps = {
	title: string;
	/** 0 to 100. At 100 the spinner becomes a check mark. */
	percent: number;
	steps: BuilderProgressStep[];
};

export function ProgressCard({ title, percent, steps }: ProgressCardProps) {
	const { locale } = useTranslation();
	// The turn is done at 100, so the header stops spinning.
	const isDone = percent >= 100;
	const HeaderIcon = isDone ? CircleCheck : LoaderCircle;

	return (
		<div className="rounded-2xl border bg-card p-4">
			<div className="flex items-center gap-2">
				<HeaderIcon
					className={cn(
						"size-4 shrink-0 text-primary",
						!isDone && "animate-spin",
					)}
					aria-hidden
				/>
				<span
					dir="auto"
					className="min-w-0 flex-1 truncate font-semibold text-sm"
				>
					{title}
				</span>
				<span className="text-muted-foreground text-xs tabular-nums">
					{formatNumber(percent, locale)}%
				</span>
			</div>
			<Progress value={percent} className="mt-3 h-[3px]" />
			<ul className="mt-3 flex flex-col gap-2 text-sm">
				{steps.map((step) => (
					<li
						key={step.id}
						data-step-state={step.state}
						className={cn(
							"flex items-center gap-2",
							step.state === "pending" ? "text-faint" : "text-foreground",
						)}
					>
						{/* The design shows the active step with no circle: only the label and the caret. */}
						{step.state === "done" ? (
							<CircleCheck
								className="size-3.5 shrink-0 text-primary"
								aria-hidden
							/>
						) : null}
						{step.state === "pending" ? (
							<Circle className="size-3.5 shrink-0 text-faint" aria-hidden />
						) : null}
						<span dir="auto">{step.label}</span>
						{step.state === "active" ? (
							<span
								className="ms-1 inline-block h-3.5 w-px animate-caret bg-foreground"
								aria-hidden
							/>
						) : null}
					</li>
				))}
			</ul>
		</div>
	);
}
