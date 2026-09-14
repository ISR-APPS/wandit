/**
 * Frame of one More panel: the title and the description of the panel from
 * MORE_PANEL_META, then the panel body as a column of cards.
 * Rendered by components/more/more-view.tsx around the active panel.
 */

import type { ReactNode } from "react";

import { useTranslation } from "@/lib/i18n";
import { MORE_PANEL_META, type MorePanel } from "../../lib/constants";

export type PanelShellProps = {
	panel: MorePanel;
	/** The panel component, already inside a Suspense boundary. */
	children: ReactNode;
};

export function PanelShell({ panel, children }: PanelShellProps) {
	const { t } = useTranslation();
	const meta = MORE_PANEL_META[panel];

	return (
		<>
			<h1 className="font-semibold text-2xl tracking-tight">{t(meta.title)}</h1>
			<p className="mt-1 text-muted-foreground text-sm">
				{t(meta.description)}
			</p>
			<div className="mt-6 flex max-w-3xl flex-col gap-4">{children}</div>
		</>
	);
}
