/**
 * Dashboard banner for invitations addressed to the signed-in user: workspace
 * invitations (Better Auth) and project invitations (GET /api/v2/project-invitations).
 * Each row links to its accept page: `/invite/$invitationId` or `/project-invite/$invitationId`.
 * Ships dark: renders nothing while organizations are disabled and the user
 * has no membership other than the own personal workspace.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Mail } from "lucide-react";

import { useSession } from "@/features/auth";
import { useReceivedProjectInvitationsQuery } from "@/features/workspaces/api/project-invitations.queries";
import { useUserInvitationsQuery } from "@/features/workspaces/api/workspaces.queries";
import { useCollaborationGates } from "@/features/workspaces/lib/workspace-provider";
import {
	highestWorkspaceRole,
	parseWorkspaceRoles,
} from "@/features/workspaces/lib/workspace-roles";
import { useTranslation } from "@/lib/i18n";

/**
 * Rendered on the dashboard. Expired invitations are left out: the workspace
 * service drops workspace ones, and this banner drops project ones.
 */
export function PendingInvitesBanner({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const { showsCollaboration } = useCollaborationGates();
	const enabled = Boolean(session) && showsCollaboration;
	const workspaceInvitationsQuery = useUserInvitationsQuery({ enabled });
	// A failed project list (an older API) must not hide the workspace invitations,
	// so an error counts as an empty list.
	const projectInvitationsQuery = useReceivedProjectInvitationsQuery({
		enabled,
	});
	const workspaceInvitations = workspaceInvitationsQuery.data ?? [];
	// The server marks an expired invitation. It cannot be accepted, so it is left out.
	const projectInvitations = (
		projectInvitationsQuery.data?.invitations ?? []
	).filter((invitation) => !invitation.expired);
	const count = workspaceInvitations.length + projectInvitations.length;

	if (!enabled || count === 0) {
		return null;
	}

	const workspaceRoleLabel = (roleValue: string): string => {
		const role = highestWorkspaceRole(parseWorkspaceRoles(roleValue));

		return role ? t(`workspaces.roles.${role}`) : roleValue;
	};

	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.045] px-4 py-3",
				className,
			)}
		>
			<p className="flex items-center gap-3 font-medium text-sm">
				<Mail className="size-4 shrink-0 text-primary" aria-hidden />
				{t("workspaces.invite.pendingBanner", { count })}
			</p>
			<ul className="flex flex-col gap-1.5">
				{workspaceInvitations.map((invitation) => (
					<li key={invitation.id} className="flex items-center gap-3 ps-7">
						<p className="min-w-0 flex-1 truncate text-sm">
							{t("workspaces.invite.pendingWorkspace", {
								workspace: invitation.organizationName ?? "",
								role: workspaceRoleLabel(invitation.role),
							})}
						</p>
						<Button asChild size="sm" variant="outline" className="shrink-0">
							<Link
								to="/invite/$invitationId"
								params={{ invitationId: invitation.id }}
							>
								{t("workspaces.invite.pendingBannerCta")}
							</Link>
						</Button>
					</li>
				))}
				{projectInvitations.map((invitation) => (
					<li key={invitation.id} className="flex items-center gap-3 ps-7">
						<p className="min-w-0 flex-1 truncate text-sm">
							{t("workspaces.invite.pendingProject", {
								project: invitation.projectName,
								workspace: invitation.workspaceName,
								role: t(`workspaces.projectRoles.${invitation.role}`),
							})}
						</p>
						<Button asChild size="sm" variant="outline" className="shrink-0">
							<Link
								to="/project-invite/$invitationId"
								params={{ invitationId: invitation.id }}
							>
								{t("workspaces.invite.pendingBannerCta")}
							</Link>
						</Button>
					</li>
				))}
			</ul>
		</div>
	);
}
