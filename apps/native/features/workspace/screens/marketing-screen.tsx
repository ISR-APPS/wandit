import { useTranslation } from "@wandit/internationalization/react";

import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function MarketingScreen() {
	const { t } = useTranslation();

	return (
		<WorkspacePlaceholder
			title={t("native.workspace.placeholders.marketingTitle")}
			description={t("native.workspace.placeholders.marketingDescription")}
		/>
	);
}
