// The hiring funnel card of the home: the candidates of the open positions per stage now, and the hires of the period.
// DashboardPage renders it in the middle grid with the summary of the chosen period.
// It follows the pipeline list of recipe 3.3: a stacked share bar, then one row per stage with a progress bar.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, STAGE_DOT } from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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
import type { FunnelRow } from "../api/dashboard.queries";

type HiringFunnelCardProps = {
	/** The five board stages, applied to hired, in order. */
	stages: FunnelRow[];
};

/** The share of a row is its part of the people of all rows. Each row names its stage, so the color is never the only mark. */
export function HiringFunnelCard({ stages }: HiringFunnelCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const total = stages.reduce((sum, row) => sum + row.count, 0);
	const shareOf = (count: number) => (total === 0 ? 0 : count / total);
	const detailOf = (row: FunnelRow) =>
		fillMessage(t("dashboard.funnelDetail"), {
			count: number.format(row.count),
			positions: number.format(row.positions),
		});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.funnelTitle")}</CardTitle>
				<CardDescription>{t("dashboard.funnelDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/hiring">
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
					{stages.map((row) => (
						<Tooltip key={row.stage}>
							<TooltipTrigger asChild>
								<span
									className={cn("h-full", STAGE_DOT[row.stage])}
									style={{ width: `${shareOf(row.count) * 100}%` }}
								/>
							</TooltipTrigger>
							<TooltipContent>
								{`${t(`stages.${row.stage}`)}: ${detailOf(row)}`}
							</TooltipContent>
						</Tooltip>
					))}
				</div>
				<ul className="grid gap-4">
					{stages.map((row) => (
						<li key={row.stage} className="flex items-center gap-4">
							<span
								aria-hidden="true"
								className={cn(
									"size-3 shrink-0 rounded-full",
									STAGE_DOT[row.stage],
								)}
							/>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate font-medium text-sm">
									{row.stage === "hired"
										? t("dashboard.hiredInPeriod")
										: t(`stages.${row.stage}`)}
								</span>
								<span className="truncate text-muted-foreground text-xs tabular-nums">
									{detailOf(row)}
								</span>
							</span>
							<Progress
								value={shareOf(row.count) * 100}
								className="h-1.5 w-16"
								aria-label={t(`stages.${row.stage}`)}
							/>
							<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
								{percent.format(shareOf(row.count))}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
