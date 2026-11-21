// The workload card of the home: the open tickets that each agent owns now, and the unassigned ones.
// DashboardPage renders it last in the middle grid. "View all" opens the ticket list.
// It follows the pipeline list of recipe 3.3: a stacked share bar, then one row per agent with a progress bar.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { AgentLoad } from "../api/dashboard.queries";

type WorkloadCardProps = {
	/** The 4 busiest agents, then the unassigned row. At most 5 rows, one chart color each. */
	workload: AgentLoad[];
	/** All open tickets now, also the agents that the card does not show. The same figure as the "Open tickets" KPI. */
	openTotal: number;
};

/** The share of a row is its part of all open tickets. The muted rest of the bar is the agents the card does not show. */
export function WorkloadCard({ workload, openTotal }: WorkloadCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const shareOf = (open: number) => (openTotal === 0 ? 0 : open / openTotal);
	const nameOf = (row: AgentLoad) => row.name ?? t("tickets.unassigned");
	const detailOf = (row: AgentLoad) =>
		fillMessage(t("dashboard.loadDetail"), {
			open: number.format(row.open),
			late: number.format(row.late),
		});
	// The rows take the chart series 1 to 5 in order, so the bar and the dots match.
	const colorOf = (index: number) => `var(--chart-${index + 1})`;

	return (
		// In the 2-column middle grid of DashboardPage, this card is the full row under the other two.
		<Card className="@2xl/main:col-span-2 @4xl/main:col-span-1">
			<CardHeader>
				<CardTitle>{t("dashboard.workloadTitle")}</CardTitle>
				<CardDescription>{t("dashboard.workloadDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/tickets">
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
					{workload.map((row, index) => (
						<Tooltip key={row.id}>
							<TooltipTrigger asChild>
								<span
									className="h-full"
									style={{
										width: `${shareOf(row.open) * 100}%`,
										backgroundColor: colorOf(index),
									}}
								/>
							</TooltipTrigger>
							<TooltipContent>{`${nameOf(row)}: ${detailOf(row)}`}</TooltipContent>
						</Tooltip>
					))}
				</div>
				<ul className="grid gap-4">
					{workload.map((row, index) => (
						<li key={row.id} className="flex items-center gap-4">
							<span
								aria-hidden="true"
								className="size-3 shrink-0 rounded-full"
								style={{ backgroundColor: colorOf(index) }}
							/>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<bdi className="truncate font-medium text-sm">
									{nameOf(row)}
								</bdi>
								<span className="truncate text-muted-foreground text-xs tabular-nums">
									{detailOf(row)}
								</span>
							</span>
							<Progress
								value={shareOf(row.open) * 100}
								className="h-1.5 w-16"
								aria-label={nameOf(row)}
							/>
							<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
								{percent.format(shareOf(row.open))}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
