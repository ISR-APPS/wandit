import { Link } from "@tanstack/react-router";
import { CopyIcon, FolderKanbanIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProjectsQuery } from "@/features/users/api/users.queries";
import { formatAdminDate } from "@/features/users/lib/formatters";

import { DetailPagination } from "./detail-pagination";

export const PROJECTS_PAGE_SIZE = 10;

const PROJECT_SKELETON_KEYS = [
	"project-1",
	"project-2",
	"project-3",
	"project-4",
] as const;

type UserProjectsListProps = {
	userId: string;
};

function copyProjectId(projectId: string) {
	void navigator.clipboard.writeText(projectId).catch(() => undefined);
}

export function UserProjectsList({ userId }: UserProjectsListProps) {
	const [page, setPage] = useState(1);
	const projectsQuery = useUserProjectsQuery({
		userId,
		page,
		pageSize: PROJECTS_PAGE_SIZE,
		sort: "newest",
	});
	const pageCount = Math.max(
		1,
		Math.ceil((projectsQuery.data?.total ?? 0) / PROJECTS_PAGE_SIZE),
	);

	useEffect(() => {
		if (page > pageCount) {
			setPage(pageCount);
		}
	}, [page, pageCount]);

	if (
		projectsQuery.isPending ||
		(projectsQuery.isFetching && projectsQuery.isPlaceholderData)
	) {
		return <ProjectsSkeleton />;
	}

	if (projectsQuery.isError || !projectsQuery.data) {
		return (
			<Empty className="min-h-56 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderKanbanIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>Projects could not be loaded</EmptyTitle>
					<EmptyDescription>
						{errorMessage(
							projectsQuery.error,
							"Retry the request to see this user's projects.",
						)}
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						type="button"
						size="sm"
						onClick={() => void projectsQuery.refetch()}
					>
						<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
						Retry
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	if (projectsQuery.data.items.length === 0) {
		return (
			<Empty className="min-h-56 border-0 p-6">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderKanbanIcon aria-hidden="true" />
					</EmptyMedia>
					<EmptyTitle>No projects yet</EmptyTitle>
					<EmptyDescription>
						Projects will appear here once this user creates one.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col" aria-busy={projectsQuery.isFetching}>
			<ul className="flex flex-col divide-y">
				{projectsQuery.data.items.map((project) => (
					<li
						key={project.id}
						className="flex min-w-0 items-center gap-2 py-2 first:pt-0 last:pb-0"
					>
						<Link
							to="/users/$userId/projects/$projectId"
							params={{ userId, projectId: project.id }}
							className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<FolderKanbanIcon aria-hidden="true" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">{project.name}</p>
								<p
									className="mt-0.5 block max-w-full truncate font-mono text-[10px] text-muted-foreground/75"
									title={project.id}
								>
									{project.id}
								</p>
								<time
									dateTime={project.createdAt}
									className="mt-1 block text-muted-foreground text-xs tabular-nums sm:hidden"
								>
									{formatAdminDate(project.createdAt)}
								</time>
							</div>
							<time
								dateTime={project.createdAt}
								className="hidden shrink-0 text-muted-foreground text-xs tabular-nums sm:block"
							>
								{formatAdminDate(project.createdAt)}
							</time>
						</Link>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => copyProjectId(project.id)}
							title="Copy project ID"
							aria-label={`Copy project ID ${project.id}`}
							className="shrink-0 text-muted-foreground"
						>
							<CopyIcon aria-hidden="true" />
						</Button>
					</li>
				))}
			</ul>
			<DetailPagination
				page={page}
				pageSize={PROJECTS_PAGE_SIZE}
				total={projectsQuery.data.total}
				onPageChange={setPage}
			/>
		</div>
	);
}

function ProjectsSkeleton() {
	return (
		<div
			className="flex flex-col divide-y"
			role="status"
			aria-label="Loading projects"
		>
			{PROJECT_SKELETON_KEYS.map((key) => (
				<div
					key={key}
					className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
				>
					<Skeleton className="size-9 shrink-0 rounded-lg" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton className="h-4 w-44 max-w-full" />
						<Skeleton className="h-3 w-32 max-w-full" />
					</div>
					<Skeleton className="hidden h-3 w-24 sm:block" />
					<Skeleton className="size-8 shrink-0" />
				</div>
			))}
		</div>
	);
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
