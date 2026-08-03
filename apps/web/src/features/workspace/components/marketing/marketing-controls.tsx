// Marketing tab controls, rendered inside the main card's header (see
// shell/main-pane-header.tsx): asset count + a real refresh of the
// marketing-assets list.

import { Button } from "@wandit/ui/components/button";
import { Loader2, RefreshCw } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { useMarketingAssetsQuery } from "../../api/marketing-assets.queries";
import { useWorkspaceProjectId } from "../../lib/store";

export function MarketingControls() {
	const { t } = useTranslation();
	const projectId = useWorkspaceProjectId();
	const assetsQuery = useMarketingAssetsQuery(projectId);
	const count = assetsQuery.data?.length ?? 0;

	return (
		<div className="flex items-center gap-1.5">
			{count > 0 ? (
				<span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
					{t("workspace.marketing.countLabel", { count })}
				</span>
			) : null}
			<Button
				variant="outline"
				size="sm"
				className="h-8 rounded-lg"
				onClick={() => void assetsQuery.refetch()}
				disabled={assetsQuery.isFetching}
			>
				{assetsQuery.isFetching ? (
					<Loader2 className="size-3.5 animate-spin" />
				) : (
					<RefreshCw className="size-3.5" />
				)}
				<span className="hidden sm:inline">
					{t("workspace.marketing.refresh")}
				</span>
			</Button>
		</div>
	);
}
