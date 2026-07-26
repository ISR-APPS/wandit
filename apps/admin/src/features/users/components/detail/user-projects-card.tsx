import { FolderKanbanIcon } from "lucide-react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type { AdminUserProject } from "@/features/users/api/users.dto";
import { formatAdminDate } from "@/features/users/lib/formatters";

type UserProjectsCardProps = {
	projects: AdminUserProject[];
};

export function UserProjectsCard({ projects }: UserProjectsCardProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle>Projects</CardTitle>
				<CardDescription>
					Every project this user has created, newest data first.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{projects.length > 0 ? (
					<ul className="flex flex-col divide-y">
						{projects.map((project) => (
							<li
								key={project.id}
								className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
							>
								<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
									<FolderKanbanIcon aria-hidden="true" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">{project.name}</p>
									<p className="mt-0.5 font-mono text-[10px] text-muted-foreground/75">
										{project.id}
									</p>
								</div>
								<time
									dateTime={project.createdAt}
									className="shrink-0 text-muted-foreground text-xs tabular-nums"
								>
									{formatAdminDate(project.createdAt)}
								</time>
							</li>
						))}
					</ul>
				) : (
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
				)}
			</CardContent>
		</Card>
	);
}
