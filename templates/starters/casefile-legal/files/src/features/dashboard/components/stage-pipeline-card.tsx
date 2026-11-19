// The third card of the middle grid: the open matters of each stage now, and the matters closed in the period.
// DashboardPage renders it with the summary of the chosen period. It takes the place of the kit sales pipeline.
// It follows the pipeline list of recipe 3.3: a stacked share bar, then one row per stage with a progress bar.
import {
	fillMessage,
	hoursFormat,
	MATTER_STAGE_DOT,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { StageRow } from "../lib/dashboard";

type StagePipelineCardProps = {
	/** The four open stages, then the matters closed in the period. */
	stages: StageRow[];
};

/** The share of each row is its part of the matter count of all rows. Each row names its stage, so the color is never the only mark. */
export function StagePipelineCard({ stages }: StagePipelineCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const hours = hoursFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const totalCount = stages.reduce((sum, row) => sum + row.count, 0);
	const shareOf = (count: number) =>
		totalCount === 0 ? 0 : count / totalCount;
	const detailOf = (row: StageRow) =>
		fillMessage(t("dashboard.stageDetail"), {
			count: number.format(row.count),
			hours: hours.format(row.hours),
		});
	const labelOf = (row: StageRow) =>
		row.stage === "closed"
			? t("dashboard.closedInPeriod")
			: t(`stages.${row.stage}`);

	return (
		// In the 2-column middle grid of DashboardPage, this card is the full row under the other two.
		<Card className="@2xl/main:col-span-2 @4xl/main:col-span-1">
			<CardHeader>
				<CardTitle>{t("dashboard.stagesTitle")}</CardTitle>
				<CardDescription>{t("dashboard.stagesDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
					{stages.map((row) => (
						<Tooltip key={row.stage}>
							<TooltipTrigger asChild>
								<span
									className={cn("h-full", MATTER_STAGE_DOT[row.stage])}
									style={{ width: `${shareOf(row.count) * 100}%` }}
								/>
							</TooltipTrigger>
							<TooltipContent>{`${labelOf(row)}: ${detailOf(row)}`}</TooltipContent>
						</Tooltip>
					))}
				</div>
				<ul className="grid gap-4">
					{stages.map((row) => (
						<li key={row.stage} className="flex items-center gap-3">
							<span
								aria-hidden="true"
								className={cn(
									"size-3 shrink-0 rounded-full",
									MATTER_STAGE_DOT[row.stage],
								)}
							/>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate font-medium text-sm">
									{labelOf(row)}
								</span>
								<span className="truncate text-muted-foreground text-xs tabular-nums">
									{detailOf(row)}
								</span>
							</span>
							<Progress
								value={shareOf(row.count) * 100}
								className="h-1.5 w-20"
								aria-label={labelOf(row)}
							/>
							<span className="w-9 text-end text-muted-foreground text-xs tabular-nums">
								{percent.format(shareOf(row.count))}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
