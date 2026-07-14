import { useTranslation } from "@wandit/internationalization/react";

import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function SettingsScreen() {
	const { t } = useTranslation();

	return (
		<WorkspacePlaceholder
			title={t("native.workspace.placeholders.settingsTitle")}
			description={t("native.workspace.placeholders.settingsDescription")}
		/>
	);
}
