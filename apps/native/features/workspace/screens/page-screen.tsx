import { useTranslation } from "@wandit/internationalization/react";

import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function PageScreen() {
	const { t } = useTranslation();

	return (
		<WorkspacePlaceholder
			title={t("native.workspace.placeholders.pageTitle")}
			description={t("native.workspace.placeholders.pageDescription")}
		/>
	);
}
