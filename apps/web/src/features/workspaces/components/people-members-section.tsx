/**
 * Members and pending email invitations of the People page.
 * Owners and admins change roles, remove members (with a confirm dialog), and
 * cancel invitations. Everyone who can invite sees the pending list and copies links.
 * Data comes from the Better Auth queries and mutations in `../api`.
 */
import {
	type WorkspaceSummary,
	workspaceRoleNameSchema,
} from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@wandit/ui/components/alert-dialog";
import { Avatar, AvatarFallback } from "@wandit/ui/components/avatar";
import { Button } from "@wandit/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Copy, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/features/auth";
import {
	useCancelWorkspaceInvitationMutation,
	useRemoveWorkspaceMemberMutation,
	useUpdateWorkspaceMemberRoleMutation,
} from "@/features/workspaces/api/workspaces.mutations";
import {
	useWorkspaceInvitationsQuery,
	useWorkspaceOrganizationQuery,
} from "@/features/workspaces/api/workspaces.queries";
import { initials } from "@/features/workspaces/lib/helpers";
import { useCopyLink } from "@/features/workspaces/lib/hooks";
import {
	grantableWorkspaceRoles,
	highestWorkspaceRole,
	parseWorkspaceRoles,
} from "@/features/workspaces/lib/workspace-roles";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, useTranslation } from "@/lib/i18n";

/** The member the remove dialog asks about. */
type MemberToRemove = {
	/** `member.id` of the row. */
	memberId: string;
	/** Name or email, for the dialog title. */
	label: string;
};

/** Rendered by the People page for every role. Only owners and admins get the role and remove controls. */
export function PeopleMembersSection({
	workspace,
	canManage,
}: {
	/** The active workspace. Its roles are the caller's roles. */
	workspace: WorkspaceSummary;
	/** Owner or admin: change roles, remove members, cancel invitations. */
	canManage: boolean;
}) {
	const { locale, t } = useTranslation();
	const { data: session } = useSession();
	const copyLink = useCopyLink();
	const [memberToRemove, setMemberToRemove] = useState<MemberToRemove | null>(
		null,
	);
	const grantableRoles = grantableWorkspaceRoles(
		workspace.roles,
		workspace.kind,
	);
	const canInvite = grantableRoles.length > 0;
	const organizationQuery = useWorkspaceOrganizationQuery(workspace.id);
	const invitationsQuery = useWorkspaceInvitationsQuery(workspace.id, {
		enabled: canInvite,
	});
	const updateRole = useUpdateWorkspaceMemberRoleMutation(workspace.id);
	const removeMember = useRemoveWorkspaceMemberMutation(workspace.id);
	const cancelInvitation = useCancelWorkspaceInvitationMutation(workspace.id);
	const currentUserId = session?.user.id;
	const invitations = invitationsQuery.data ?? [];
	// A team workspace can have several owners. A personal workspace has one owner, who never changes.
	const callerIsTeamOwner =
		workspace.kind === "team" && workspace.roles.includes("owner");

	const roleLabel = (roleValue: string): string => {
		const role = highestWorkspaceRole(parseWorkspaceRoles(roleValue));

		return role ? t(`workspaces.roles.${role}`) : roleValue;
	};

	const changeRole = (memberId: string, value: string) => {
		// The Select gives a string; only a known role name reaches the server.
		const parsed = workspaceRoleNameSchema.safeParse(value);

		if (!parsed.success) {
			return;
		}

		updateRole.mutate(
			{ memberId, role: parsed.data },
			{
				onSuccess: () =>
					toast.success(t("workspaces.people.members.roleChanged")),
				onError: (error) => toast.error(getApiErrorMessage(error)),
			},
		);
	};

	const confirmRemove = (target: MemberToRemove) => {
		removeMember.mutate(target.memberId, {
			onSuccess: () =>
				toast.success(
					t("workspaces.people.members.removed", { name: target.label }),
				),
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	const cancel = (invitationId: string) => {
		cancelInvitation.mutate(invitationId, {
			onSuccess: () => toast.success(t("workspaces.people.pending.canceled")),
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	return (
		<>
			<section className="flex flex-col gap-3">
				<h2 className="font-medium text-sm">
					{t("workspaces.people.members.title")}
				</h2>
				<div className="flex flex-col divide-y rounded-lg border">
					{organizationQuery.isPending ? (
						<div className="flex items-center justify-center p-8">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : null}
					{organizationQuery.isError ? (
						<p className="p-4 text-muted-foreground text-sm">
							{t("workspaces.people.loadFailed")}
						</p>
					) : null}
					{(organizationQuery.data?.members ?? []).map((member) => {
						const memberRoles = parseWorkspaceRoles(member.role);
						const memberRole = highestWorkspaceRole(memberRoles);
						const isSelf = member.userId === currentUserId;
						// Only a team owner changes or removes another owner. Better Auth refuses it to admins.
						const isOwner = memberRoles.includes("owner");
						const label = member.user.name || member.user.email;
						const canEditMember =
							canManage && !isSelf && (!isOwner || callerIsTeamOwner);

						return (
							<div key={member.id} className="flex items-center gap-3 p-4">
								<Avatar className="size-8">
									<AvatarFallback>{initials(label)}</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">
										{label}
										{isSelf ? (
											<span className="ms-2 text-muted-foreground text-xs">
												{t("workspaces.people.members.you")}
											</span>
										) : null}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{member.user.email}
									</p>
								</div>
								{canEditMember && memberRole ? (
									<Select
										value={memberRole}
										onValueChange={(value) => changeRole(member.id, value)}
										disabled={updateRole.isPending}
									>
										<SelectTrigger
											className="w-32"
											aria-label={t("workspaces.people.members.roleLabel", {
												name: label,
											})}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{grantableRoles.map((role) => (
												<SelectItem key={role} value={role}>
													{t(`workspaces.roles.${role}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<span className="text-muted-foreground text-xs">
										{roleLabel(member.role)}
									</span>
								)}
								{canEditMember ? (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={t("workspaces.people.members.remove")}
										onClick={() =>
											setMemberToRemove({ memberId: member.id, label })
										}
									>
										<X className="size-4" />
									</Button>
								) : null}
							</div>
						);
					})}
				</div>
			</section>

			{canInvite && invitations.length > 0 ? (
				<section className="flex flex-col gap-3">
					<h2 className="font-medium text-sm">
						{t("workspaces.people.pending.title")}
					</h2>
					<div className="flex flex-col divide-y rounded-lg border">
						{invitations.map((invitation) => (
							<div
								key={invitation.id}
								className="flex flex-wrap items-center gap-3 p-4"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">
										{invitation.email}
									</p>
									<p className="text-muted-foreground text-xs">
										{roleLabel(invitation.role)}
										{" · "}
										{t("workspaces.people.pending.expires", {
											date: formatDate(invitation.expiresAt, locale, {
												dateStyle: "medium",
											}),
										})}
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										void copyLink(
											`${window.location.origin}/invite/${invitation.id}`,
										)
									}
								>
									<Copy className="size-3.5" />
									{t("workspaces.people.pending.copy")}
								</Button>
								{canManage ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={cancelInvitation.isPending}
										onClick={() => cancel(invitation.id)}
									>
										{t("workspaces.people.pending.cancel")}
									</Button>
								) : null}
							</div>
						))}
					</div>
				</section>
			) : null}

			<AlertDialog
				open={memberToRemove !== null}
				onOpenChange={(open) => {
					if (!open) setMemberToRemove(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-display">
							{t("workspaces.people.members.removeConfirmTitle", {
								name: memberToRemove?.label ?? "",
							})}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("workspaces.people.members.removeConfirmBody")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("workspaces.people.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => {
								if (memberToRemove) confirmRemove(memberToRemove);
							}}
						>
							{t("workspaces.people.members.removeConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
