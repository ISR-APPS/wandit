/**
 * Workspace members — list, roles, invites, removal, leave
 * (teams-workspaces.md §9). Membership CRUD goes through Better Auth's
 * organization client with an EXPLICIT organizationId (§1.2) — never the
 * session's active organization. Buttons are role-gated cosmetically here;
 * the server enforces for real.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback } from "@wandit/ui/components/avatar";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Input } from "@wandit/ui/components/input";
import { Label } from "@wandit/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Copy, Loader2, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/features/auth";
import { authClient } from "@/features/auth/lib/auth-client";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

type InviteRole = "admin" | "member";

const membersKeys = {
	full: (organizationId: string) =>
		["workspace-members", organizationId] as const,
	invitations: (organizationId: string) =>
		["workspace-invitations", organizationId] as const,
};

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

export default function WorkspaceMembersPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	const {
		activeWorkspace,
		actorCanManageWorkspace,
		isPersonal,
		switchWorkspace,
	} = useWorkspace();
	const organizationId = activeWorkspace?.id;

	// Members only make sense inside an org workspace.
	useEffect(() => {
		if (isPersonal) {
			void navigate({ to: "/dashboard" });
		}
	}, [isPersonal, navigate]);

	const fullQuery = useQuery({
		queryKey: membersKeys.full(organizationId ?? "none"),
		enabled: Boolean(organizationId),
		queryFn: async () => {
			const result = await authClient.organization.getFullOrganization({
				query: { organizationId: organizationId ?? "" },
			});

			if (result.error || !result.data) {
				throw new Error(result.error?.message ?? "load failed");
			}

			return result.data;
		},
	});
	const invitationsQuery = useQuery({
		queryKey: membersKeys.invitations(organizationId ?? "none"),
		enabled: Boolean(organizationId) && actorCanManageWorkspace,
		queryFn: async () => {
			const result = await authClient.organization.listInvitations({
				query: { organizationId: organizationId ?? "" },
			});

			if (result.error) {
				throw new Error(result.error.message ?? "load failed");
			}

			return result.data ?? [];
		},
	});

	const refresh = () => {
		if (!organizationId) {
			return;
		}

		void queryClient.invalidateQueries({
			queryKey: membersKeys.full(organizationId),
		});
		void queryClient.invalidateQueries({
			queryKey: membersKeys.invitations(organizationId),
		});
	};

	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<InviteRole>("member");

	const invite = useMutation({
		mutationFn: async () => {
			const result = await authClient.organization.inviteMember({
				email: inviteEmail.trim(),
				role: inviteRole,
				organizationId: organizationId ?? "",
			});

			if (result.error) {
				// Keep the server's code: the blocked-domain rejection is
				// actionable ("use their work address"), unlike the generic
				// failure toast it would otherwise collapse into.
				const error = new Error(result.error.message ?? "invite failed");
				(error as Error & { code?: string }).code = result.error.code;
				throw error;
			}

			return result.data;
		},
		onSuccess: () => {
			toast.success(t("workspaces.members.inviteSent"));
			setInviteOpen(false);
			setInviteEmail("");
			refresh();
		},
		onError: (error) =>
			toast.error(
				(error as Error & { code?: string }).code === "EMAIL_DOMAIN_BLOCKED"
					? t("errors.codes.EMAIL_DOMAIN_BLOCKED")
					: t("workspaces.members.inviteFailed"),
			),
	});

	const cancelInvitation = useMutation({
		mutationFn: async (invitationId: string) => {
			const result = await authClient.organization.cancelInvitation({
				invitationId,
			});

			if (result.error) {
				throw new Error(result.error.message ?? "cancel failed");
			}
		},
		onSuccess: refresh,
	});

	const removeMember = useMutation({
		mutationFn: async (memberId: string) => {
			const result = await authClient.organization.removeMember({
				memberIdOrEmail: memberId,
				organizationId: organizationId ?? "",
			});

			if (result.error) {
				throw new Error(result.error.message ?? "remove failed");
			}
		},
		onSuccess: refresh,
	});

	const updateRole = useMutation({
		mutationFn: async (input: {
			memberId: string;
			role: InviteRole | "owner";
		}) => {
			const result = await authClient.organization.updateMemberRole({
				memberId: input.memberId,
				role: input.role,
				organizationId: organizationId ?? "",
			});

			if (result.error) {
				throw new Error(result.error.message ?? "role change failed");
			}
		},
		onSuccess: refresh,
	});

	const leave = useMutation({
		mutationFn: async () => {
			const result = await authClient.organization.leave({
				organizationId: organizationId ?? "",
			});

			if (result.error) {
				throw new Error(result.error.message ?? "leave failed");
			}
		},
		onSuccess: () => {
			switchWorkspace("personal");
			void navigate({ to: "/dashboard" });
		},
		onError: () => toast.error(t("workspaces.members.lastOwnerBlocked")),
	});

	if (!organizationId) {
		return null;
	}

	const members = fullQuery.data?.members ?? [];
	const invitations = (invitationsQuery.data ?? []).filter(
		(invitation) => invitation.status === "pending",
	);
	const currentUserId = session?.user.id;
	const currentMember = members.find(
		(member) => member.userId === currentUserId,
	);
	const currentIsOnlyOwner =
		Boolean(currentMember?.role.includes("owner")) &&
		members.filter((member) => member.role.includes("owner")).length === 1;

	const copyInviteLink = (invitationId: string) => {
		void navigator.clipboard
			.writeText(`${window.location.origin}/invite/${invitationId}`)
			.then(() => toast.success(t("workspaces.members.inviteLinkCopied")));
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-display text-2xl tracking-tight">
						{t("workspaces.members.title")}
					</h1>
					<p className="text-muted-foreground text-sm">
						{t("workspaces.members.description")}
					</p>
				</div>
				{actorCanManageWorkspace ? (
					<Button type="button" onClick={() => setInviteOpen(true)}>
						<UserPlus className="size-4" />
						{t("workspaces.members.invite")}
					</Button>
				) : null}
			</header>

			<section className="flex flex-col divide-y rounded-lg border">
				{fullQuery.isPending ? (
					<div className="flex items-center justify-center p-8">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : null}
				{members.map((member) => {
					const isSelf = member.userId === currentUserId;
					const isOwner = member.role.includes("owner");

					return (
						<div key={member.id} className="flex items-center gap-3 p-4">
							<Avatar className="size-8">
								<AvatarFallback>
									{initials(member.user.name || member.user.email)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{member.user.name || member.user.email}
									{isSelf ? (
										<span className="ms-2 text-muted-foreground text-xs">
											{t("workspaces.members.you")}
										</span>
									) : null}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{member.user.email}
								</p>
							</div>
							{actorCanManageWorkspace && !isOwner && !isSelf ? (
								<Select
									value={member.role.includes("admin") ? "admin" : "member"}
									onValueChange={(role) =>
										updateRole.mutate({
											memberId: member.id,
											role: role as InviteRole,
										})
									}
								>
									<SelectTrigger className="w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="admin">
											{t("workspaces.switcher.roleAdmin")}
										</SelectItem>
										<SelectItem value="member">
											{t("workspaces.switcher.roleMember")}
										</SelectItem>
									</SelectContent>
								</Select>
							) : (
								<span className="text-muted-foreground text-xs">
									{isOwner
										? t("workspaces.switcher.roleOwner")
										: member.role.includes("admin")
											? t("workspaces.switcher.roleAdmin")
											: t("workspaces.switcher.roleMember")}
								</span>
							)}
							{actorCanManageWorkspace && !isSelf && !isOwner ? (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={t("workspaces.members.removeMember")}
									onClick={() => removeMember.mutate(member.id)}
								>
									<X className="size-4" />
								</Button>
							) : null}
						</div>
					);
				})}
			</section>

			{actorCanManageWorkspace && invitations.length > 0 ? (
				<section className="flex flex-col gap-3">
					<h2 className="font-medium text-sm">
						{t("workspaces.members.pendingTitle")}
					</h2>
					<div className="flex flex-col divide-y rounded-lg border">
						{invitations.map((invitation) => (
							<div key={invitation.id} className="flex items-center gap-3 p-4">
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">
										{invitation.email}
									</p>
									<p className="text-muted-foreground text-xs">
										{invitation.role}
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => copyInviteLink(invitation.id)}
								>
									<Copy className="size-3.5" />
									{t("workspaces.members.inviteLinkCopy")}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => cancelInvitation.mutate(invitation.id)}
								>
									{t("workspaces.members.cancelInvite")}
								</Button>
							</div>
						))}
					</div>
				</section>
			) : null}

			<footer>
				<Button
					type="button"
					variant="outline"
					disabled={currentIsOnlyOwner || leave.isPending}
					title={
						currentIsOnlyOwner
							? t("workspaces.members.lastOwnerBlocked")
							: undefined
					}
					onClick={() => leave.mutate()}
				>
					{t("workspaces.members.leave")}
				</Button>
				{currentIsOnlyOwner ? (
					<p className="mt-2 text-muted-foreground text-xs">
						{t("workspaces.members.lastOwnerBlocked")}
					</p>
				) : null}
			</footer>

			<Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader className="text-start">
						<DialogTitle className="font-display tracking-tight">
							{t("workspaces.members.invite")}
						</DialogTitle>
						<DialogDescription>
							{t("workspaces.members.description")}
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="invite-email">
								{t("workspaces.members.inviteEmailLabel")}
							</Label>
							<Input
								id="invite-email"
								type="email"
								value={inviteEmail}
								autoFocus
								placeholder={t("workspaces.members.inviteEmailPlaceholder")}
								onChange={(event) => setInviteEmail(event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label>{t("workspaces.members.inviteRoleLabel")}</Label>
							<Select
								value={inviteRole}
								onValueChange={(value) => setInviteRole(value as InviteRole)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="admin">
										{t("workspaces.switcher.roleAdmin")}
									</SelectItem>
									<SelectItem value="member">
										{t("workspaces.switcher.roleMember")}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Button
							type="button"
							disabled={invite.isPending || inviteEmail.trim().length === 0}
							onClick={() => invite.mutate()}
						>
							{invite.isPending
								? t("workspaces.members.inviteSending")
								: t("workspaces.members.inviteSubmit")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
