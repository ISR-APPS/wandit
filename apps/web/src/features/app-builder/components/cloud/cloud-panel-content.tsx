/**
 * The open Cloud panel of the More view (WANDIT-188). Picks the panel
 * component from `panel` and wraps it in backend-state.tsx, except Secrets.
 * Rendered by components/more/more-view.tsx, which owns the nav, the open
 * panel, and the filter that Logs opens with.
 */

import type { ReactNode } from "react";

import type { CloudPanel } from "../../lib/constants";
import { BackendState } from "./backend-state";
import { DatabasePanel } from "./database-panel";
import { FunctionsPanel } from "./functions-panel";
import { JobsPanel } from "./jobs-panel";
import { type LogsFilter, LogsPanel } from "./logs-panel";
import { SecretsPanel } from "./secrets-panel";
import { StoragePanel } from "./storage-panel";
import { UsersPanel } from "./users-panel";

/** Props of CloudPanelContent. The More view owns the open panel through `?panel=`. */
export type CloudPanelContentProps = {
	projectId: string;
	/** True while the More view is on screen. The view stays mounted, so every Cloud query waits for it. */
	isActive: boolean;
	/** Open panel, from `?panel=`, already checked against the Cloud gate by resolvePanel. */
	panel: CloudPanel;
	/** Filter Logs opens with. "View logs" of the Functions panel sets it; a nav click clears it. */
	logsFilter: LogsFilter | undefined;
	/** "View logs" of one function, with its slug. The More view sets the filter and opens Logs. */
	onViewFunctionLogs: (slug: string) => void;
};

/** One of the seven Cloud panels, inside the backend gate when it needs a running backend. */
export function CloudPanelContent({
	projectId,
	isActive,
	panel,
	logsFilter,
	onViewFunctionLogs,
}: CloudPanelContentProps) {
	function renderPanel(): ReactNode {
		switch (panel) {
			case "database":
				return <DatabasePanel projectId={projectId} isActive={isActive} />;
			case "users":
				return <UsersPanel projectId={projectId} isActive={isActive} />;
			case "storage":
				return <StoragePanel projectId={projectId} isActive={isActive} />;
			case "secrets":
				return <SecretsPanel projectId={projectId} isActive={isActive} />;
			case "logs":
				return (
					<LogsPanel
						projectId={projectId}
						isActive={isActive}
						initialFilter={logsFilter}
					/>
				);
			case "functions":
				return (
					<FunctionsPanel
						projectId={projectId}
						isActive={isActive}
						onViewLogs={onViewFunctionLogs}
					/>
				);
			case "jobs":
				return <JobsPanel projectId={projectId} isActive={isActive} />;
			default: {
				// The compiler fails here when CLOUD_PANELS gains a panel without a case above.
				const unhandled: never = panel;
				return unhandled;
			}
		}
	}

	// Secrets live in the Wandit database, so only that panel works without a running backend.
	if (panel === "secrets") return renderPanel();
	return (
		<BackendState projectId={projectId} isActive={isActive}>
			{renderPanel()}
		</BackendState>
	);
}
