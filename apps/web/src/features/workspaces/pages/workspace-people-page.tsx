/**
 * The People page at `/workspace/people` (workspaces-sharing.md 6), inside the
 * dashboard shell: rename, invite by email and by link, members, pending
 * invitations, external collaborators, and leave. It acts on the active workspace.
 * Better Auth calls pass the organization id explicitly; REST calls use the header.
 * Buttons follow the caller's role; the server enforces for real.
 * While organizations are off, the own personal workspace has no People page (workspaces-sharing.md 3.4).
 */

import { useNavigate } from "@tanstack/react-router";
import { PERSONAL_WORKSPACE, type WorkspaceSummary } from "@wandit/contracts";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DashboardShell } from "@/features/projects";
import {
	useLeaveWorkspaceMutation,
	useRenameWorkspaceMutation,
} from "@/features/workspaces/api/workspaces.mutations";
import {
	useWorkspaceOrganizationQuery,
	useWorkspacesQuery,
} from "@/features/workspaces/api/workspaces.queries";
import { PeopleCollaboratorsSection } from "@/features/workspaces/components/people-collaborators-section";
import { PeopleInviteSection } from "@/features/workspaces/components/people-invite-section";
import { PeopleMembersSection } from "@/features/workspaces/components/people-members-section";
import {
	useCollaborationGates,
	useWorkspace,
} from "@/features/workspaces/lib/workspace-provider";
import {
	grantableWorkspaceRoles,
	parseWorkspaceRoles,
} from "@/features/workspaces/lib/workspace-roles";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";

/** The `/_auth/workspace/people` route renders it. */
export default function WorkspacePeoplePage() {
	const { activeWorkspaceId } = useWorkspace();

	return (
		<DashboardShell titleKey="workspaces.people.title">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 md:px-6">
				{/* A new key resets the forms and dialogs when the workspace changes. */}
				<PeopleContent key={activeWorkspaceId} />
			</div>
		</DashboardShell>
	);
}

function PeopleContent() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { activeWorkspace } = useWorkspace();
	const gates = useCollaborationGates();
	const workspacesQuery = useWorkspacesQuery();
	// A URL or the old `/workspace/members` link can still open the page while it is hidden.
	const isHidden = !gates.isPending && !gates.showsPeople;

	useEffect(() => {
		if (isHidden) {
			void navigate({ to: "/dashboard" });
		}
	}, [isHidden, navigate]);

	if (isHidden) {
		return null;
	}

	if (gates.isPending || workspacesQuery.isPending) {
		return (
			<div className="flex justify-center p-8">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!activeWorkspace) {
		return (
			<p className="text-muted-foreground text-sm">
				{t("workspaces.people.loadFailed")}
			</p>
		);
	}

	return <PeopleSections workspace={activeWorkspace} />;
}

function PeopleSections({ workspace }: { workspace: WorkspaceSummary }) {
	const { t } = useTranslation();
	const { actorCanManageWorkspace, isPersonal } = useWorkspace();
	const canInvite =
		grantableWorkspaceRoles(workspace.roles, workspace.kind).length > 0;

	return (
		<>
			<header>
				<h1 className="font-display text-2xl tracking-tight">
					{t("workspaces.people.title")}
				</h1>
				<p className="text-muted-foreground text-sm">
					{t("workspaces.people.description")}
				</p>
			</header>
			{actorCanManageWorkspace ? <RenameForm workspace={workspace} /> : null}
			{canInvite ? (
				<PeopleInviteSection
					workspace={workspace}
					canManage={actorCanManageWorkspace}
				/>
			) : null}
			<PeopleMembersSection
				workspace={workspace}
				canManage={actorCanManageWorkspace}
			/>
			{/* The collaborators route answers owners and admins only. */}
			{actorCanManageWorkspace ? <PeopleCollaboratorsSection /> : null}
			{/* Nobody leaves their own personal workspace. */}
			{isPersonal ? null : <LeaveWorkspace workspace={workspace} />}
		</>
	);
}

function RenameForm({ workspace }: { workspace: WorkspaceSummary }) {
	const { t } = useTranslation();
	const [name, setName] = useState(workspace.name);
	const rename = useRenameWorkspaceMutation(workspace.id);
	const trimmed = name.trim();
	const canSave =
		trimmed.length > 0 && trimmed !== workspace.name && !rename.isPending;

	return (
		<form
			className="flex flex-wrap items-end gap-3"
			onSubmit={(event) => {
				event.preventDefault();
				rename.mutate(trimmed, {
					onSuccess: () => toast.success(t("workspaces.people.rename.saved")),
					onError: (error) => toast.error(getApiErrorMessage(error)),
				});
			}}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<Label htmlFor="people-workspace-name">
					{t("workspaces.people.rename.label")}
				</Label>
				<Input
					id="people-workspace-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
			</div>
			<Button type="submit" variant="outline" disabled={!canSave}>
				{rename.isPending
					? t("workspaces.people.rename.saving")
					: t("workspaces.people.rename.save")}
			</Button>
		</form>
	);
}

function LeaveWorkspace({ workspace }: { workspace: WorkspaceSummary }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { switchWorkspace } = useWorkspace();
	const organizationQuery = useWorkspaceOrganizationQuery(workspace.id);
	const leave = useLeaveWorkspaceMutation(workspace.id);
	const members = organizationQuery.data?.members ?? [];
	const ownerCount = members.filter((member) =>
		parseWorkspaceRoles(member.role).includes("owner"),
	).length;
	// Better Auth refuses to remove the last owner, so the button says why first.
	// Without the member list the count is unknown, so the server decides.
	const isOnlyOwner =
		workspace.roles.includes("owner") &&
		organizationQuery.data !== undefined &&
		ownerCount <= 1;

	const confirmLeave = () => {
		leave.mutate(undefined, {
			onSuccess: () => {
				switchWorkspace(PERSONAL_WORKSPACE);
				void navigate({ to: "/dashboard" });
			},
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	return (
		<footer className="flex flex-col gap-2">
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						type="button"
						variant="outline"
						className="self-start"
						disabled={isOnlyOwner || leave.isPending}
					>
						{t("workspaces.people.leave.button")}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-display">
							{t("workspaces.people.leave.confirmTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("workspaces.people.leave.confirmBody")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("workspaces.people.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={confirmLeave}
						>
							{t("workspaces.people.leave.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{isOnlyOwner ? (
				<p className="text-muted-foreground text-xs">
					{t("workspaces.people.leave.lastOwnerBlocked")}
				</p>
			) : null}
		</footer>
	);
}
