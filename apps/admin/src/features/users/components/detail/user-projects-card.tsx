import { Link } from "@tanstack/react-router";
import { CopyIcon, FolderKanbanIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type UserProjectsCardProps = {
	userId: string;
	projects: AdminUserProject[];
	className?: string;
};

function copyProjectId(projectId: string) {
	void navigator.clipboard.writeText(projectId).catch(() => undefined);
}

export function UserProjectsCard({
	userId,
	projects,
	className,
}: UserProjectsCardProps) {
	return (
		<Card className={cn("shadow-none", className)}>
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
										<p className="truncate font-medium text-sm">
											{project.name}
										</p>
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
