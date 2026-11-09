/**
 * The body of the MCP panel of a V2 project: the connect steps, then the id of this project.
 * more-view.tsx of the app builder renders it. It renders ConnectSnippets and CopyableCode.
 * A link opens /coding-agents, where the user sees and revokes the connected agents.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";

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
			<div>
				<h3 className="font-grotesk font-semibold text-base">
					{t("auth.codingAgents.project.title")}
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("auth.codingAgents.project.description")}
				</p>
				<CopyableCode code={projectId} />
			</div>
			<Button asChild variant="outline" size="sm" className="self-start">
				<Link to="/coding-agents">
					{t("auth.codingAgents.project.manageAgents")}
				</Link>
			</Button>
		</div>
	);
}
