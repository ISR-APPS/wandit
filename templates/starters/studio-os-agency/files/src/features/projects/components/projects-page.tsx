// The project list behind login, on the anatomy of the kit project list: a header with one action,
// then a grid of project cards (name, client and service, start day, progress, team, time left).
// The /app/projects route renders it after its loader, and also uses the skeleton and the error below.
// Each card opens /app/projects/$projectId. Delivered projects stay in the Reports tab of the home.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	daysFromToday,
	downloadCsv,
	fillMessage,
	PageError,
	PersonAvatar,
	type ProjectSummary,
	type Service,
	toCsv,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { projectsQueryOptions } from "../api/projects.queries";
import { projectCsvColumns } from "../lib/project-csv";

// The card shows three faces of the team, then "+N", as the kit cards do.
const SHOWN_FACES = 3;
// A project due within a week is urgent; within three weeks it needs a plan.
const URGENT_DAYS = 7;
const SOON_DAYS = 21;
const DAYS_PER_WEEK = 7;

/** The bar color of each service. The service name also shows on the card. */
const SERVICE_BAR = {
	branding: "*:data-[slot=progress-indicator]:bg-chart-1",
	web: "*:data-[slot=progress-indicator]:bg-chart-2",
	campaign: "*:data-[slot=progress-indicator]:bg-chart-3",
	motion: "*:data-[slot=progress-indicator]:bg-chart-4",
	content: "*:data-[slot=progress-indicator]:bg-chart-5",
} satisfies Record<Service, string>;

/** The live projects, the nearest deadline first. Retainers have no deadline and come last. */
export function ProjectsPage() {
	const { t } = useT();
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const rows = projects
		.filter((project) => project.isLive)
		.sort((first, second) =>
			(first.dueDay ?? "9999").localeCompare(second.dueDay ?? "9999"),
		);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("projects.title")}
				description={t("projects.description")}
				actions={
					<Button
						onClick={() =>
							downloadCsv("projects.csv", toCsv(rows, projectCsvColumns(t)))
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("projects.export")}</span>
					</Button>
				}
			/>
			{rows.length === 0 ? (
				<p className="text-muted-foreground text-sm">{t("projects.empty")}</p>
			) : (
				<ul className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
					{rows.map((project) => (
						<li key={project.id} className="min-w-0">
							<ProjectCard project={project} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** One project card. The whole card is a link to the project. */
function ProjectCard({ project }: { project: ProjectSummary }) {
	const { t, locale } = useT();
	const { longDate, percent } = useFormatters();
	const hiddenFaces = project.teamNames.length - SHOWN_FACES;
	return (
		<Link
			to="/app/projects/$projectId"
			params={{ projectId: project.id }}
			className="block h-full rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="h-full transition-colors hover:border-primary">
				<CardHeader>
					<CardTitle className="leading-snug">{project.name}</CardTitle>
					<CardDescription>
						{`${project.clientName} · ${t(`codes.services.${project.service}`)}`}
					</CardDescription>
				</CardHeader>
				<CardContent className="mt-auto grid gap-6">
					<p className="text-muted-foreground text-sm">
						{longDate(project.startDay)}
					</p>
					<div className="grid gap-2">
						<div className="flex items-center justify-between text-sm">
							<span>{t("projects.progress")}</span>
							<span className="font-semibold tabular-nums">
								{percent(project.progress)}
							</span>
						</div>
						<Progress
							value={project.progress * 100}
							className={cn("bg-muted", SERVICE_BAR[project.service])}
							aria-label={t("projects.progress")}
						/>
					</div>
					{/* A narrow card puts the time-left badge on its own line, so it never leaves the card. */}
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex -space-x-1">
							{project.teamNames.slice(0, SHOWN_FACES).map((name) => (
								<PersonAvatar
									key={name}
									name={name}
									className="size-8 ring-2 ring-card"
								/>
							))}
							{hiddenFaces > 0 ? (
								<span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs ring-2 ring-card">
									{`+${new Intl.NumberFormat(locale).format(hiddenFaces)}`}
								</span>
							) : null}
							<span className="sr-only">{project.teamNames.join(", ")}</span>
						</div>
						<TimeLeftBadge dueDay={project.dueDay} />
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

/** "2 weeks left", "Due this week", "Late", or "Retainer". The color follows the urgency. */
function TimeLeftBadge({ dueDay }: { dueDay: string | null }) {
	const { t, locale } = useT();
	if (dueDay === null) {
		return <Badge variant="secondary">{t("projects.retainer")}</Badge>;
	}
	const daysLeft = daysFromToday(dueDay);
	let variant: ComponentProps<typeof Badge>["variant"] = "info";
	let text: string;
	if (daysLeft < 0) {
		variant = "destructive";
		text = t("projects.late");
	} else if (daysLeft <= URGENT_DAYS) {
		variant = "destructive";
		text = t("projects.thisWeek");
	} else {
		variant = daysLeft <= SOON_DAYS ? "warning" : "info";
		text = fillMessage(t("projects.weeksLeft"), {
			weeks: new Intl.NumberFormat(locale).format(
				Math.ceil(daysLeft / DAYS_PER_WEEK),
			),
		});
	}
	return <Badge variant={variant}>{text}</Badge>;
}

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Placeholder while the loader runs: the header and eight cards. */
export function ProjectsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-64" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-60 rounded-surface" />
				))}
			</div>
		</div>
	);
}

/** Error state of the project pages when the loader fails. Try again runs the loader again. */
export function ProjectsPageError() {
	const { t } = useT();
	return <PageError message={t("projects.loadError")} />;
}
