// The status card of the transaction detail page: the three steps of an entry with their days.
// TransactionDetailPage renders it in the rail. The steps come from buildTimeline.
import { CircleDashedIcon } from "@phosphor-icons/react";
import { dayFormat, dayToDate } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CheckCircleIcon } from "~/shared/ui/icons";
import type { TimelineStep } from "../lib/transaction-detail";

type StatusTimelineProps = {
	/** The steps in the order of the work. A step with no day did not happen yet. */
	steps: TimelineStep[];
};

/** A done step shows its day. An open step shows what the entry waits for. */
export function StatusTimeline({ steps }: StatusTimelineProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("transactions.timeline")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="grid">
					{steps.map((step, index) => {
						const isDone = step.day !== null;
						const isLast = index === steps.length - 1;
						return (
							<li key={step.status} className="flex gap-3">
								<div className="flex flex-col items-center">
									{isDone ? (
										<CheckCircleIcon
											weight="fill"
											className="size-5 shrink-0 text-success"
										/>
									) : (
										<CircleDashedIcon className="size-5 shrink-0 text-muted-foreground" />
									)}
									{/* The line joins this step to the next one. */}
									{isLast ? null : (
										<span
											aria-hidden="true"
											className={cn(
												"my-1 w-px flex-1",
												isDone ? "bg-success/50" : "bg-border",
											)}
										/>
									)}
								</div>
								<div className={cn("grid gap-0.5", isLast ? "pb-0" : "pb-5")}>
									<p
										className={cn(
											"font-medium text-sm leading-5",
											!isDone && "text-muted-foreground",
										)}
									>
										{t(`transactions.steps.${step.status}`)}
									</p>
									<p className="text-muted-foreground text-xs tabular-nums">
										{step.day
											? day.format(dayToDate(step.day))
											: t(
													step.status === "reconciled"
														? "transactions.waitingReconciled"
														: "transactions.waitingCleared",
												)}
									</p>
								</div>
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
