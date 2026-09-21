/**
 * More view of the app builder: the section nav on the start side and the
 * active panel on the other side. Picks the panel component from `panel`.
 * Rendered by pages/app-builder-page.tsx. Renders more-nav.tsx,
 * panel-shell.tsx, and one panel component of this folder.
 */

import { type ReactNode, Suspense } from "react";

import Loader from "@/components/loader";
import { type TranslationKey, useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { MorePanel } from "../../lib/constants";
import { AppStoresPanel } from "./app-stores-panel";
import { BackendPanel } from "./backend-panel";
import { DomainsPanel } from "./domains-panel";
import { EmptyPanel } from "./empty-panel";
import { MoreNav } from "./more-nav";
import { PanelShell } from "./panel-shell";
import { PaymentsPanel } from "./payments-panel";
import { SettingsPanel } from "./settings-panel";
import { SignInPanel } from "./sign-in-panel";

export type MoreViewProps = {
	project: AppProject;
	/** Already resolved for the project kind by the page. */
	panel: MorePanel;
	onSelectPanel: (panel: MorePanel) => void;
};

/** Panels with no data yet. Each one shows the empty state with its own button label. */
type EmptyMorePanel = Extract<
	MorePanel,
	"analytics" | "ai" | "integrations" | "security"
>;

const EMPTY_PANEL_CTA: Record<EmptyMorePanel, TranslationKey> = {
	analytics: "appBuilder.panels.analytics.cta",
	ai: "appBuilder.panels.ai.cta",
	integrations: "appBuilder.panels.integrations.cta",
	security: "appBuilder.panels.security.cta",
};

export function MoreView({ project, panel, onSelectPanel }: MoreViewProps) {
	const { t } = useTranslation();

	function renderPanel(): ReactNode {
		switch (panel) {
			case "analytics":
			case "ai":
			case "integrations":
			case "security":
				return <EmptyPanel ctaLabel={t(EMPTY_PANEL_CTA[panel])} />;
			case "backend":
				return <BackendPanel projectId={project.id} />;
			case "signIn":
				return <SignInPanel projectId={project.id} />;
			case "payments":
				return <PaymentsPanel projectId={project.id} />;
			case "domains":
				return <DomainsPanel projectId={project.id} />;
			case "appStores":
				return <AppStoresPanel project={project} />;
			case "settings":
				return <SettingsPanel project={project} />;
			default: {
				// The compiler fails here when MORE_PANELS gains a panel without a case above.
				const unhandled: never = panel;
				return unhandled;
			}
		}
	}

	return (
		// On phones the nav is a strip above the panel. From md it is a column at the start side.
		<div className="flex h-full min-h-0 flex-col md:flex-row">
			<div className="shrink-0 overflow-x-auto border-b p-3 md:w-[220px] md:overflow-y-auto md:border-e md:border-b-0">
				<MoreNav kind={project.kind} active={panel} onSelect={onSelectPanel} />
			</div>
			<div className="min-w-0 flex-1 overflow-y-auto p-6">
				<PanelShell panel={panel}>
					<Suspense fallback={<Loader />}>{renderPanel()}</Suspense>
				</PanelShell>
			</div>
		</div>
	);
}
