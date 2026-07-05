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

type DomainsSectionProps = {
	projectId: string;
};

export function DomainsSection({ projectId }: DomainsSectionProps) {
	const { t } = useTranslation();
	const domains = useDomainsQuery(projectId);
	const [buyOpen, setBuyOpen] = useState(false);

	return (
		<Card>
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
					<Button type="button" size="sm" onClick={() => setBuyOpen(true)}>
						<Plus />
						{t("settings.domains.buyCta")}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
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
					<DomainList projectId={projectId} domains={domains.data ?? []} />
				)}

				<ConnectExternalDomain projectId={projectId} />
			</CardContent>
			<BuyDomainDialog
				projectId={projectId}
				open={buyOpen}
				onOpenChange={setBuyOpen}
			/>
		</Card>
	);
}
