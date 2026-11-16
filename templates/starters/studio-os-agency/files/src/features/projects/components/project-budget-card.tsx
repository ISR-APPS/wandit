// The money and the key facts of one project: budget, spend, what is left, the burn meter, and a list of facts.
// The project detail page renders it first in its main column.
import {
	BurnMeter,
	type ProjectSummary,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";

type ProjectBudgetCardProps = {
	project: ProjectSummary;
};

/** A retainer shows its monthly fee and the spend of the last 30 days; a project shows its fee and its total spend. */
export function ProjectBudgetCard({ project }: ProjectBudgetCardProps) {
	const { t } = useT();
	const format = useFormatters();
	const isRetainer = project.dueDay === null;
	const left = project.budget - project.spent;
	const figures = [
		{
			id: "budget",
			label: t(
				isRetainer ? "projectDetail.monthlyFee" : "projectDetail.budget",
			),
			value: format.money(project.budget),
			isBad: false,
		},
		{
			id: "spent",
			label: t(
				isRetainer ? "projectDetail.spent30" : "projectDetail.spentToDate",
			),
			value: format.money(project.spent),
			isBad: false,
		},
		{
			id: "left",
			label: t(left < 0 ? "projectDetail.over" : "projectDetail.left"),
			value: format.money(Math.abs(left)),
			isBad: left < 0,
		},
	];
	const facts = [
		{
			id: "client",
			label: t("projectDetail.client"),
			value: project.clientName,
		},
		{ id: "lead", label: t("projects.lead"), value: project.leadName },
		{
			id: "service",
			label: t("projects.service"),
			value: t(`codes.services.${project.service}`),
		},
		{
			id: "billing",
			label: t("projectDetail.billing"),
			value: t(`codes.billing.${project.billing}`),
		},
		{
			id: "rate",
			label: t("projectDetail.rate"),
			value: t("projectDetail.perHour").replace(
				"{rate}",
				format.money(project.rate),
			),
		},
		{
			id: "hours",
			label: t("projectDetail.hours"),
			value: format.hours(project.hours),
		},
		{
			id: "start",
			label: t("projectDetail.start"),
			value: format.longDate(project.startDay),
		},
		{
			id: "due",
			label: t("projects.due"),
			value: project.dueDay
				? format.longDate(project.dueDay)
				: t("projects.monthly"),
		},
	];
	return (
		<Card>
			<CardContent className="grid gap-6">
				<div className="grid @xl/main:grid-cols-3 gap-4">
					{figures.map((figure) => (
						<div key={figure.id} className="grid gap-1">
							<p className="label-text text-muted-foreground text-xs">
								{figure.label}
							</p>
							<p
								className={cn(
									"font-numeric font-semibold text-3xl tabular-nums leading-tight",
									figure.isBad && "text-destructive",
								)}
							>
								{figure.value}
							</p>
						</div>
					))}
				</div>
				<div className="grid gap-2">
					<BurnMeter
						burnShare={project.burnShare}
						elapsedShare={project.isLive ? project.elapsedShare : null}
						className="h-2.5"
					/>
					<div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-muted-foreground text-xs">
						<span className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-primary" />
							{t("projectDetail.budgetUsed").replace(
								"{share}",
								format.percent(project.burnShare),
							)}
						</span>
						{project.isLive && project.elapsedShare !== null ? (
							<span className="flex items-center gap-1.5">
								<span className="h-3 w-0.5 rounded-full bg-chart-3" />
								{t("projectDetail.timeUsed").replace(
									"{share}",
									format.percent(project.elapsedShare),
								)}
							</span>
						) : null}
					</div>
				</div>
				<Separator />
				<dl className="grid @xl/main:grid-cols-4 grid-cols-2 gap-x-4 gap-y-4 text-sm">
					{facts.map((fact) => (
						<div key={fact.id} className="grid gap-1">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="font-medium">{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
