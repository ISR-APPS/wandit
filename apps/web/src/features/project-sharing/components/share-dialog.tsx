/**
 * Share dialog of a V2 project (workspaces-sharing.md 6): invite by email with
 * a role, the people with access and their role menus, the pending
 * invitations, the Workspace access row, and the invite link row.
 * Opened by share-button.tsx in the builder top bar and by the project card menu.
 * Reads projectSharingQuery and writes through sharing.mutations.ts.
 */
import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { CopySimpleIcon } from "@phosphor-icons/react/CopySimple";
import { XIcon } from "@phosphor-icons/react/X";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	createProjectInvitationsBodySchema,
	PROJECT_INVITATION_EMAILS_MAX,
	type ProjectInvitation,
	type ProjectInviteLinkRole,
	type ProjectMember,
	type ProjectMemberRole,
	type ProjectRole,
	type ProjectSharingState,
	projectInviteLinkRoles,
	projectMemberRoles,
	projectWorkspaceAccesses,
	type SharingPerson,
} from "@wandit/contracts";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@wandit/ui/components/avatar";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, useTranslation } from "@/lib/i18n";
import {
	useCancelProjectInvitation,
	useDeleteProjectInviteLink,
	useInviteToProject,
	usePutProjectInviteLink,
	useRemoveProjectMember,
	useUpdateProjectMember,
	useUpdateProjectWorkspaceAccess,
} from "../api/sharing.mutations";
import { projectSharingQuery } from "../api/sharing.queries";
import { copyToClipboard, splitEmails } from "../lib/helpers";
import { canManageGrant, isRoleAtLeast } from "../lib/project-roles";

/** Props of ProjectShareDialog. The parent owns `open`: the Share button and the project card menu. */
export type ProjectShareDialogProps = {
	/** Id of the V2 project to share. */
	projectId: string;
	/** Name of the project, for the dialog title. */
	projectName: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** Title of each section of the dialog. */
const SECTION_TITLE_CLASS = "font-grotesk font-semibold text-sm";

/** Hint line under a section title or a row. */
const HINT_CLASS = "text-muted-foreground text-xs";

/** The dialog frame. The body loads the sharing state only while the dialog is open. */
export function ProjectShareDialog({
	projectId,
	projectName,
	open,
	onOpenChange,
}: ProjectShareDialogProps) {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="font-grotesk">
						{t("sharing.share.title", { name: projectName })}
					</DialogTitle>
					<DialogDescription>
						{t("sharing.share.description")}
					</DialogDescription>
				</DialogHeader>
				<ShareDialogBody
					projectId={projectId}
					onLeft={() => onOpenChange(false)}
				/>
			</DialogContent>
		</Dialog>
	);
}

/** Every section of the dialog. Each section shows only for the roles that can use it. */
function ShareDialogBody({
	projectId,
	onLeft,
}: {
	projectId: string;
	/** Closes the dialog after the caller removed their own access. */
	onLeft: () => void;
}) {
	const { t } = useTranslation();
	const sharing = useQuery(projectSharingQuery(projectId));

	if (sharing.data === undefined) {
		return sharing.isError ? (
			<p role="alert" className="text-destructive text-sm">
				{getApiErrorMessage(sharing.error)}
			</p>
		) : (
			<Skeleton className="h-48 rounded-xl" />
		);
	}

	const state = sharing.data;
	// Product rule: inviting, the pending list, and the link need an editor (workspaces-sharing.md 2.2).
	const canInvite = isRoleAtLeast(state.role, "editor");

	return (
		<div className="flex flex-col gap-6">
			{canInvite ? (
				<InviteForm projectId={projectId} callerRole={state.role} />
			) : (
				<p className={HINT_CLASS}>{t("sharing.share.viewerNote")}</p>
			)}
			<PeopleSection projectId={projectId} state={state} onLeft={onLeft} />
			{state.invitations !== undefined && state.invitations.length > 0 ? (
				<PendingInvitations
					projectId={projectId}
					invitations={state.invitations}
				/>
			) : null}
			<WorkspaceAccessRow projectId={projectId} state={state} />
			{canInvite ? (
				<InviteLinkRow projectId={projectId} link={state.inviteLink} />
			) : null}
		</div>
	);
}

/** The emails field, the role of the new people, and Invite. */
function InviteForm({
	projectId,
	callerRole,
}: {
	projectId: string;
	/** The caller's effective role. Only an admin or the owner can invite admins. */
	callerRole: ProjectRole;
}) {
	const { t } = useTranslation();
	const emailsId = useId();
	const [emailsText, setEmailsText] = useState("");
	const [role, setRole] = useState<ProjectMemberRole>("editor");
	const invite = useInviteToProject(projectId);
	// An editor invites editors and viewers. Only an admin or the owner invites admins.
	const roles = projectMemberRoles.filter((option) =>
		canManageGrant(callerRole, option),
	);

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				// The contract checks each email and the count before the request.
				const body = createProjectInvitationsBodySchema.safeParse({
					emails: splitEmails(emailsText),
					role,
				});
				if (!body.success) {
					toast.error(
						t("sharing.share.inviteInvalid", {
							max: PROJECT_INVITATION_EMAILS_MAX,
						}),
					);
					return;
				}
				invite.mutate(body.data, {
					onSuccess: () => {
						setEmailsText("");
						toast.success(t("sharing.share.inviteSent"));
					},
					onError: (error) => toast.error(getApiErrorMessage(error)),
				});
			}}
		>
			<Label htmlFor={emailsId} className={SECTION_TITLE_CLASS}>
				{t("sharing.share.inviteLabel")}
			</Label>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					id={emailsId}
					value={emailsText}
					onChange={(event) => setEmailsText(event.target.value)}
					placeholder={t("sharing.share.invitePlaceholder")}
					autoComplete="off"
					dir="ltr"
					className="min-w-0 flex-1"
				/>
				<div className="flex gap-2">
					<Select
						value={role}
						onValueChange={(value) => {
							const picked = roles.find((option) => option === value);
							if (picked !== undefined) setRole(picked);
						}}
					>
						<SelectTrigger
							aria-label={t("sharing.share.inviteRole")}
							className="w-32"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{roles.map((option) => (
								<SelectItem key={option} value={option}>
									{t(`sharing.roles.${option}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="submit"
						disabled={emailsText.trim() === "" || invite.isPending}
					>
						{t("sharing.share.inviteSubmit")}
					</Button>
				</div>
			</div>
		</form>
	);
}

/** The owner first, then each direct grant with its role menu. */
function PeopleSection({
	projectId,
	state,
	onLeft,
}: {
	projectId: string;
	state: ProjectSharingState;
	/** Closes the dialog after the caller left. */
	onLeft: () => void;
}) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const sessionUserId = session?.user.id;

	return (
		<section className="flex flex-col gap-2">
			<h3 className={SECTION_TITLE_CLASS}>{t("sharing.share.peopleTitle")}</h3>
			<ul className="flex flex-col gap-1">
				<PersonRow
					person={state.owner}
					isYou={state.owner.userId === sessionUserId}
				>
					<span className="text-muted-foreground text-sm">
						{t("sharing.roles.owner")}
					</span>
				</PersonRow>
				{state.members.map((member) => (
					<PersonRow
						key={member.userId}
						person={member}
						isYou={member.userId === sessionUserId}
					>
						<MemberRoleMenu
							projectId={projectId}
							member={member}
							callerRole={state.role}
							isYou={member.userId === sessionUserId}
							onLeft={onLeft}
						/>
					</PersonRow>
				))}
			</ul>
		</section>
	);
}

/** One person: avatar, name, email, and the role control in `children`. */
function PersonRow({
	person,
	isYou,
	children,
}: {
	person: SharingPerson;
	/** True for the signed-in user. Adds the "You" mark. */
	isYou: boolean;
	children: ReactNode;
}) {
	const { t } = useTranslation();

	return (
		<li className="flex items-center gap-3 py-1.5">
			<PersonAvatar person={person} />
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">
					{person.name || person.email}
					{isYou ? (
						<span className="ms-1.5 text-muted-foreground text-xs">
							{t("sharing.share.you")}
						</span>
					) : null}
				</p>
				<p
					dir="ltr"
					className="truncate text-start text-muted-foreground text-xs"
				>
					{person.email}
				</p>
			</div>
			{children}
		</li>
	);
}

/** Round avatar with the image, or the first letter of the name. The top bar stack uses it too. */
export function PersonAvatar({
	person,
	className,
}: {
	person: SharingPerson;
	className?: string;
}) {
	return (
		<Avatar className={className}>
			<AvatarImage src={person.image ?? undefined} alt="" />
			<AvatarFallback>
				{(person.name || person.email).charAt(0).toUpperCase()}
			</AvatarFallback>
		</Avatar>
	);
}

/**
 * The role menu of one direct grant. The caller changes the role only when the
 * grant rule allows it, and removes the grant then too. Everyone can leave.
 */
function MemberRoleMenu({
	projectId,
	member,
	callerRole,
	isYou,
	onLeft,
}: {
	projectId: string;
	member: ProjectMember;
	/** The caller's effective role on the project. */
	callerRole: ProjectRole;
	/** True when this grant is the caller's own. Remove then means leave. */
	isYou: boolean;
	/** Closes the dialog after the caller left. */
	onLeft: () => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const updateMember = useUpdateProjectMember(projectId);
	const removeMember = useRemoveProjectMember(projectId);
	const canChangeRole = canManageGrant(callerRole, member.role);
	// Only an admin or the owner gives the admin role.
	const roles = projectMemberRoles.filter((option) =>
		canManageGrant(callerRole, option),
	);
	const roleLabel = t(`sharing.roles.${member.role}`);

	if (!canChangeRole && !isYou) {
		return <span className="text-muted-foreground text-sm">{roleLabel}</span>;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					aria-label={t("sharing.share.changeRole", {
						name: member.name || member.email,
					})}
					disabled={updateMember.isPending || removeMember.isPending}
					className="gap-1 text-muted-foreground"
				>
					{roleLabel}
					<CaretDownIcon aria-hidden weight="bold" className="size-3" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				{canChangeRole ? (
					<>
						<DropdownMenuRadioGroup
							value={member.role}
							onValueChange={(value) => {
								const picked = roles.find((option) => option === value);
								if (picked === undefined || picked === member.role) return;
								updateMember.mutate(
									{ userId: member.userId, role: picked },
									{
										onSuccess: () =>
											toast.success(t("sharing.share.roleChanged")),
										onError: (error) => toast.error(getApiErrorMessage(error)),
									},
								);
							}}
						>
							{roles.map((option) => (
								<DropdownMenuRadioItem key={option} value={option}>
									{t(`sharing.roles.${option}`)}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
						<DropdownMenuSeparator />
					</>
				) : null}
				<DropdownMenuItem
					variant="destructive"
					onSelect={() =>
						removeMember.mutate(member.userId, {
							onSuccess: () => {
								if (!isYou) {
									toast.success(t("sharing.share.removed"));
									return;
								}
								// The caller has no access any more, so the project page would answer 404.
								toast.success(t("sharing.share.left"));
								onLeft();
								void navigate({ to: "/dashboard" });
							},
							onError: (error) => toast.error(getApiErrorMessage(error)),
						})
					}
				>
					{t(isYou ? "sharing.share.leave" : "sharing.share.remove")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Pending email invitations with Copy invite link and Cancel. Only editors and higher get this list. */
function PendingInvitations({
	projectId,
	invitations,
}: {
	projectId: string;
	invitations: ProjectInvitation[];
}) {
	const { t } = useTranslation();
	const cancel = useCancelProjectInvitation(projectId);

	return (
		<section className="flex flex-col gap-2">
			<h3 className={SECTION_TITLE_CLASS}>{t("sharing.share.pendingTitle")}</h3>
			<ul className="flex flex-col gap-1">
				{invitations.map((invitation) => (
					<li key={invitation.id} className="flex items-center gap-2 py-1">
						<p dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm">
							{invitation.email}
						</p>
						<span className="text-muted-foreground text-xs">
							{t(`sharing.roles.${invitation.role}`)}
						</span>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("sharing.share.copyInviteLink")}
							onClick={() =>
								void copyAndToast(
									`${window.location.origin}/project-invite/${invitation.id}`,
									t("sharing.share.linkCopied"),
									t("sharing.share.copyFailed"),
								)
							}
						>
							<CopySimpleIcon aria-hidden weight="bold" />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("sharing.share.cancelInvitation")}
							disabled={cancel.isPending}
							onClick={() =>
								cancel.mutate(invitation.id, {
									onSuccess: () =>
										toast.success(t("sharing.share.invitationCanceled")),
									onError: (error) => toast.error(getApiErrorMessage(error)),
								})
							}
						>
							<XIcon aria-hidden weight="bold" />
						</Button>
					</li>
				))}
			</ul>
		</section>
	);
}

/**
 * The Workspace access row: what the members of the project's workspace can do.
 * An editor sets Can edit or Can view. Setting or clearing Restricted needs the owner.
 */
function WorkspaceAccessRow({
	projectId,
	state,
}: {
	projectId: string;
	state: ProjectSharingState;
}) {
	const { t } = useTranslation();
	const update = useUpdateProjectWorkspaceAccess(projectId);
	const isOwner = state.role === "owner";
	const canChange =
		isRoleAtLeast(state.role, "editor") &&
		(isOwner || state.workspaceAccess !== "restricted");

	return (
		<section className="flex items-center gap-3">
			<div className="min-w-0 flex-1">
				<h3 className={SECTION_TITLE_CLASS}>
					{t("sharing.share.workspaceAccessTitle")}
				</h3>
				<p className={HINT_CLASS}>
					{t("sharing.share.workspaceAccessHelp", {
						workspace: state.workspace.name,
					})}
				</p>
				{isRoleAtLeast(state.role, "editor") && !canChange ? (
					<p className={HINT_CLASS}>{t("sharing.share.restrictedOwnerOnly")}</p>
				) : null}
			</div>
			<Select
				value={state.workspaceAccess}
				disabled={!canChange || update.isPending}
				onValueChange={(value) => {
					const picked = projectWorkspaceAccesses.find(
						(option) => option === value,
					);
					if (picked === undefined) return;
					update.mutate(picked, {
						onSuccess: () =>
							toast.success(t("sharing.share.workspaceAccessSaved")),
						onError: (error) => toast.error(getApiErrorMessage(error)),
					});
				}}
			>
				<SelectTrigger
					aria-label={t("sharing.share.workspaceAccessTitle")}
					className="w-36"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{projectWorkspaceAccesses.map((option) => (
						<SelectItem
							key={option}
							value={option}
							disabled={option === "restricted" && !isOwner}
						>
							{t(`sharing.workspaceAccess.${option}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</section>
	);
}

/** The project invite link: create it, copy it, change its role, or turn it off. Editors and higher only. */
function InviteLinkRow({
	projectId,
	link,
}: {
	projectId: string;
	/** The active link from the sharing state; null when none. Editors always get the token. */
	link: ProjectSharingState["inviteLink"];
}) {
	const { t, locale } = useTranslation();
	const putLink = usePutProjectInviteLink(projectId);
	const deleteLink = useDeleteProjectInviteLink(projectId);
	// The role of the next link while no link exists. Viewer is the safer default.
	const [newLinkRole, setNewLinkRole] =
		useState<ProjectInviteLinkRole>("viewer");
	const isBusy = putLink.isPending || deleteLink.isPending;
	const linkUrl =
		link?.token === undefined
			? null
			: `${window.location.origin}/join/${link.token}`;

	function createLink(role: ProjectInviteLinkRole) {
		putLink.mutate(role, {
			onSuccess: () => toast.success(t("sharing.share.linkCreated")),
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	}

	return (
		<section className="flex flex-col gap-2">
			<h3 className={SECTION_TITLE_CLASS}>{t("sharing.share.linkTitle")}</h3>
			<div className="flex items-center gap-2">
				{linkUrl === null ? (
					<p className={`${HINT_CLASS} min-w-0 flex-1`}>
						{t("sharing.share.linkNone")}
					</p>
				) : (
					<Input
						readOnly
						value={linkUrl}
						dir="ltr"
						aria-label={t("sharing.share.linkTitle")}
						className="min-w-0 flex-1 font-mono text-xs"
						onFocus={(event) => event.currentTarget.select()}
					/>
				)}
				<Select
					value={link?.role ?? newLinkRole}
					disabled={isBusy}
					onValueChange={(value) => {
						const picked = projectInviteLinkRoles.find(
							(option) => option === value,
						);
						if (picked === undefined) return;
						// A new role needs a new link: the PUT revokes the old one.
						if (link === null) setNewLinkRole(picked);
						else if (picked !== link.role) createLink(picked);
					}}
				>
					<SelectTrigger
						aria-label={t("sharing.share.linkRole")}
						className="w-32"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{projectInviteLinkRoles.map((option) => (
							<SelectItem key={option} value={option}>
								{t(`sharing.roles.${option}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-2">
				{link === null ? (
					<Button
						size="sm"
						disabled={isBusy}
						onClick={() => createLink(newLinkRole)}
					>
						{t("sharing.share.linkCreate")}
					</Button>
				) : (
					<>
						<p className={`${HINT_CLASS} min-w-0 flex-1`}>
							{t("sharing.share.linkHelp", {
								date: formatDate(link.expiresAt, locale, {
									dateStyle: "medium",
								}),
							})}
						</p>
						{linkUrl !== null ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									void copyAndToast(
										linkUrl,
										t("sharing.share.linkCopied"),
										t("sharing.share.copyFailed"),
									)
								}
							>
								<CopySimpleIcon aria-hidden weight="bold" />
								{t("sharing.share.linkCopy")}
							</Button>
						) : null}
						<Button
							size="sm"
							variant="ghost"
							disabled={isBusy}
							onClick={() =>
								deleteLink.mutate(undefined, {
									onSuccess: () =>
										toast.success(t("sharing.share.linkRevoked")),
									onError: (error) => toast.error(getApiErrorMessage(error)),
								})
							}
						>
							{t("sharing.share.linkRevoke")}
						</Button>
					</>
				)}
			</div>
		</section>
	);
}

/** Copies the text and shows the result as a toast. */
async function copyAndToast(
	text: string,
	successMessage: string,
	failureMessage: string,
): Promise<void> {
	if (await copyToClipboard(text)) toast.success(successMessage);
	else toast.error(failureMessage);
}
