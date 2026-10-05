/**
 * More view of the app builder: the section nav on the start side and the
 * open panel on the other side. Every panel renders inside panel-shell.tsx,
 * which draws its title; a Cloud panel renders through
 * cloud/cloud-panel-content.tsx. Rendered by pages/app-builder-page.tsx,
 * which keeps it mounted while hidden. Renders more-nav.tsx and one panel.
 */

import { type ReactNode, Suspense, useState } from "react";

import Loader from "@/components/loader";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import {
	type EnabledMorePanel,
	MORE_PANEL_META,
	type ProjectPanel,
} from "../../lib/constants";
import { isCloudPanel } from "../../lib/helpers";
import { CloudPanelContent } from "../cloud/cloud-panel-content";
import type { LogsFilter } from "../cloud/logs-panel";
import { AppStoresPanel } from "./app-stores-panel";
import { DomainsPanel } from "./domains-panel";
import { EmptyPanel } from "./empty-panel";
import { MoreNav } from "./more-nav";
import { PanelShell } from "./panel-shell";
import { PaymentsPanel } from "./payments-panel";
import { SettingsPanel } from "./settings-panel";
import { SignInPanel } from "./sign-in-panel";

/** Props of MoreView. The page owns the open panel through `?panel=`. */
export type MoreViewProps = {
	project: AppProject;
	/** Open panel, already resolved by resolvePanel in the page for the kind and the Cloud gate. */
	panel: ProjectPanel;
	/** True while the More view is on screen. The view stays mounted, so every Cloud query waits for it. */
	isActive: boolean;
	/** True when the nav shows the Backend group. The page reads it from useCloudTabEnabled. */
	showBackendGroup: boolean;
	onSelectPanel: (panel: ProjectPanel) => void;
};

/** Panels with no data yet. Each one shows the empty state with its own button label. */
type EmptyMorePanel = Extract<
	EnabledMorePanel,
	"analytics" | "ai" | "security"
>;

const EMPTY_PANEL_CTA: Record<EmptyMorePanel, TranslationKey> = {
	analytics: "appBuilder.panels.analytics.cta",
	ai: "appBuilder.panels.ai.cta",
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

	function renderMorePanel(morePanel: EnabledMorePanel): ReactNode {
		switch (morePanel) {
			case "analytics":
			case "ai":
			case "security":
				return (
					<EmptyPanel
						icon={MORE_PANEL_META[morePanel].icon}
						ctaLabel={t(EMPTY_PANEL_CTA[morePanel])}
					/>
				);
			case "signIn":
				return <SignInPanel projectId={project.id} />;
			case "payments":
				return <PaymentsPanel />;
			case "domains":
				return <DomainsPanel projectId={project.id} />;
			case "appStores":
				return <AppStoresPanel project={project} />;
			case "settings":
				return <SettingsPanel project={project} />;
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
			<div className="shrink-0 overflow-x-auto border-night/[0.07] border-b bg-night/[0.02] p-2 md:w-[236px] md:overflow-y-auto md:border-e md:border-b-0 md:p-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
				<MoreNav
					kind={project.kind}
					active={panel}
					showBackendGroup={showBackendGroup}
					onSelect={selectFromNav}
				/>
			</div>
			<div className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 md:px-10 md:py-9">
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
						<Suspense fallback={<Loader />}>{renderMorePanel(panel)}</Suspense>
					)}
				</PanelShell>
			</div>
		</div>
	);
}
