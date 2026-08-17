/**
 * /invite/$invitationId — accept or decline a workspace invitation
 * (teams-workspaces.md §9). Unauthenticated visitors are asked to sign in
 * first; "already a member" renders as success-with-notice (§1.4).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { useAuthModal, useSession } from "@/features/auth";
import { authClient } from "@/features/auth/lib/auth-client";
import { workspacesKeys } from "@/features/workspaces/api/workspaces.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

export default function InvitePage({ invitationId }: { invitationId: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { open: openAuthModal } = useAuthModal();
	const { switchWorkspace } = useWorkspace();
	const [outcome, setOutcome] = useState<"accepted" | "alreadyMember" | null>(
		null,
	);

	const invitationQuery = useQuery({
		queryKey: ["workspace-invitation", invitationId],
		enabled: Boolean(session),
		retry: false,
		queryFn: async () => {
			const result = await authClient.organization.getInvitation({
				query: { id: invitationId },
			});

			if (result.error || !result.data) {
				throw new Error(result.error?.message ?? "invalid invitation");
			}

			return result.data;
		},
	});

	const accept = useMutation({
		mutationFn: async () => {
			const result = await authClient.organization.acceptInvitation({
				invitationId,
			});

			if (result.error) {
				// The unique-membership backstop surfaces as "already a member" —
				// treat it as a success with a notice (§1.4).
				if (/already/i.test(result.error.message ?? "")) {
					return "alreadyMember" as const;
				}

				throw new Error(result.error.message ?? "accept failed");
			}

			return "accepted" as const;
		},
		onSuccess: (state) => {
			setOutcome(state);
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.userInvitations(),
			});
			const organizationId = invitationQuery.data?.organizationId;

			if (organizationId) {
				switchWorkspace(organizationId);
			}

			window.setTimeout(() => {
				void navigate({ to: "/dashboard" });
			}, 1_200);
		},
	});

	const reject = useMutation({
		mutationFn: async () => {
			await authClient.organization.rejectInvitation({ invitationId });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: workspacesKeys.userInvitations(),
			});
			void navigate({ to: "/dashboard" });
		},
	});

	const workspaceName = invitationQuery.data?.organizationName ?? "";

	return (
		<main className="flex min-h-svh items-center justify-center px-4">
			<div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
				<h1 className="font-display text-xl tracking-tight">
					{t("workspaces.invite.title")}
				</h1>

				{sessionPending ? (
					<div className="mt-6 flex justify-center">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{!sessionPending && !session ? (
					<div className="mt-6 flex flex-col gap-4">
						<p className="text-muted-foreground text-sm">
							{t("workspaces.invite.signInFirst")}
						</p>
						<Button
							type="button"
							onClick={() => openAuthModal({ next: `/invite/${invitationId}` })}
						>
							{t("auth.signIn")}
						</Button>
					</div>
				) : null}

				{session && invitationQuery.isPending ? (
					<div className="mt-6 flex justify-center">
						<Loader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{session && invitationQuery.isError ? (
					<p className="mt-6 text-muted-foreground text-sm">
						{t("workspaces.invite.invalid")}
					</p>
				) : null}

				{session && invitationQuery.data && outcome === null ? (
					<div className="mt-6 flex flex-col gap-4">
						<p className="text-sm">
							{t("workspaces.invite.invitedTo", {
								workspace: workspaceName,
							})}
						</p>
						<div className="flex justify-center gap-3">
							<Button
								type="button"
								disabled={accept.isPending}
								onClick={() => accept.mutate()}
							>
								{accept.isPending
									? t("workspaces.invite.accepting")
									: t("workspaces.invite.accept")}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={reject.isPending}
								onClick={() => reject.mutate()}
							>
								{t("workspaces.invite.reject")}
							</Button>
						</div>
					</div>
				) : null}

				{outcome === "accepted" ? (
					<p className="mt-6 text-sm">
						{t("workspaces.invite.accepted", {
							workspace: workspaceName,
						})}
					</p>
				) : null}
				{outcome === "alreadyMember" ? (
					<p className="mt-6 text-sm">{t("workspaces.invite.alreadyMember")}</p>
				) : null}
			</div>
		</main>
	);
}
