/**
 * Dashboard banner for workspace invitations addressed to the signed-in user.
 * With no invite emails yet (no email infra), this is how an existing user
 * discovers an invitation without being sent the link (teams-workspaces.md §9).
 * Ships dark: renders nothing while organizations are disabled and the user
 * has no memberships.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Mail } from "lucide-react";

import { useSession } from "@/features/auth";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { useUserInvitationsQuery } from "@/features/workspaces/api/workspaces.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

export function PendingInvitesBanner({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { data: session } = useSession();
	const settingsQuery = usePublicSettingsQuery();
	const { workspaces } = useWorkspace();
	const organizationsEnabled =
		settingsQuery.data?.organizationsEnabled ?? false;
	const enabled =
		Boolean(session) && (organizationsEnabled || workspaces.length > 0);
	const invitationsQuery = useUserInvitationsQuery({ enabled });
	const pending = invitationsQuery.data ?? [];
	const first = pending[0];

	if (!enabled || !first) {
		return null;
	}

	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] px-4 py-3",
				className,
			)}
		>
			<Mail className="size-4 shrink-0 text-primary" aria-hidden />
			<p className="min-w-0 flex-1 text-sm">
				{t("workspaces.invite.pendingBanner", { count: pending.length })}
			</p>
			<Button asChild size="sm" variant="outline" className="shrink-0">
				<Link
					to="/invite/$invitationId"
					params={{ invitationId: first.id }}
				>
					{t("workspaces.invite.pendingBannerCta")}
				</Link>
			</Button>
		</div>
	);
}
