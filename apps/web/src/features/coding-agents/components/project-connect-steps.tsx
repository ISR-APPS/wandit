/**
 * The body of the MCP panel of a V2 project: the connect steps, then the id of this project.
 * more-view.tsx of the app builder renders it. It renders ConnectSnippets and CopyableCode.
 * A link opens /coding-agents, where the user sees and revokes the connected agents.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import {
	PANEL_CARD_ROW_CLASS,
	PANEL_CARD_TITLE_CLASS,
	PANEL_HINT_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
} from "@/features/app-builder";
import { useTranslation } from "@/lib/i18n";
import { ConnectSnippets, CopyableCode } from "./connect-snippets";

/** The connect steps for one project. Each MCP tool names a project by its id, so the panel shows the id to copy. */
export function ProjectConnectSteps({
	projectId,
}: {
	/** Id of the V2 project. The MCP tools take it as `projectId`. */
	projectId: string;
}) {
	const { t } = useTranslation();
	return (
		<div className="flex flex-col gap-6">
			<ConnectSnippets />
			<div className={cn(PANEL_CARD_ROW_CLASS, "pt-6")}>
				<h3 className={PANEL_CARD_TITLE_CLASS}>
					{t("auth.codingAgents.project.title")}
				</h3>
				<p className={cn(PANEL_HINT_CLASS, "mt-1")}>
					{t("auth.codingAgents.project.description")}
				</p>
				<CopyableCode code={projectId} />
			</div>
			<Button
				asChild
				variant="outline"
				size="sm"
				className={cn(PANEL_SECONDARY_BUTTON_CLASS, "self-start")}
			>
				<Link to="/coding-agents">
					{t("auth.codingAgents.project.manageAgents")}
				</Link>
			</Button>
		</div>
	);
}
