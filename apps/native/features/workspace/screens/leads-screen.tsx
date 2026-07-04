import { useTranslation } from "@wandit/internationalization/react";

import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function LeadsScreen() {
	const { t } = useTranslation();

	return (
		<WorkspacePlaceholder
			title={t("native.workspace.placeholders.leadsTitle")}
			description={t("native.workspace.placeholders.leadsDescription")}
		/>
	);
}
