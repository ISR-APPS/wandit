/**
 * Project name and kind badge in the top bar. Opens a menu that lists the
 * V2 apps of the active workspace, switches to one, or goes back to the
 * dashboard. Rendered by components/shell/top-bar.tsx. The list reads
 * useProjectsQuery of the projects feature when the menu opens; the open
 * project comes from the page through props.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";

import { useProjectsQuery } from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import type { AppProject, AppProjectKind } from "../../api/dto";

export type ProjectMenuProps = {
	/** The open project, from appProjectQuery in the page. Marked with a check in the list. */
	project: AppProject;
};

/** The kind badge tells apart two projects with the same name, in the trigger and the list. */
export function ProjectMenu({ project }: ProjectMenuProps) {
	const { t } = useTranslation();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					// `shrink` beats the kit's shrink-0, so a long name truncates. The cap keeps room for the work controls.
					className="min-w-0 max-w-64 shrink gap-2 px-2"
					aria-label={t("appBuilder.topBar.projectMenu")}
				>
					<span className="truncate font-semibold text-[14.5px]" dir="auto">
						{project.name}
					</span>
					<span className="hidden sm:inline-flex">
						<KindBadge kind={project.kind} />
					</span>
					<ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<ProjectList currentId={project.id} />
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/dashboard">
						<LayoutGrid />
						{t("appBuilder.topBar.allProjects")}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * One menu item per V2 app. Lives inside the menu content, so the query
 * starts when the menu opens and not on every page paint. The dashboard
 * shares the cache entry of the list.
 */
function ProjectList({ currentId }: { currentId: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const projects = useProjectsQuery();

	if (projects.isPending) {
		return (
			<>
				<Skeleton className="mx-2 my-1.5 h-8" />
				<Skeleton className="mx-2 my-1.5 h-8" />
			</>
		);
	}
	if (projects.isError) {
		return (
			<p className="px-2 py-1.5 text-muted-foreground text-sm">
				{t("errors.generic")}
			</p>
		);
	}
	// The list holds V1 pages too. A V1 page opens in the V1 workspace, not here.
	return projects.data
		.filter((candidate) => candidate.engine === "v2_app")
		.map((candidate) => (
			<DropdownMenuItem
				key={candidate.id}
				onSelect={() => {
					// The open project is already on screen. A navigation would only reset the view.
					if (candidate.id === currentId) return;
					void navigate({
						to: "/app/$projectId",
						params: { projectId: candidate.id },
					});
				}}
			>
				<span className="truncate" dir="auto">
					{candidate.name}
				</span>
				<KindBadge
					kind={candidate.targetPlatform === "mobile" ? "mobile" : "web"}
				/>
				{candidate.id === currentId ? (
					<Check className="ms-auto size-4 text-foreground" />
				) : null}
			</DropdownMenuItem>
		));
}

/** The "Web app" or "Mobile app" pill: in the trigger, in every list row, and in Settings. */
export function KindBadge({ kind }: { kind: AppProjectKind }) {
	const { t } = useTranslation();
	return (
		<Badge
			variant="outline"
			className="shrink-0 font-normal text-[11px] text-muted-foreground"
		>
			{t(`appBuilder.kind.${kind}`)}
		</Badge>
	);
}
