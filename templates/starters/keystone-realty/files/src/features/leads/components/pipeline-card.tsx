// The open pipeline of the leads page: one bar per stage, and the answer figures of the last 30 days.
// LeadsPage renders it. A click on a stage sets the status tab of the table to that stage.
import {
	ANSWER_TARGET_HOURS,
	fillMessage,
	formatDuration,
	type LeadStatus,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { AnswerStats, PipelineStage } from "../lib/lead-stats";

/** The bar color of each open stage. It follows the badge color of the status. */
const STAGE_BARS = {
	new: "bg-warning",
	contacted: "bg-chart-2",
	viewing: "bg-info",
	offer: "bg-primary",
} satisfies Record<PipelineStage["status"], string>;

type PipelineCardProps = {
	/** The open stages with their counts, in the order of the work. They follow the source filter, like the tab counts. */
	stages: PipelineStage[];
	/** The answer figures of the last 30 days, for the leads of the source filter. */
	stats: AnswerStats;
	/** The status tab of the table, or undefined for the "All" tab. The bar of this stage is marked. */
	activeStatus: LeadStatus | undefined;
	/** Called with a stage when the user picks its bar, and with undefined when the user picks it again. */
	onStatusChange: (status: LeadStatus | undefined) => void;
};

/** The longest bar is the stage with the most leads. The other bars have a length in proportion. */
export function PipelineCard({
	stages,
	stats,
	activeStatus,
	onStatusChange,
}: PipelineCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const openCount = stages.reduce((sum, stage) => sum + stage.count, 0);
	const largest = Math.max(1, ...stages.map((stage) => stage.count));
	const figures = [
		{
			id: "median",
			label: t("leads.stats.medianAnswer"),
			value:
				stats.medianMinutes === null
					? "–"
					: formatDuration(stats.medianMinutes, locale),
		},
		{
			id: "in-target",
			label: fillMessage(t("leads.stats.inTarget"), {
				hours: number.format(ANSWER_TARGET_HOURS),
			}),
			value:
				stats.inTargetShare === null
					? "–"
					: percent.format(stats.inTargetShare),
		},
		{
			id: "won",
			label: t("leads.stats.won"),
			value: number.format(stats.wonCount),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("leads.pipelineTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("leads.pipelineDescription"), {
						count: number.format(openCount),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-5">
				<ul className="-mx-2 grid flex-1 content-around gap-1">
					{stages.map((stage) => (
						<li key={stage.status}>
							<button
								type="button"
								aria-pressed={activeStatus === stage.status}
								// A stage with no lead has no tab in the table, so it has nothing to show.
								disabled={stage.count === 0}
								onClick={() =>
									onStatusChange(
										activeStatus === stage.status ? undefined : stage.status,
									)
								}
								className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-md px-2 py-2 text-start outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60 aria-pressed:bg-muted max-sm:py-3"
							>
								<span className="text-sm">
									{t(`agency.leadStatuses.${stage.status}`)}
								</span>
								<span className="h-3 overflow-hidden rounded-full bg-border/70">
									<span
										className={cn(
											"block h-full rounded-full",
											STAGE_BARS[stage.status],
										)}
										// The bar length is a share of the largest stage, so it is a data value, not a spacing.
										style={{ width: `${(stage.count / largest) * 100}%` }}
									/>
								</span>
								<span className="text-end font-numeric text-lg tabular-nums leading-none">
									{number.format(stage.count)}
								</span>
							</button>
						</li>
					))}
				</ul>
				<dl className="mt-auto grid grid-cols-3 gap-4 border-t pt-5">
					{/* A label can wrap on a phone. The cells share one height, so the values sit on one line at the bottom. */}
					{figures.map((figure) => (
						<div key={figure.id} className="grid grid-rows-[1fr_auto] gap-1">
							<dt className="text-muted-foreground text-xs">{figure.label}</dt>
							<dd className="font-numeric text-xl tabular-nums leading-none">
								{figure.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
