/**
 * Empty state of a More panel that has nothing set up yet: Analytics, AI,
 * and Security. The panel icon on the night tile, a title, a hint, and one
 * ember button. Rendered by components/more/more-view.tsx inside PanelShell.
 */

import type { Icon } from "@phosphor-icons/react";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { PANEL_PRIMARY_BUTTON_CLASS, PanelMessage } from "./panel-shell";

export type EmptyPanelProps = {
	/** Icon of the panel from MORE_PANEL_META, so each empty panel keeps its own sign. */
	icon: Icon;
	/** Translated label of the one action, for example "Turn on analytics". */
	ctaLabel: string;
	/** Runs on the button. Without it the button shows the "not connected" toast. */
	onCta?: () => void;
};

export function EmptyPanel({ icon, ctaLabel, onCta }: EmptyPanelProps) {
	const { t } = useTranslation();

	return (
		<PanelMessage
			tone="feature"
			icon={icon}
			title={t("appBuilder.empty.title")}
			text={t("appBuilder.empty.description")}
		>
			<Button
				className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-10 px-5")}
				onClick={onCta ?? (() => toast(t("appBuilder.mock.notWired")))}
			>
				{ctaLabel}
			</Button>
		</PanelMessage>
	);
}
