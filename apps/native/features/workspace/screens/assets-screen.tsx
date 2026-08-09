import { useTranslation } from "@wandit/internationalization/react";

import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function AssetsScreen() {
	const { t } = useTranslation();

	return (
		<WorkspacePlaceholder
			title={t("native.workspace.placeholders.assetsTitle")}
			description={t("native.workspace.placeholders.assetsDescription")}
		/>
	);
}
