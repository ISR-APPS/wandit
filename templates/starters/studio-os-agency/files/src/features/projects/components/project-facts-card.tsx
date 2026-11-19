// The facts card of a project page: client, lead, billing, dates, money, and health in one key-value grid.
// ProjectDetailPage renders it between the header and the task board.
import {
	HealthBadge,
	PhaseBadge,
	type ProjectSummary,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";

/** Four columns of facts from the 4xl container width, two on a phone. */
export function ProjectFactsCard({ project }: { project: ProjectSummary }) {
	const { t } = useT();
	const { money, longDate, percent } = useFormatters();
	const facts = [
		{ id: "client", label: t("projects.client"), value: project.clientName },
		{ id: "lead", label: t("projects.lead"), value: project.leadName },
		{
			id: "billing",
			label: t("projectDetail.billing"),
			value: t(`codes.billing.${project.billing}`),
		},
		{
			id: "dates",
			label: t("projectDetail.dates"),
			value: `${longDate(project.startDay)} – ${
				project.dueDay === null
					? t("projects.monthly")
					: longDate(project.dueDay)
			}`,
		},
		{
			id: "budget",
			label:
				project.dueDay === null
					? t("projectDetail.monthlyFee")
					: t("projects.budget"),
			value: money(project.budget),
		},
		{
			id: "spent",
			label: t("projects.spent"),
			value: `${money(project.spent)} · ${percent(project.burnShare)}`,
		},
		{
			id: "invoiced",
			label: t("projects.invoiced"),
			value: money(project.invoiced),
		},
		{
			id: "status",
			label: t("projects.status"),
			value: (
				<span className="flex flex-wrap gap-1.5">
					<PhaseBadge phase={project.phase} />
					{project.health === null ? null : (
						<HealthBadge health={project.health} />
					)}
				</span>
			),
		},
	];
	return (
		<Card className="py-5">
			<CardContent className="px-5">
				<dl className="grid @4xl/main:grid-cols-4 grid-cols-2 gap-x-4 gap-y-4 text-sm">
					{facts.map((fact) => (
						<div key={fact.id} className="grid min-w-0 gap-1">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="font-medium">{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
