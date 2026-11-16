/**
 * The custom domains card of a project: the domain list, the buy dialog, and the connect form.
 * The V1 settings tab (workspace/components/settings/settings-tab.tsx) and the V2 Domains panel
 * (app-builder/components/more/domains-panel.tsx) render it. It reads useDomainsQuery.
 */
import { Button } from "@wandit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Globe2, Plus } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useDomainsQuery } from "../api/domains.queries";
import { BuyDomainDialog } from "./buy-domain-dialog";
import { ConnectExternalDomain } from "./connect-external-domain";
import { DomainList } from "./domain-list";
import { DomainPublishNotice } from "./domain-publish-notice";

type DomainsSectionProps = {
	/** Classes of the card. The V2 Domains panel passes its panel card face; the V1 settings tab passes nothing. */
	className?: string;
	projectId: string;
	isPublished: boolean;
	canManageDomains: boolean;
	canPublish: boolean;
	onPublish: () => void;
};

export function DomainsSection({
	className,
	projectId,
	isPublished,
	canManageDomains,
	canPublish,
	onPublish,
}: DomainsSectionProps) {
	const { t } = useTranslation();
	const domains = useDomainsQuery(projectId);
	const [buyOpen, setBuyOpen] = useState(false);
	const hasAttachedDomain =
		domains.data?.some(
			(domain) =>
				domain.status !== "failed" &&
				domain.status !== "expired" &&
				domain.status !== "transferred_out",
		) ?? false;

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle className="font-display">
							{t("settings.domains.title")}
						</CardTitle>
						<CardDescription>
							{t("settings.domains.description")}
						</CardDescription>
					</div>
					{canManageDomains ? (
						<Button type="button" size="sm" onClick={() => setBuyOpen(true)}>
							<Plus />
							{t("settings.domains.buyCta")}
						</Button>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{hasAttachedDomain && !isPublished ? (
					<DomainPublishNotice canPublish={canPublish} onPublish={onPublish} />
				) : null}
				{domains.isPending ? (
					<div className="flex flex-col gap-2">
						<Skeleton className="h-12 rounded-lg" />
						<Skeleton className="h-12 rounded-lg" />
						<Skeleton className="h-12 rounded-lg" />
					</div>
				) : domains.isError ? (
					<div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
						<Globe2 className="mt-0.5 size-4 text-destructive" />
						<div>
							<p className="font-medium text-destructive">
								{t("settings.domains.loadErrorTitle")}
							</p>
							<p className="mt-1 text-muted-foreground">
								{getApiErrorMessage(domains.error)}
							</p>
						</div>
					</div>
				) : (
					<DomainList
						projectId={projectId}
						domains={domains.data ?? []}
						canManageDomains={canManageDomains}
					/>
				)}

				{canManageDomains ? (
					<ConnectExternalDomain projectId={projectId} />
				) : null}
			</CardContent>
			<BuyDomainDialog
				projectId={projectId}
				open={buyOpen}
				onOpenChange={setBuyOpen}
			/>
		</Card>
	);
}
