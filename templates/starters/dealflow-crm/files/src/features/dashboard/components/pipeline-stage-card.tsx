// The pipeline card of the home: the open deals of each stage now, and the deals won in the period.
// DashboardPage renders it in the middle grid with the summary of the chosen period.
// It follows the pipeline list of recipe 3.3: a stacked share bar, then one row per stage with a progress bar.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, moneyFormat, STAGE_DOT } from "~/features/crm";
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
import type { StageTotal } from "../api/dashboard.queries";

type PipelineStageCardProps = {
	/** The four open stages, then the won deals of the period. */
	stages: StageTotal[];
};

/** The share of each row is its part of the sum of the amounts of all rows. Each row names its stage, so the color is never the only mark. */
export function PipelineStageCard({ stages }: PipelineStageCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const totalAmount = stages.reduce((sum, row) => sum + row.amount, 0);
	const shareOf = (amount: number) =>
		totalAmount === 0 ? 0 : amount / totalAmount;
	const detailOf = (row: StageTotal) =>
		fillMessage(t("dashboard.stageDetail"), {
			count: number.format(row.count),
			amount: money.format(row.amount),
		});

	return (
		// In the 2-column middle grid of DashboardPage, this card is the full row under the other two.
		<Card className="@2xl/main:col-span-2 @4xl/main:col-span-1">
			<CardHeader>
				<CardTitle>{t("dashboard.pipelineTitle")}</CardTitle>
				<CardDescription>{t("dashboard.pipelineDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/deals">
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
									style={{ width: `${shareOf(row.amount) * 100}%` }}
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
									{row.stage === "won"
										? t("dashboard.wonInPeriod")
										: t(`stages.${row.stage}`)}
								</span>
								<span className="truncate text-muted-foreground text-xs tabular-nums">
									{detailOf(row)}
								</span>
							</span>
							<Progress
								value={shareOf(row.amount) * 100}
								className="h-1.5 w-16"
								aria-label={t(`stages.${row.stage}`)}
							/>
							<span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
								{percent.format(shareOf(row.amount))}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
