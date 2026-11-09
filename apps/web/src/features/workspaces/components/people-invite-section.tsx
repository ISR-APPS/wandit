/**
 * Invite part of the People page: email invitations for several addresses at
 * once, and (owners and admins) one invite link per role.
 * The role select lists only the roles the caller may grant (`grantableWorkspaceRoles`).
 * Email invitations go through Better Auth; links go through the workspaces REST API.
 */
import {
	type WorkspaceInviteLink,
	type WorkspaceRoleName,
	type WorkspaceSummary,
	workspaceInviteLinkRoles,
	workspaceRoleNameSchema,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Textarea } from "@wandit/ui/components/textarea";
import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
	type FailedWorkspaceInvite,
	useCreateWorkspaceInviteLinkMutation,
	useInviteWorkspaceMembersMutation,
	useRevokeWorkspaceInviteLinkMutation,
} from "@/features/workspaces/api/workspaces.mutations";
import { useWorkspaceInviteLinksQuery } from "@/features/workspaces/api/workspaces.queries";
import { useCopyLink } from "@/features/workspaces/lib/hooks";
import {
	parseInviteEmails,
	WORKSPACE_INVITE_EMAILS_MAX,
} from "@/features/workspaces/lib/invite-emails";
import { grantableWorkspaceRoles } from "@/features/workspaces/lib/workspace-roles";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDate, useTranslation } from "@/lib/i18n";

/** Rendered by the People page for owners, admins, and editors. Editors invite viewers only. */
export function PeopleInviteSection({
	workspace,
	canManage,
}: {
	/** The active workspace. Its roles are the caller's roles. */
	workspace: WorkspaceSummary;
	/** Owner or admin: the invite links show. */
	canManage: boolean;
}) {
	return (
		<>
			<InviteByEmailForm workspace={workspace} />
			{canManage ? <InviteLinksList /> : null}
		</>
	);
}

function InviteByEmailForm({ workspace }: { workspace: WorkspaceSummary }) {
	const { t } = useTranslation();
	const grantableRoles = grantableWorkspaceRoles(
		workspace.roles,
		workspace.kind,
	);
	const [emailsText, setEmailsText] = useState("");
	// Editor is the usual role. An Editor caller may only send Viewer.
	const [role, setRole] = useState<WorkspaceRoleName>(
		grantableRoles.includes("member") ? "member" : "viewer",
	);
	const invite = useInviteWorkspaceMembersMutation(workspace.id);
	const { emails, invalid } = parseInviteEmails(emailsText);
	const tooMany = emails.length > WORKSPACE_INVITE_EMAILS_MAX;
	const canSend =
		emails.length > 0 && invalid.length === 0 && !tooMany && !invite.isPending;

	const failureReason = (failure: FailedWorkspaceInvite): string => {
		if (failure.code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION") {
			return t("workspaces.people.invite.alreadyMember");
		}

		if (failure.code === "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION") {
			return t("workspaces.people.invite.alreadyInvited");
		}

		return failure.message;
	};

	const send = () => {
		invite.mutate(
			{ emails, role },
			{
				onSuccess: (failed) => {
					const sentCount = emails.length - failed.length;
					const firstFailure = failed[0];

					if (sentCount > 0) {
						toast.success(
							t("workspaces.people.invite.sent", { count: sentCount }),
						);
					}

					if (firstFailure) {
						toast.error(
							t("workspaces.people.invite.failed", {
								emails: failed.map((failure) => failure.email).join(", "),
								reason: failureReason(firstFailure),
							}),
						);
					}

					// Failed addresses stay in the box, so the user can fix them and send again.
					setEmailsText(failed.map((failure) => failure.email).join(", "));
				},
				onError: (error) => toast.error(getApiErrorMessage(error)),
			},
		);
	};

	return (
		<section className="flex flex-col gap-3 rounded-lg border p-4">
			<div>
				<h2 className="font-medium text-sm">
					{t("workspaces.people.invite.title")}
				</h2>
				<p className="text-muted-foreground text-xs">
					{t("workspaces.people.invite.description")}
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="people-invite-emails">
					{t("workspaces.people.invite.emailsLabel")}
				</Label>
				<Textarea
					id="people-invite-emails"
					rows={2}
					value={emailsText}
					placeholder={t("workspaces.people.invite.emailsPlaceholder")}
					onChange={(event) => setEmailsText(event.target.value)}
				/>
				{invalid.length > 0 ? (
					<p className="text-destructive text-xs">
						{t("workspaces.people.invite.invalidEmails", {
							emails: invalid.join(", "),
						})}
					</p>
				) : null}
				{tooMany ? (
					<p className="text-destructive text-xs">
						{t("workspaces.people.invite.tooMany", {
							max: WORKSPACE_INVITE_EMAILS_MAX,
						})}
					</p>
				) : null}
			</div>
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="people-invite-role">
						{t("workspaces.people.invite.roleLabel")}
					</Label>
					<Select
						value={role}
						onValueChange={(value) => {
							// The Select gives a string; keep only a known role name.
							const parsed = workspaceRoleNameSchema.safeParse(value);

							if (parsed.success) setRole(parsed.data);
						}}
					>
						<SelectTrigger id="people-invite-role" className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{grantableRoles.map((grantableRole) => (
								<SelectItem key={grantableRole} value={grantableRole}>
									{t(`workspaces.roles.${grantableRole}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Button type="button" disabled={!canSend} onClick={send}>
					{invite.isPending
						? t("workspaces.people.invite.sending")
						: t("workspaces.people.invite.submit")}
				</Button>
			</div>
		</section>
	);
}

function InviteLinksList() {
	const { t } = useTranslation();
	const linksQuery = useWorkspaceInviteLinksQuery();

	return (
		<section className="flex flex-col gap-3 rounded-lg border p-4">
			<div>
				<h2 className="font-medium text-sm">
					{t("workspaces.people.links.title")}
				</h2>
				<p className="text-muted-foreground text-xs">
					{t("workspaces.people.links.description")}
				</p>
			</div>
			{linksQuery.isPending ? (
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			) : null}
			{linksQuery.isError ? (
				<p className="text-muted-foreground text-sm">
					{t("workspaces.people.loadFailed")}
				</p>
			) : null}
			{linksQuery.data
				? workspaceInviteLinkRoles.map((role) => (
						<InviteLinkRow
							key={role}
							role={role}
							link={
								linksQuery.data.links.find((entry) => entry.role === role) ??
								null
							}
						/>
					))
				: null}
		</section>
	);
}

function InviteLinkRow({
	role,
	link,
}: {
	/** Role the link grants: `member` (Editor) or `viewer`. */
	role: WorkspaceInviteLink["role"];
	/** The active link of this role, or null when none exists. */
	link: WorkspaceInviteLink | null;
}) {
	const { locale, t } = useTranslation();
	const copyLink = useCopyLink();
	const create = useCreateWorkspaceInviteLinkMutation();
	const revoke = useRevokeWorkspaceInviteLinkMutation();
	const busy = create.isPending || revoke.isPending;
	const roleLabel = t(`workspaces.roles.${role}`);
	const url = link ? `${window.location.origin}/join/${link.token}` : "";
	// The list can still hold a link past its date until a new one replaces it.
	const isExpired = link !== null && Date.parse(link.expiresAt) <= Date.now();

	const createLink = () => {
		create.mutate(role, {
			onSuccess: () => toast.success(t("workspaces.people.links.created")),
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	const revokeLink = (linkId: string) => {
		revoke.mutate(linkId, {
			onSuccess: () => toast.success(t("workspaces.people.links.revoked")),
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

	return (
		<div className="flex flex-col gap-2 border-t pt-3">
			<div className="flex items-center justify-between gap-3">
				<p className="font-medium text-sm">{roleLabel}</p>
				<p className="text-muted-foreground text-xs">
					{link === null
						? t("workspaces.people.links.none")
						: isExpired
							? t("workspaces.people.links.expired")
							: t("workspaces.people.links.expires", {
									date: formatDate(link.expiresAt, locale, {
										dateStyle: "medium",
									}),
								})}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{link && !isExpired ? (
					<>
						<Input
							readOnly
							value={url}
							aria-label={t("workspaces.people.links.url", {
								role: roleLabel,
							})}
							className="min-w-0 flex-1 font-mono text-xs"
							onFocus={(event) => event.target.select()}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void copyLink(url)}
						>
							<Copy className="size-3.5" />
							{t("workspaces.people.links.copy")}
						</Button>
					</>
				) : null}
				<Button
					type="button"
					variant={link ? "ghost" : "outline"}
					size="sm"
					disabled={busy}
					onClick={createLink}
				>
					{link
						? t("workspaces.people.links.replace")
						: t("workspaces.people.links.create")}
				</Button>
				{link ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={busy}
						onClick={() => revokeLink(link.id)}
					>
						{t("workspaces.people.links.revoke")}
					</Button>
				) : null}
			</div>
		</div>
	);
}
