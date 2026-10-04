/**
 * Domains panel of the More view, web apps only: the free Wandit address
 * once the app is live, then the custom domains section of the domains
 * feature (list, connect, verify, remove, buy). Rendered by
 * components/more/more-view.tsx inside PanelShell, which draws the title.
 * Reads appPublishQuery; DomainsSection reads and writes the V1 domain routes.
 */

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@wandit/ui/components/badge";
import { Skeleton } from "@wandit/ui/components/skeleton";

import { DomainsSection, useDomainCheckoutReturn } from "@/features/domains";
import { useWorkspace } from "@/features/workspaces";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { usePublishApp } from "../../api/publish.mutations";
import { appPublishQuery, isPublishRunning } from "../../api/publish.queries";

export type DomainsPanelProps = {
	projectId: string;
};

export function DomainsPanel({ projectId }: DomainsPanelProps) {
	const { t } = useTranslation();
	const { actorCanManageWorkspace } = useWorkspace();
	const publishStatus = useQuery(appPublishQuery(projectId));
	const publish = usePublishApp(projectId);
	// A domain purchase returns from Stripe to this panel. The hook shows the result and refreshes the list.
	useDomainCheckoutReturn(projectId);

	// A failed poll keeps the last status on screen. Only a first load without a status shows the error.
	if (publishStatus.data === undefined) {
		return publishStatus.isError ? (
			<p className="text-muted-foreground text-sm">
				{getApiErrorMessage(publishStatus.error)}
			</p>
		) : (
			<Skeleton className="h-16 rounded-2xl" />
		);
	}

	const { live } = publishStatus.data;
	return (
		<>
			<div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
				<div className="min-w-0">
					{/* The API builds the URL from the sites domain, so the web never hard-codes it. A host reads left to right. */}
					<div
						className="truncate font-semibold"
						dir={live ? "ltr" : undefined}
					>
						{live ? new URL(live.url).host : t("appBuilder.domains.freeTitle")}
					</div>
					<div className="text-muted-foreground text-xs">
						{live
							? t("appBuilder.domains.freeHost")
							: t("appBuilder.domains.freeAfterPublish")}
					</div>
				</div>
				{live ? (
					<Badge variant="success">
						<span aria-hidden className="size-1.5 rounded-full bg-success" />
						{t("appBuilder.domains.live")}
					</Badge>
				) : null}
			</div>
			<DomainsSection
				projectId={projectId}
				isPublished={live !== null}
				canManageDomains={actorCanManageWorkspace}
				// One publish runs at a time. The API answers 409 PUBLISH_ACTIVE to a second one.
				canPublish={!publish.isPending && !isPublishRunning(publishStatus.data)}
				// A new key per click, like the Publish button of the top bar.
				onPublish={() => publish.mutate(crypto.randomUUID())}
			/>
		</>
	);
}
