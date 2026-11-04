/**
 * Collaborators part of the People page, for owners and admins: people who
 * are not workspace members but have a direct grant on some of its projects.
 * It reads GET /api/v1/workspace/collaborators. Each project shows its grant role.
 */
import { Avatar, AvatarFallback } from "@wandit/ui/components/avatar";
import { Loader2 } from "lucide-react";

import { useWorkspaceCollaboratorsQuery } from "@/features/workspaces/api/workspaces.queries";
import { initials } from "@/features/workspaces/lib/helpers";
import { useTranslation } from "@/lib/i18n";

/** Rendered by the People page for owners and admins; the route answers 403 to other roles. */
export function PeopleCollaboratorsSection() {
	const { t } = useTranslation();
	const collaboratorsQuery = useWorkspaceCollaboratorsQuery();
	const collaborators = collaboratorsQuery.data?.collaborators ?? [];

	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="font-medium text-sm">
					{t("workspaces.people.collaborators.title")}
				</h2>
				<p className="text-muted-foreground text-xs">
					{t("workspaces.people.collaborators.description")}
				</p>
			</div>
			<div className="flex flex-col divide-y rounded-lg border">
				{collaboratorsQuery.isPending ? (
					<div className="flex items-center justify-center p-8">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : null}
				{collaboratorsQuery.isError ? (
					<p className="p-4 text-muted-foreground text-sm">
						{t("workspaces.people.loadFailed")}
					</p>
				) : null}
				{collaboratorsQuery.isSuccess && collaborators.length === 0 ? (
					<p className="p-4 text-muted-foreground text-sm">
						{t("workspaces.people.collaborators.empty")}
					</p>
				) : null}
				{collaborators.map((collaborator) => {
					const label = collaborator.name || collaborator.email;

					return (
						<div key={collaborator.userId} className="flex gap-3 p-4">
							<Avatar className="size-8">
								<AvatarFallback>{initials(label)}</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">{label}</p>
								<p className="truncate text-muted-foreground text-xs">
									{collaborator.email}
								</p>
								<ul className="mt-2 flex flex-wrap gap-1.5">
									{collaborator.projects.map((project) => (
										<li
											key={project.projectId}
											className="rounded-full bg-muted px-2 py-0.5 text-xs"
										>
											{t("workspaces.people.collaborators.project", {
												project: project.projectName,
												role: t(`workspaces.projectRoles.${project.role}`),
											})}
										</li>
									))}
								</ul>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
