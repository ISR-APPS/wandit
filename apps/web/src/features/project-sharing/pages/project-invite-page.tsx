/**
 * `/project-invite/$invitationId`: accept or decline an email invitation to a
 * V2 project (workspaces-sharing.md 6). A signed-out visitor gets the auth
 * modal, which comes back here. Accept opens `/app/$projectId`.
 * Rendered by routes/project-invite.$invitationId.tsx. Reads and writes the invitee routes.
 */
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { toast } from "sonner";

import { useAuthModal, useSession } from "@/features/auth";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import {
	useAcceptProjectInvitation,
	useDeclineProjectInvitation,
} from "../api/sharing.mutations";
import { receivedProjectInvitationQuery } from "../api/sharing.queries";

/** Props of ProjectInvitePage. The route reads them from the URL. */
export type ProjectInvitePageProps = {
	/** Id of the `project_invitations` row, from the invite email link. */
	invitationId: string;
};

/** Asks a signed-out visitor to sign in first, then shows the invitation of the session email. */
export default function ProjectInvitePage({
	invitationId,
}: ProjectInvitePageProps) {
	const { t } = useTranslation();
	const { data: session, isPending: isSessionPending } = useSession();
	const { open: openAuthModal } = useAuthModal();

	return (
		<main className="flex min-h-svh items-center justify-center px-4">
			<div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
				<h1 className="font-display text-xl tracking-tight">
					{t("sharing.invite.title")}
				</h1>
				{isSessionPending ? (
					<Spinner />
				) : session ? (
					<InvitationBody invitationId={invitationId} />
				) : (
					<div className="mt-6 flex flex-col gap-4">
						<p className="text-muted-foreground text-sm">
							{t("sharing.invite.signInFirst")}
						</p>
						<Button
							type="button"
							onClick={() =>
								openAuthModal({ next: `/project-invite/${invitationId}` })
							}
						>
							{t("auth.signIn")}
						</Button>
					</div>
				)}
			</div>
		</main>
	);
}

/** The invitation of the signed-in user, with Accept and Decline while it is pending. */
function InvitationBody({ invitationId }: { invitationId: string }) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const invitation = useQuery(receivedProjectInvitationQuery(invitationId));
	const accept = useAcceptProjectInvitation(invitationId);
	const decline = useDeclineProjectInvitation(invitationId);

	if (invitation.data === undefined) {
		if (!invitation.isError) return <Spinner />;
		// The API answers 404 for an unknown id and for another email address.
		const isInvalid =
			isApiClientError(invitation.error) && invitation.error.statusCode === 404;
		return (
			<p role="alert" className="mt-6 text-muted-foreground text-sm">
				{isInvalid
					? t("sharing.invite.invalid")
					: getApiErrorMessage(invitation.error)}
			</p>
		);
	}

	const data = invitation.data;
	if (data.status !== "pending") {
		return (
			<p className="mt-6 text-muted-foreground text-sm">
				{t("sharing.invite.notPending")}
			</p>
		);
	}
	// The server decides the expiry, not the browser clock.
	if (data.expired) {
		return (
			<p className="mt-6 text-muted-foreground text-sm">
				{t("sharing.invite.expired", { inviter: data.inviterName })}
			</p>
		);
	}

	const isBusy = accept.isPending || decline.isPending;
	return (
		<div className="mt-6 flex flex-col gap-4">
			<p className="text-sm">
				{t("sharing.invite.invitedTo", {
					inviter: data.inviterName,
					project: data.projectName,
					workspace: data.workspaceName,
				})}
			</p>
			<p className="text-muted-foreground text-sm">
				{t("sharing.invite.role", { role: t(`sharing.roles.${data.role}`) })}
			</p>
			<div className="flex justify-center gap-3">
				<Button
					type="button"
					disabled={isBusy}
					onClick={() =>
						accept.mutate(undefined, {
							onSuccess: ({ projectId }) =>
								void navigate({
									to: "/app/$projectId",
									params: { projectId },
								}),
							onError: (error) => toast.error(getApiErrorMessage(error)),
						})
					}
				>
					{t("sharing.invite.accept")}
				</Button>
				<Button
					type="button"
					variant="outline"
					disabled={isBusy}
					onClick={() =>
						decline.mutate(undefined, {
							onSuccess: () => {
								toast.success(t("sharing.invite.declined"));
								void navigate({ to: "/dashboard" });
							},
							onError: (error) => toast.error(getApiErrorMessage(error)),
						})
					}
				>
					{t("sharing.invite.decline")}
				</Button>
			</div>
		</div>
	);
}

/** Loading state of the page. */
function Spinner() {
	return (
		<div className="mt-6 flex justify-center">
			<CircleNotchIcon
				aria-hidden
				weight="bold"
				className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
			/>
		</div>
	);
}
