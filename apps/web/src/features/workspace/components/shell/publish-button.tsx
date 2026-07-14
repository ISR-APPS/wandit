// Header publish control — always the ember pill; every state opens the
// publish panel (dc 4a), which owns the whole journey (config, progress,
// live link, updates, history, custom domains). The button only mirrors the
// deploy state with a spinner while a publish runs.

import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Loader2 } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { useWorkspace } from "../../lib/store";

export function PublishButton() {
	const { t } = useTranslation();
	const { state, statePending, openPublishPanel } = useWorkspace();
	const deployment = state?.deployment;

	if (statePending || !deployment) {
		return <Skeleton className="h-8 w-24 rounded-full" />;
	}

	const publishing = deployment.state === "publishing";

	return (
		<Button size="sm" onClick={openPublishPanel} className="h-8 px-4">
			{publishing ? <Loader2 className="size-3.5 animate-spin" /> : null}
			{publishing
				? t("workspace.publish.publishing")
				: t("workspace.publish.publish")}
		</Button>
	);
}
