// The project list: one card per project with its lead, its target day, its progress, its people, and the time left.
// The /app/projects route renders it after its loader. Each card links to the page of its project.
// The Export button downloads every project as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	downloadCsv,
	fillMessage,
	type Member,
	membersQueryOptions,
	PersonAvatar,
	toCsv,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
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
import { type Project, projectsQueryOptions } from "../api/projects.queries";
import { projectCsvColumns } from "../lib/project-csv";
import { progressOf, timeLeftOf } from "../lib/project-progress";
import { TimeLeftBadge } from "./time-left-badge";

/** The avatar row of a card shows this many people, then "+N". */
const SHOWN_PEOPLE = 4;

/** Four cards per row from the 4xl container, two from xl, one on a phone. */
export function ProjectsPage() {
	const { t, locale } = useT();
	const { data: projects } = useSuspenseQuery(projectsQueryOptions());
	const { data: members } = useSuspenseQuery(membersQueryOptions());
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const membersById = new Map(members.map((member) => [member.id, member]));
	const activeCount = projects.filter(
		(project) => project.status === "active",
	).length;

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("projects.title")}
				description={fillMessage(t("projects.description"), {
					active: number.format(activeCount),
					total: number.format(projects.length),
				})}
				actions={
					<Button
						type="button"
						aria-label={t("common.exportCsv")}
						onClick={() =>
							downloadCsv(
								"projects.csv",
								toCsv(projects, projectCsvColumns(t, locale)),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">{t("common.exportCsv")}</span>
					</Button>
				}
			/>
			{projects.length === 0 ? (
				<p className="py-12 text-center text-muted-foreground text-sm">
					{t("projects.empty")}
				</p>
			) : (
				<ul className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
					{projects.map((project) => (
						<li key={project.id} className="grid">
							<ProjectCard
								project={project}
								people={project.memberIds.flatMap((id) => {
									const member = membersById.get(id);
									return member ? [member] : [];
								})}
								now={now}
							/>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

type ProjectCardProps = {
	project: Project;
	/** The members of the project, the lead first. */
	people: Member[];
	/** The current time in milliseconds since 1970. */
	now: number;
};

// The whole card is one link. The avatars are decorative: the project page lists the names.
function ProjectCard({ project, people, now }: ProjectCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const number = new Intl.NumberFormat(locale);
	const progress = progressOf(project);
	const hiddenPeople = people.length - SHOWN_PEOPLE;
	return (
		<Link
			to="/app/projects/$projectId"
			params={{ projectId: project.id }}
			className="grid rounded-(--surface-radius) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<Card className="transition-colors hover:border-ring">
				<CardHeader>
					<CardTitle className="leading-snug">{project.name}</CardTitle>
					<CardDescription>
						{fillMessage(t("projects.ledBy"), {
							key: project.key,
							lead: project.leadName,
						})}
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-6">
					<p className="text-muted-foreground text-sm">
						{fillMessage(t("projects.targetOn"), {
							date: date.format(new Date(project.targetAt)),
						})}
					</p>
					<div className="grid gap-2">
						<div className="flex items-center justify-between text-sm">
							<span>{t("projects.progress")}</span>
							<span className="font-semibold tabular-nums">
								{percent.format(progress / 100)}
							</span>
						</div>
						<Progress value={progress} aria-label={t("projects.progress")} />
					</div>
					<div className="flex items-center justify-between gap-2">
						<span className="flex -space-x-1">
							{people.slice(0, SHOWN_PEOPLE).map((person) => (
								<PersonAvatar
									key={person.id}
									name={person.name}
									className="size-8 ring-2 ring-card"
								/>
							))}
							{hiddenPeople > 0 ? (
								<span className="z-10 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs ring-2 ring-card">
									{`+${number.format(hiddenPeople)}`}
								</span>
							) : null}
							<span className="sr-only">
								{people.map((person) => person.name).join(", ")}
							</span>
						</span>
						<TimeLeftBadge
							time={timeLeftOf(project, now)}
							health={project.health}
						/>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

// Placeholder keys of the card grid. Fixed keys, because the placeholders never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ProjectsPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-36" />
					<Skeleton className="h-4 w-56 max-w-full" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2 gap-4">
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-60" />
				))}
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function ProjectsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("projects.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
