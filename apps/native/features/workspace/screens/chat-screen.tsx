import { useTranslation } from "@wandit/internationalization/react";

import { WorkspacePlaceholder } from "../components/workspace-placeholder";

export function ChatScreen() {
	const { t } = useTranslation();

	return (
		<WorkspacePlaceholder
			title={t("native.workspace.placeholders.chatTitle")}
			description={t("native.workspace.placeholders.chatDescription")}
		/>
	);
}
