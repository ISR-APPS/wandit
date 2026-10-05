/**
 * Domains panel of the More view, web apps only: the free Wandit address
 * once the app is live, then the custom domains section of the domains
 * feature (list, connect, verify, remove, buy). Rendered by
 * components/more/more-view.tsx inside PanelShell, which draws the title.
 * Reads appPublishQuery; DomainsSection reads and writes the V1 domain routes.
 */

import { GlobeIcon } from "@phosphor-icons/react/Globe";
import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";

import { DomainsSection, useDomainCheckoutReturn } from "@/features/domains";
import { useWorkspace } from "@/features/workspaces";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { usePublishApp } from "../../api/publish.mutations";
import { appPublishQuery, isPublishRunning } from "../../api/publish.queries";
import { PANEL_CARD_CLASS, PanelChip, PanelMessage } from "./panel-shell";

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
			<PanelMessage
				icon={WarningCircleIcon}
				text={getApiErrorMessage(publishStatus.error)}
			/>
		) : (
			<Skeleton className="h-[68px] rounded-[20px]" />
		);
	}

	const { live } = publishStatus.data;
	return (
		<>
			<div
				className={cn(
					PANEL_CARD_CLASS,
					"flex items-center gap-3.5 px-5 py-3.5",
				)}
			>
				<span
					aria-hidden
					className={cn(
						"grid size-9 shrink-0 place-items-center rounded-full",
						live
							? "bg-spark/20 text-night dark:bg-spark/15 dark:text-spark"
							: "bg-night/[0.05] text-night/50 dark:bg-white/[0.06] dark:text-foreground/50",
					)}
				>
					<GlobeIcon weight="duotone" className="size-[18px]" />
				</span>
				<div className="min-w-0 flex-1">
					{/* The API builds the URL from the sites domain, so the web never hard-codes it. A host reads left to right. */}
					<div
						className={cn(
							"truncate text-night dark:text-foreground",
							live
								? "font-medium font-mono text-[13.5px]"
								: "font-grotesk font-semibold text-[14px]",
						)}
						dir={live ? "ltr" : undefined}
					>
						{live ? new URL(live.url).host : t("appBuilder.domains.freeTitle")}
					</div>
					<div className="font-sans text-[13px] text-night/55 dark:text-foreground/55">
						{live
							? t("appBuilder.domains.freeHost")
							: t("appBuilder.domains.freeAfterPublish")}
					</div>
				</div>
				{live ? (
					<PanelChip tone="success">
						<span aria-hidden className="size-1.5 rounded-full bg-success" />
						{t("appBuilder.domains.live")}
					</PanelChip>
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
