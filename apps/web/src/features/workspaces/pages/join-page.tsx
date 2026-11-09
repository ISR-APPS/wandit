/**
 * /join/$token — joins a workspace or a V2 project through an invite link
 * (workspaces-sharing.md 5). A signed-out visitor gets the auth modal, with
 * `next` set back to this page. It reads the link preview, then accepts:
 * a workspace link switches into that workspace, a project link opens the builder.
 */

import { useNavigate } from "@tanstack/react-router";
import { inviteLinkTokenSchema } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { toast } from "sonner";

import { useAuthModal, useSession } from "@/features/auth";
import { useAcceptInviteLinkMutation } from "@/features/workspaces/api/workspaces.mutations";
import { useInviteLinkPreviewQuery } from "@/features/workspaces/api/workspaces.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";

/** The `/join/$token` route renders it, outside the `_auth` session gate. */
export default function JoinPage({
	token,
}: {
	/** The link token from the URL. The page checks its format before any API call. */
	token: string;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { data: session, isPending: sessionPending } = useSession();
	const { open: openAuthModal } = useAuthModal();
	const { switchWorkspace } = useWorkspace();
	// The token comes from the URL, so a malformed one never reaches the API.
	const isTokenWellFormed = inviteLinkTokenSchema.safeParse(token).success;
	const previewQuery = useInviteLinkPreviewQuery(token, {
		enabled: Boolean(session) && isTokenWellFormed,
	});
	const accept = useAcceptInviteLinkMutation();
	const joinPath = `/join/${token}`;

	// A signed-out visitor sees the sign-in modal at once. After sign-in, `next` brings them back.
	useEffect(() => {
		if (!sessionPending && !session && isTokenWellFormed) {
			openAuthModal({ next: joinPath });
		}
	}, [isTokenWellFormed, joinPath, openAuthModal, session, sessionPending]);

	const errorMessage = (error: Error): string =>
		// An unknown or revoked token answers 404 INVITE_LINK_INVALID.
		isApiClientError(error) && error.code === "INVITE_LINK_INVALID"
			? t("workspaces.join.invalid")
			: getApiErrorMessage(error);

	const join = () => {
		accept.mutate(token, {
			onSuccess: (answer) => {
				if (answer.kind === "workspace") {
					switchWorkspace(answer.organizationId);
					void navigate({ to: "/dashboard" });
					return;
				}

				void navigate({
					to: "/app/$projectId",
					params: { projectId: answer.projectId },
				});
			},
			onError: (error) => toast.error(errorMessage(error)),
		});
	};

	const spinner = (
		<div className="mt-6 flex justify-center">
			<Loader2 className="size-5 animate-spin text-muted-foreground" />
		</div>
	);

	const renderBody = (): ReactNode => {
		if (!isTokenWellFormed) {
			return (
				<p className="mt-6 text-muted-foreground text-sm">
					{t("workspaces.join.invalid")}
				</p>
			);
		}

		if (sessionPending) {
			return spinner;
		}

		if (!session) {
			return (
				<div className="mt-6 flex flex-col gap-4">
					<p className="text-muted-foreground text-sm">
						{t("workspaces.join.signInFirst")}
					</p>
					<Button
						type="button"
						onClick={() => openAuthModal({ next: joinPath })}
					>
						{t("auth.signIn")}
					</Button>
				</div>
			);
		}

		if (previewQuery.isPending) {
			return spinner;
		}

		if (previewQuery.isError) {
			return (
				<p className="mt-6 text-muted-foreground text-sm">
					{errorMessage(previewQuery.error)}
				</p>
			);
		}

		const preview = previewQuery.data;

		if (preview.expired) {
			return (
				<p className="mt-6 text-muted-foreground text-sm">
					{t("workspaces.join.expired", { inviter: preview.inviterName })}
				</p>
			);
		}

		return (
			<div className="mt-6 flex flex-col gap-4">
				<p className="text-sm">
					{preview.kind === "workspace"
						? t("workspaces.join.workspaceInvite", {
								inviter: preview.inviterName,
								workspace: preview.workspaceName,
								role: t(`workspaces.roles.${preview.role}`),
							})
						: t("workspaces.join.projectInvite", {
								inviter: preview.inviterName,
								project: preview.projectName,
								role: t(`workspaces.projectRoles.${preview.role}`),
							})}
				</p>
				<Button type="button" disabled={accept.isPending} onClick={join}>
					{accept.isPending
						? t("workspaces.join.joining")
						: t("workspaces.join.join")}
				</Button>
			</div>
		);
	};

	return (
		<main className="flex min-h-svh items-center justify-center px-4">
			<div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
				<h1 className="font-display text-xl tracking-tight">
					{t("workspaces.join.title")}
				</h1>
				{renderBody()}
			</div>
		</main>
	);
}
