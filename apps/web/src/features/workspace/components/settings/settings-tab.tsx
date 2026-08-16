// Settings tab: stacks the general, publishing and danger-zone cards in a
// narrow scrollable column, with skeleton cards while the workspace loads.

import { Skeleton } from "@wandit/ui/components/skeleton";

import { DomainsSection } from "@/features/domains";
import { useWorkspace as useActiveWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import { publishableVersion } from "../../lib/publish-state";
import { useWorkspace } from "../../lib/store";
import { DangerZone } from "./danger-zone";
import { GeneralSection } from "./general-section";
import { PublishSection } from "./publish-section";

export function SettingsTab() {
	const { t } = useTranslation();
	const { actorCanManageWorkspace } = useActiveWorkspace();
	const {
		deployment,
		deploymentPending,
		previewVersion,
		projectId,
		versionsPending,
		projectPending,
		publish,
		publishPending,
		serverActiveVersion,
	} = useWorkspace();
	const pending = versionsPending || projectPending || deploymentPending;
	const isPublished = deployment?.publishedVersionId != null;
	const versionToPublish = publishableVersion(
		deployment,
		previewVersion,
		serverActiveVersion,
	);
	const canPublish = versionToPublish !== null && !publishPending;

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8">
				<h2 className="font-display font-semibold text-lg">
					{t("settings.title")}
				</h2>
				<div className="mt-6 flex flex-col gap-6">
					{pending ? (
						<>
							<Skeleton className="h-64 rounded-xl" />
							<Skeleton className="h-80 rounded-xl" />
							<Skeleton className="h-36 rounded-xl" />
						</>
					) : (
						<>
							<GeneralSection />
							<PublishSection />
							<DomainsSection
								projectId={projectId}
								isPublished={isPublished}
								canManageDomains={actorCanManageWorkspace}
								canPublish={canPublish}
								onPublish={() => {
									if (versionToPublish) publish({ version: versionToPublish });
								}}
							/>
							<DangerZone />
						</>
					)}
				</div>
			</div>
		</div>
	);
}
