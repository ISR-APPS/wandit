/**
 * More view of the app builder: the section nav on the start side and the
 * open panel on the other side. The nav lies on the white stage sheet. The
 * panel lies on a sand ground, so its white cards lift off it.
 * Every panel renders inside panel-shell.tsx,
 * which draws its icon tile and its title; a Cloud panel renders through
 * cloud/cloud-panel-content.tsx. Rendered by pages/app-builder-page.tsx,
 * which keeps it mounted while hidden. Renders more-nav.tsx and one panel.
 * A project viewer gets a note in place of the AI panel. The MCP panel body
 * comes from the coding-agents feature.
 */

import { InfoIcon } from "@phosphor-icons/react/Info";
import { cn } from "@wandit/ui/lib/utils";
import { type ReactNode, useState } from "react";

import { ProjectConnectSteps } from "@/features/coding-agents";
import { hasProjectRole } from "@/features/project-sharing";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { MorePanel, ProjectPanel } from "../../lib/constants";
import { isCloudPanel } from "../../lib/helpers";
import { CloudPanelContent } from "../cloud/cloud-panel-content";
import type { LogsFilter } from "../cloud/logs-panel";
import { AiPanel } from "./ai-panel";
import { AppStoresPanel } from "./app-stores-panel";
import { DomainsPanel } from "./domains-panel";
import { EmptyPanel } from "./empty-panel";
import { IntegrationsPanel } from "./integrations-panel";
import { MoreNav } from "./more-nav";
import { PANEL_CARD_CLASS, PanelMessage, PanelShell } from "./panel-shell";
import { PaymentsPanel } from "./payments-panel";
import { SettingsPanel } from "./settings-panel";
import { SignInPanel } from "./sign-in-panel";

/** Props of MoreView. The page owns the open panel through `?panel=`. */
export type MoreViewProps = {
	project: AppProject;
	/** Open panel, already resolved by resolvePanel in the page for the kind and the Cloud gate. */
	panel: ProjectPanel;
	/** True while the More view is on screen. The view stays mounted, so every Cloud query and the AI status wait for it. */
	isActive: boolean;
	/** True when the nav shows the Backend group. The page reads it from useCloudTabEnabled. */
	showBackendGroup: boolean;
	onSelectPanel: (panel: ProjectPanel) => void;
};

/** Panels that are not built yet. Each one shows the Soon state with its own action label. */
type EmptyMorePanel = Extract<MorePanel, "analytics" | "security">;

const EMPTY_PANEL_CTA: Record<EmptyMorePanel, TranslationKey> = {
	analytics: "appBuilder.panels.analytics.cta",
	security: "appBuilder.panels.security.cta",
};

/** The nav and one open panel. Also keeps the filter that Logs opens with after "View logs". */
export function MoreView({
	project,
	panel,
	isActive,
	showBackendGroup,
	onSelectPanel,
}: MoreViewProps) {
	const { t } = useTranslation();
	// The filter Logs opens with. "View logs" of the Functions panel sets it; a nav click clears it.
	const [logsFilter, setLogsFilter] = useState<LogsFilter | undefined>(
		undefined,
	);

	function selectFromNav(next: ProjectPanel) {
		setLogsFilter(undefined);
		onSelectPanel(next);
	}

	function renderMorePanel(morePanel: MorePanel): ReactNode {
		switch (morePanel) {
			case "analytics":
			case "security":
				return <EmptyPanel ctaLabel={t(EMPTY_PANEL_CTA[morePanel])} />;
			case "ai":
				// Every AI key route needs the editor role, the GET too. A viewer gets a note and no API call.
				return hasProjectRole(project.access, "editor") ? (
					<AiPanel projectId={project.id} isActive={isActive} />
				) : (
					<PanelMessage
						icon={InfoIcon}
						text={t("sharing.readOnly.editorsOnly")}
					/>
				);
			case "signIn":
				return <SignInPanel projectId={project.id} />;
			case "payments":
				return <PaymentsPanel />;
			case "integrations":
				return <IntegrationsPanel project={project} isActive={isActive} />;
			case "mcp":
				return (
					<section className={cn(PANEL_CARD_CLASS, "p-5 sm:p-6")}>
						<ProjectConnectSteps projectId={project.id} />
					</section>
				);
			case "domains":
				return <DomainsPanel projectId={project.id} access={project.access} />;
			case "appStores":
				return <AppStoresPanel projectId={project.id} />;
			case "settings":
				return (
					<SettingsPanel
						project={project}
						// Without the Backend group the Secrets panel does not open, so Settings hides its link.
						onOpenSecrets={
							showBackendGroup ? () => selectFromNav("secrets") : undefined
						}
					/>
				);
			default: {
				// The compiler fails here when MORE_PANELS gains a panel without a case above.
				const unhandled: never = morePanel;
				return unhandled;
			}
		}
	}

	return (
		// On phones the nav is a strip above the panel. From md it is a column at the start side.
		<div className="flex h-full min-h-0 flex-col md:flex-row">
			<div className="shrink-0 overflow-x-auto border-night/[0.07] border-b p-2 md:w-[236px] md:overflow-y-auto md:border-e md:border-b-0 md:p-3 dark:border-white/[0.07]">
				<MoreNav
					kind={project.kind}
					active={panel}
					showBackendGroup={showBackendGroup}
					onSelect={selectFromNav}
				/>
			</div>
			{/* The sand ground of the panel. In dark mode the stage is already sand, so a black shade makes the ground one step deeper. */}
			<div className="scroll-warm min-w-0 flex-1 overflow-y-auto bg-sand/70 px-4 py-6 sm:px-8 md:px-10 md:py-10 dark:bg-black/15">
				<PanelShell panel={panel}>
					{isCloudPanel(panel) ? (
						<CloudPanelContent
							projectId={project.id}
							isActive={isActive}
							panel={panel}
							logsFilter={logsFilter}
							onViewFunctionLogs={(slug) => {
								// The logs route has no function filter. A function log line
								// holds the function URL, so a search on the slug finds its calls.
								// LIMIT: the search also finds a longer slug that holds this one.
								// Upgrade: a function id filter on the logs route (log_attributes['function_id']).
								setLogsFilter({ source: "functions", search: slug });
								onSelectPanel("logs");
							}}
						/>
					) : (
						renderMorePanel(panel)
					)}
				</PanelShell>
			</div>
		</div>
	);
}
