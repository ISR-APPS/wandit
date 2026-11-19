// The page of one project, on the anatomy of the kit task board: the header with the team faces and an export,
// a facts card, then the tabs Board and Table with a search field and a priority filter,
// and one board column per deliverable status.
// The /app/projects/$projectId route renders it after its loader, and also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { DownloadSimpleIcon, FunnelIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	DELIVERABLE_STATUSES,
	downloadCsv,
	PersonAvatar,
	PRIORITIES,
	type Priority,
	toCsv,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import {
	CaretLeftIcon,
	CheckIcon,
	MagnifyingGlassIcon,
} from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { projectQueryOptions } from "../api/projects.queries";
import { BoardColumn } from "./board-column";
import { DeliverablesTable } from "./deliverables-table";
import { ProjectFactsCard } from "./project-facts-card";

// The header shows three faces of the team, then "+N", as the kit board does.
const SHOWN_FACES = 3;

type ProjectDetailPageProps = {
	/** The `$projectId` param of the URL. An unknown id shows the not-found block. */
	projectId: string;
};

/** The search and the priority filter cut the board and the table alike. */
export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(projectQueryOptions(projectId));
	const [query, setQuery] = useState("");
	const [priority, setPriority] = useState<Priority | null>(null);

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
	const { project, people, items } = detail;
	const needle = query.trim().toLocaleLowerCase(locale);
	const shown = items.filter(
		(item) =>
			(priority === null || item.priority === priority) &&
			(needle === "" ||
				`${item.name} ${item.ownerName}`
					.toLocaleLowerCase(locale)
					.includes(needle)),
	);
	const hiddenFaces = people.length - SHOWN_FACES;
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				{backLink}
				<PageHeader
					title={project.name}
					description={`${project.clientName} · ${t(`codes.services.${project.service}`)}`}
					actions={
						<>
							<div className="flex -space-x-1">
								{people.slice(0, SHOWN_FACES).map((person) => (
									<PersonAvatar
										key={person.id}
										name={person.name}
										className="size-8 ring-2 ring-background"
									/>
								))}
								{hiddenFaces > 0 ? (
									<span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs ring-2 ring-background">
										{`+${number.format(hiddenFaces)}`}
									</span>
								) : null}
								<span className="sr-only">
									{people.map((person) => person.name).join(", ")}
								</span>
							</div>
							<Button
								variant="outline"
								onClick={() =>
									downloadCsv(
										`${project.id}-deliverables.csv`,
										toCsv(items, [
											{
												header: t("projectDetail.deliverable"),
												value: (row) => row.name,
											},
											{
												header: t("projectDetail.owner"),
												value: (row) => row.ownerName,
											},
											{
												header: t("projects.status"),
												value: (row) => t(`codes.deliverables.${row.status}`),
											},
											{
												header: t("projectDetail.due"),
												value: (row) => row.dueDay,
											},
										]),
									)
								}
							>
								<DownloadSimpleIcon />
								<span className="hidden lg:inline">{t("projects.export")}</span>
							</Button>
						</>
					}
				/>
			</div>
			<ProjectFactsCard project={project} />
			<Tabs defaultValue="board" className="min-w-0 gap-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<TabsList>
						<TabsTrigger value="board">{t("projectDetail.board")}</TabsTrigger>
						<TabsTrigger value="table">{t("projectDetail.table")}</TabsTrigger>
					</TabsList>
					<div className="flex items-center gap-2">
						<div className="relative">
							<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
							<Input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t("projectDetail.search")}
								aria-label={t("projectDetail.search")}
								className="@xl/main:w-56 w-44 ps-8"
							/>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">
									<FunnelIcon />
									<span className="hidden lg:inline">
										{t("projectDetail.filters")}
									</span>
									{priority === null ? null : (
										<Badge variant="secondary">
											{t(`codes.priorities.${priority}`)}
										</Badge>
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-48">
								{PRIORITIES.map((option) => (
									<DropdownMenuItem
										key={option}
										role="menuitemradio"
										aria-checked={priority === option}
										onSelect={() =>
											setPriority((current) =>
												current === option ? null : option,
											)
										}
									>
										<CheckIcon
											className={cn(
												"size-4",
												priority === option ? "" : "invisible",
											)}
										/>
										{t(`codes.priorities.${option}`)}
									</DropdownMenuItem>
								))}
								{priority === null ? null : (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem onSelect={() => setPriority(null)}>
											{t("table.clearFilter")}
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				<TabsContent value="board" className="min-w-0">
					<div className="flex gap-4 overflow-x-auto pb-2">
						{DELIVERABLE_STATUSES.map((status) => (
							<BoardColumn
								key={status}
								status={status}
								items={shown.filter((item) => item.status === status)}
							/>
						))}
					</div>
				</TabsContent>
				<TabsContent value="table">
					<DeliverablesTable items={shown} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// Placeholder columns of the skeleton. Fixed keys, because the columns never reorder.
const SKELETON_COLUMNS = ["todo", "doing", "review", "done"];

/** Placeholder while the loader runs: the header, the facts card, the tabs, and four columns. */
export function ProjectDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-8 w-28" />
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-72 max-w-full" />
					<Skeleton className="h-4 w-48" />
				</div>
				<Skeleton className="h-9 w-40" />
			</div>
			<Skeleton className="h-28 rounded-surface" />
			<Skeleton className="h-9 w-44" />
			<div className="flex gap-4 overflow-hidden">
				{SKELETON_COLUMNS.map((key) => (
					<Skeleton
						key={key}
						className="h-96 min-w-64 flex-1 rounded-surface"
					/>
				))}
			</div>
		</div>
	);
}
