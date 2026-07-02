// Project-name dropdown in the workspace header: quick switch between
// projects + back to the dashboard grid.

import { Link, useNavigate } from "@tanstack/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";

import { type ProjectStatus, useProjectsQuery } from "@/features/projects";
import { WORKSPACE_COPY } from "../../lib/constants";
import { useWorkspace } from "../../lib/store";

function statusDotClass(status: ProjectStatus): string {
	switch (status) {
		case "published":
			return "bg-success";
		case "publishing":
			return "animate-pulse bg-chart-3";
		default:
			return "bg-muted-foreground/40";
	}
}

export function ProjectSwitcher() {
	const { project, projectId, projectPending } = useWorkspace();
	const projectsQuery = useProjectsQuery();
	const navigate = useNavigate();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={WORKSPACE_COPY.switcher.menuLabel}
					className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					{projectPending || !project ? (
						<Skeleton className="h-4 w-28" />
					) : (
						<>
							<span
								aria-hidden
								className={cn(
									"size-1.5 shrink-0 rounded-full",
									statusDotClass(project.status),
								)}
							/>
							<span dir="auto" className="max-w-44 truncate font-medium">
								{project.name}
							</span>
							<ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
						</>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				<DropdownMenuLabel className="text-muted-foreground text-xs">
					{WORKSPACE_COPY.switcher.menuLabel}
				</DropdownMenuLabel>
				<div className="max-h-72 overflow-y-auto">
					{projectsQuery.data?.map((p) => (
						<DropdownMenuItem
							key={p.id}
							onSelect={() => {
								if (p.id !== projectId) {
									void navigate({
										to: "/p/$projectId",
										params: { projectId: p.id },
									});
								}
							}}
							className="gap-2"
						>
							<span
								aria-hidden
								className={cn(
									"size-1.5 shrink-0 rounded-full",
									statusDotClass(p.status),
								)}
							/>
							<span dir="auto" className="min-w-0 flex-1 truncate">
								{p.name}
							</span>
							{p.id === projectId ? (
								<Check className="size-4 shrink-0 text-primary" />
							) : p.leadCount > 0 ? (
								<span className="font-mono text-[10px] text-muted-foreground tabular-nums">
									{p.leadCount}
								</span>
							) : null}
						</DropdownMenuItem>
					))}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/dashboard">
						<LayoutGrid className="size-4" />
						{WORKSPACE_COPY.switcher.allProjects}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
