// The status steps of one entry as a short vertical timeline: done, upcoming, or failed.
// TransactionDetailPage renders it in its rail, beside the facts. The steps come from buildTransactionDetail.
import { ClockIcon } from "@phosphor-icons/react";
import { dayFormat, dayToDate, fillMessage } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CheckCircleIcon, XCircleIcon } from "~/shared/ui/icons";
import type { StatusStep } from "../lib/transaction-detail";

type StatusTimelineProps = {
	/** The steps, oldest first. */
	steps: StatusStep[];
};

// The icon and the color of each state. The label text says the state too.
const STATE_ICON = {
	done: CheckCircleIcon,
	upcoming: ClockIcon,
	failed: XCircleIcon,
} as const;

/** A line joins the steps. An upcoming step shows its expected day. */
export function StatusTimeline({ steps }: StatusTimelineProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");
	return (
		<ol className="grid gap-0">
			{steps.map((step, index) => {
				const Icon = STATE_ICON[step.state];
				const dayText = day.format(dayToDate(step.day));
				return (
					<li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
						{index < steps.length - 1 ? (
							<span
								aria-hidden="true"
								className="absolute start-2.5 top-6 bottom-0 w-px bg-border"
							/>
						) : null}
						<Icon
							className={cn(
								"size-5 shrink-0",
								step.state === "done" && "text-success",
								step.state === "upcoming" && "text-muted-foreground",
								step.state === "failed" && "text-destructive",
							)}
						/>
						<div className="grid gap-0.5">
							<span className="font-medium text-sm">
								{t(`transactionDetail.steps.${step.id}`)}
							</span>
							<span className="text-muted-foreground text-sm tabular-nums">
								{step.state === "upcoming"
									? fillMessage(t("transactionDetail.expected"), {
											day: dayText,
										})
									: dayText}
							</span>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
