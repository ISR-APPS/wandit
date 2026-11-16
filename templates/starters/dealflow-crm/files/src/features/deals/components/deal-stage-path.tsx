// The stage path of one deal: one step per stage, with the day the deal entered it and the time it stayed.
// DealDetailPage renders it at the top of the main column. It reads the stage history of the deal.
// An open or a won deal shows the five stages of the winning path. A lost deal shows the stages it reached, then "Lost".
import { FlagPennantIcon } from "@phosphor-icons/react";
import {
	DAY_MS,
	type DealStage,
	dayCountFormat,
	isOpenStage,
	WINNING_PATH,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import type { DealDetail } from "../api/deals.queries";
import { daysInStage, isStalled } from "../lib/deal-attention";

type DealStagePathProps = {
	deal: DealDetail;
	/** The current time in milliseconds since 1970. The time in the current stage counts from it. */
	now: number;
};

/** A row of segments from the 2xl container width. Below it, a list with one segment at the start of each row. */
export function DealStagePath({ deal, now }: DealStagePathProps) {
	const { t, locale } = useT();
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const dayCount = dayCountFormat(locale);

	const steps: readonly DealStage[] =
		deal.stage === "lost"
			? deal.stageHistory.map((change) => change.stage)
			: WINNING_PATH;
	const stalled = isStalled(deal, now);

	return (
		<ol className="grid @2xl/main:auto-cols-fr @2xl/main:grid-flow-col @2xl/main:gap-2 gap-3">
			{steps.map((stage) => {
				const historyIndex = deal.stageHistory.findIndex(
					(change) => change.stage === stage,
				);
				const entered = deal.stageHistory[historyIndex];
				const next = deal.stageHistory[historyIndex + 1];
				const isCurrent = stage === deal.stage;
				// Whole days from the move into this stage to the move out of it. The current stage of an open deal runs until now.
				const days = entered
					? next
						? Math.round(
								(Date.parse(next.changedAt) - Date.parse(entered.changedAt)) /
									DAY_MS,
							)
						: isOpenStage(stage)
							? daysInStage(deal, now)
							: null
					: null;
				return (
					<li
						key={stage}
						aria-current={isCurrent ? "step" : undefined}
						className="grid @2xl/main:grid-cols-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2"
					>
						<span
							className={cn(
								"@2xl/main:h-1.5 h-9 @2xl/main:w-full w-1.5 rounded-full",
								!entered
									? "bg-muted"
									: stage === "won"
										? "bg-success"
										: stage === "lost"
											? "bg-destructive"
											: isCurrent
												? "bg-primary"
												: "bg-primary/35",
							)}
						/>
						<div className="grid min-w-0 gap-0.5">
							<span
								className={cn(
									"text-sm",
									isCurrent ? "font-semibold" : "font-medium",
									!entered && "text-muted-foreground",
								)}
							>
								{t(`stages.${stage}`)}
							</span>
							<span className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs tabular-nums">
								{entered ? (
									<>
										<time dateTime={entered.changedAt}>
											{shortDate.format(new Date(entered.changedAt))}
										</time>
										{days === null ? null : (
											<>
												<span aria-hidden="true">·</span>
												{isCurrent && stalled ? (
													<span className="inline-flex items-center gap-1 font-medium text-warning">
														<FlagPennantIcon className="size-3.5" />
														{dayCount.format(days)}
													</span>
												) : (
													<span>{dayCount.format(days)}</span>
												)}
											</>
										)}
									</>
								) : (
									t("deals.notReached")
								)}
							</span>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
