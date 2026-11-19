// The pipeline card of the leads page, in a stage-list layout: a stacked share bar,
// then one row per stage with a dot, the count and the value, a bar, and the share.
// LeadsPage renders it with the summary of the period. A row is a button that filters the table by its stage.
import { fillMessage, type LeadStatus, moneyFormat } from "~/features/agency";
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
import type { PipelineRow } from "../lib/lead-stats";

// The dot and the bar part of each row, from the chart series, in the order of the work.
const STAGE_FILL = {
	new: "bg-chart-1",
	contacted: "bg-chart-2",
	viewing: "bg-chart-3",
	offer: "bg-chart-4",
	won: "bg-chart-5",
} satisfies Record<PipelineRow["stage"], string>;

type PipelineCardProps = {
	/** The four open stages now, then the leads won in the period. */
	rows: PipelineRow[];
	/** The status filter of the table. Its row is marked. */
	activeStatus: LeadStatus | undefined;
	/** Gets a stage when the user picks its row, and undefined when the user picks the marked row again. */
	onStatusChange: (status: LeadStatus | undefined) => void;
};

/** The share of a row is its part of the sum of the counts. Each row names its stage, so the color is never the only mark. */
export function PipelineCard({
	rows,
	activeStatus,
	onStatusChange,
}: PipelineCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
	const shareOf = (count: number) =>
		totalCount === 0 ? 0 : count / totalCount;
	const nameOf = (row: PipelineRow) =>
		row.stage === "won"
			? t("leads.pipeline.wonInPeriod")
			: t(`agency.leadStatuses.${row.stage}`);

	return (
		<Card className="@2xl/main:col-span-2 @5xl/main:col-span-1">
			<CardHeader>
				<CardTitle>{t("leads.pipeline.title")}</CardTitle>
				<CardDescription>{t("leads.pipeline.description")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div
					aria-hidden="true"
					className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
				>
					{rows.map((row) => (
						<span
							key={row.stage}
							className={cn("h-full", STAGE_FILL[row.stage])}
							style={{ width: `${shareOf(row.count) * 100}%` }}
						/>
					))}
				</div>
				<ul className="grid gap-1">
					{rows.map((row) => {
						const isActive = row.stage === activeStatus;
						return (
							<li key={row.stage}>
								<button
									type="button"
									aria-pressed={isActive}
									onClick={() =>
										onStatusChange(isActive ? undefined : row.stage)
									}
									className={cn(
										"flex w-full items-center gap-4 rounded-md p-2 text-start hover:bg-muted/50",
										isActive && "bg-muted",
									)}
								>
									<span
										aria-hidden="true"
										className={cn(
											"size-3 shrink-0 rounded-full",
											STAGE_FILL[row.stage],
										)}
									/>
									<span className="grid min-w-0 flex-1 gap-0.5">
										<span className="truncate font-medium text-sm">
											{nameOf(row)}
										</span>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{fillMessage(t("leads.pipeline.detail"), {
												count: number.format(row.count),
												amount: money.format(row.amount),
											})}
										</span>
									</span>
									<Progress
										value={shareOf(row.count) * 100}
										className="h-1.5 w-16"
										aria-label={nameOf(row)}
									/>
									<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
										{percent.format(shareOf(row.count))}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
