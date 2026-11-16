// The detail page of one project: the header, the money, the burn chart, the deliverables, the phases, the people, and the invoices.
// The /app/projects/$projectId route renders it after its loader, and also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { HealthBadge, PhaseBadge } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { projectQueryOptions } from "../api/projects.queries";
import { BudgetBurnCard } from "./budget-burn-card";
import { DeliverablesCard } from "./deliverables-card";
import { PhaseTimelineCard } from "./phase-timeline-card";
import { ProjectBudgetCard } from "./project-budget-card";
import { ProjectInvoicesCard } from "./project-invoices-card";
import { ProjectPeopleCard } from "./project-people-card";

type ProjectDetailPageProps = {
	/** The `$projectId` param of the URL. An unknown id shows the not-found block. */
	projectId: string;
};

/** A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
	const { t } = useT();
	const { data: detail } = useSuspenseQuery(projectQueryOptions(projectId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/projects">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("projects.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("projectDetail.notFound")}
				</p>
			</div>
		);
	}
	const { project } = detail;

	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={project.name}
					description={
						<span className="flex flex-wrap items-center gap-2">
							<PhaseBadge phase={project.phase} />
							{project.health ? <HealthBadge health={project.health} /> : null}
							<span>
								{`${project.clientName} · ${t(`codes.services.${project.service}`)}`}
							</span>
						</span>
					}
				/>
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid min-w-0 gap-6">
					<ProjectBudgetCard project={project} />
					<BudgetBurnCard
						points={detail.burn}
						budget={detail.burnBudget}
						isRetainer={project.dueDay === null}
					/>
					<DeliverablesCard
						deliverables={detail.deliverables}
						members={detail.people}
					/>
				</div>
				<div className="grid min-w-0 gap-6">
					{project.dueDay ? (
						<PhaseTimelineCard
							startDay={project.startDay}
							dueDay={project.dueDay}
							phase={project.phase}
						/>
					) : null}
					<ProjectPeopleCard people={detail.people} />
					<ProjectInvoicesCard
						invoices={detail.invoices}
						invoiced={project.invoiced}
						paid={project.paid}
					/>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ProjectDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72" />
				<Skeleton className="h-5 w-56" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-64 rounded-surface" />
					<Skeleton className="h-80 rounded-surface" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-72 rounded-surface" />
					<Skeleton className="h-56 rounded-surface" />
				</div>
			</div>
		</div>
	);
}
