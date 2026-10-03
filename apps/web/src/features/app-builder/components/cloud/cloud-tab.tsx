/**
 * Cloud tab of the app builder (WANDIT-188): the panel nav on the start
 * side and the open panel on the other side. Rendered by
 * pages/app-builder-page.tsx, which keeps it mounted while hidden. Renders
 * backend-state.tsx around every panel except Secrets, and one panel
 * component of this folder.
 */

import { cn } from "@wandit/ui/lib/utils";
import {
	CalendarClock,
	Database,
	HardDrive,
	KeyRound,
	type LucideIcon,
	ScrollText,
	SquareFunction,
	Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { CLOUD_PANELS, type CloudPanel } from "../../lib/constants";
import { BackendState } from "./backend-state";
import { DatabasePanel } from "./database-panel";
import { FunctionsPanel } from "./functions-panel";
import { JobsPanel } from "./jobs-panel";
import { type LogsFilter, LogsPanel } from "./logs-panel";
import { SecretsPanel } from "./secrets-panel";
import { StoragePanel } from "./storage-panel";
import { UsersPanel } from "./users-panel";

/** Props of CloudTab. The page owns the open panel through `?cloudPanel=`. */
export type CloudTabProps = {
	projectId: string;
	/** True while the Cloud view is on screen. The tab stays mounted, so every Cloud query waits for it. */
	isActive: boolean;
	/** Open panel, from `?cloudPanel=`; the page passes `database` when the URL has none. */
	panel: CloudPanel;
	onSelectPanel: (panel: CloudPanel) => void;
};

const PANEL_ICONS: Record<CloudPanel, LucideIcon> = {
	database: Database,
	users: Users,
	storage: HardDrive,
	secrets: KeyRound,
	logs: ScrollText,
	functions: SquareFunction,
	jobs: CalendarClock,
};

/** Nav of the seven Cloud panels and the open one. */
export function CloudTab({
	projectId,
	isActive,
	panel,
	onSelectPanel,
}: CloudTabProps) {
	const { t } = useTranslation();
	// The filter Logs opens with. "View logs" of the Functions panel sets it; a nav click clears it.
	const [logsFilter, setLogsFilter] = useState<LogsFilter | undefined>(
		undefined,
	);

	function selectPanel(next: CloudPanel) {
		setLogsFilter(undefined);
		onSelectPanel(next);
	}

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
						onViewLogs={(slug) => {
							// The logs route has no function filter. A function log line
							// holds the function URL, so a search on the slug finds its calls.
							// LIMIT: the search also finds a longer slug that holds this one.
							// Upgrade: a function id filter on the logs route (log_attributes['function_id']).
							setLogsFilter({ source: "functions", search: slug });
							onSelectPanel("logs");
						}}
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

	return (
		// On phones the nav is a strip above the panel. From md it is a column at the start side.
		<div className="flex h-full min-h-0 flex-col md:flex-row">
			<div className="shrink-0 overflow-x-auto border-b p-3 md:w-[220px] md:overflow-y-auto md:border-e md:border-b-0">
				<nav
					aria-label={t("workspace.cloud.navAriaLabel")}
					className="flex gap-0.5 md:flex-col"
				>
					{CLOUD_PANELS.map((item) => {
						const Icon = PANEL_ICONS[item];
						const isOpen = item === panel;
						return (
							<button
								key={item}
								type="button"
								aria-current={isOpen ? "page" : undefined}
								onClick={() => selectPanel(item)}
								className={cn(
									"flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full",
									isOpen
										? "bg-primary/10 font-medium text-ember-strong"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<Icon className="size-4 shrink-0" strokeWidth={1.7} />
								<span className="truncate">
									{t(`workspace.cloud.panels.${item}`)}
								</span>
							</button>
						);
					})}
				</nav>
			</div>
			<div className="min-w-0 flex-1 overflow-y-auto p-6">
				{/* Secrets live in the Wandit database, so only that panel works without a running backend. */}
				{panel === "secrets" ? (
					renderPanel()
				) : (
					<BackendState projectId={projectId} isActive={isActive}>
						{renderPanel()}
					</BackendState>
				)}
			</div>
		</div>
	);
}
