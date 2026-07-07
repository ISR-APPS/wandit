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
import { Check, ChevronDown, LayoutGrid } from "lucide-react";

import { type ProjectStatus, useProjectsQuery } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";

function statusDotClass(status: ProjectStatus): string {
	switch (status) {
		case "published":
			return "bg-success";
		case "publishing":
			return "animate-pulse bg-chart-3";
		default:
			// Draft reads as a plain ink dot (3a reference), not a status color.
			return "bg-foreground";
	}
}

export function ProjectSwitcher() {
	const { t } = useTranslation();
	const { project, projectId, projectPending } = useWorkspace();
	const projectsQuery = useProjectsQuery();
	const navigate = useNavigate();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={t("workspace.switcher.menuLabel")}
					className="flex h-8 min-w-0 items-center gap-2 rounded-full border border-border bg-background/70 px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					{projectPending || !project ? (
						<Skeleton className="h-4 w-28" />
					) : (
						<>
							<span
								aria-hidden
								className={cn(
									"size-2 shrink-0 rounded-full",
									statusDotClass(project.status),
								)}
							/>
							<span dir="auto" className="max-w-44 truncate font-medium">
								{project.name}
							</span>
							<ChevronDown className="size-3 shrink-0 opacity-50" />
						</>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				<DropdownMenuLabel className="text-muted-foreground text-xs">
					{t("workspace.switcher.menuLabel")}
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
						{t("workspace.switcher.allProjects")}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
