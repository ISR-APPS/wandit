// Settings tab: stacks the general, publishing and danger-zone cards in a
// narrow scrollable column, with skeleton cards while the workspace loads.

import { Skeleton } from "@wandit/ui/components/skeleton";

import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";
import { DangerZone } from "./danger-zone";
import { GeneralSection } from "./general-section";
import { PublishSection } from "./publish-section";

export function SettingsTab() {
	const { t } = useTranslation();
	const { statePending, projectPending } = useWorkspace();
	const pending = statePending || projectPending;

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
							<DangerZone />
						</>
					)}
				</div>
			</div>
		</div>
	);
}
