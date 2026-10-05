/**
 * "Soon" state of a More panel that Wandit cannot set up yet: Analytics, AI,
 * and Security. The panel icon on the night tile, a title, a hint, and the
 * planned action as a disabled pill with a "Soon" chip, like the nav row.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import type { Icon } from "@phosphor-icons/react";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import {
	PANEL_PRIMARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "./panel-shell";

export type EmptyPanelProps = {
	/** Icon of the panel from MORE_PANEL_META, so each empty panel keeps its own sign. */
	icon: Icon;
	/** Translated label of the planned action, for example "Turn on analytics". */
	ctaLabel: string;
};

export function EmptyPanel({ icon, ctaLabel }: EmptyPanelProps) {
	const { t } = useTranslation();

	return (
		<PanelMessage
			tone="feature"
			icon={icon}
			title={t("appBuilder.empty.title")}
			text={t("appBuilder.empty.description")}
		>
			<div className="flex items-center gap-2">
				<Button
					disabled
					className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
				>
					{ctaLabel}
				</Button>
				<PanelChip tone="ember">{t("appBuilder.soon")}</PanelChip>
			</div>
		</PanelMessage>
	);
}
