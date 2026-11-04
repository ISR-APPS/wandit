/**
 * /invite/$invitationId — accept or decline a workspace email invitation
 * (teams-workspaces.md §9). Unauthenticated visitors are asked to sign in
 * first. A user who is already a member sees a notice, not an error.
 * The Better Auth calls live in `../api` (workspace-members.services.ts).
 */
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuthModal, useSession } from "@/features/auth";
import {
	useAcceptWorkspaceInvitationMutation,
	useRejectWorkspaceInvitationMutation,
} from "@/features/workspaces/api/workspaces.mutations";
import { useWorkspaceInvitationQuery } from "@/features/workspaces/api/workspaces.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";

// The success text stays on screen this long before the dashboard opens.
const ACCEPTED_REDIRECT_DELAY_MS = 1_200;

/** The `/invite/$invitationId` route renders it, outside the `_auth` session gate. */
export default function InvitePage({ invitationId }: { invitationId: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { data: session, isPending: sessionPending } = useSession();
	const { open: openAuthModal } = useAuthModal();
	const { switchWorkspace, workspaces } = useWorkspace();
	const [outcome, setOutcome] = useState<"accepted" | "alreadyMember" | null>(
		null,
	);
	const invitationQuery = useWorkspaceInvitationQuery(invitationId, {
		enabled: Boolean(session),
	});
	const accept = useAcceptWorkspaceInvitationMutation();
	const reject = useRejectWorkspaceInvitationMutation();
	const organizationId = invitationQuery.data?.organizationId;
	const workspaceName = invitationQuery.data?.organizationName ?? "";

	const finish = (state: "accepted" | "alreadyMember") => {
		setOutcome(state);

		if (organizationId) {
			switchWorkspace(organizationId);
		}

		window.setTimeout(() => {
			void navigate({ to: "/dashboard" });
		}, ACCEPTED_REDIRECT_DELAY_MS);
	};

	const acceptInvitation = () => {
		accept.mutate(invitationId, {
			onSuccess: () => finish("accepted"),
			onError: (error) => {
				// A user who joined by link can still hold this invitation; the unique member row refuses it.
				if (workspaces.some((entry) => entry.id === organizationId)) {
					finish("alreadyMember");
					return;
				}

				toast.error(getApiErrorMessage(error));
			},
		});
	};

	const rejectInvitation = () => {
		reject.mutate(invitationId, {
			onSuccess: () => {
				void navigate({ to: "/dashboard" });
			},
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	};

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
								onClick={acceptInvitation}
							>
								{accept.isPending
									? t("workspaces.invite.accepting")
									: t("workspaces.invite.accept")}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={reject.isPending}
								onClick={rejectInvitation}
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
