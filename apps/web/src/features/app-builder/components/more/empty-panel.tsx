/**
 * "Soon" state of a More panel that Wandit cannot set up yet: Analytics.
 * It shows an hourglass on the night tile, a title, and a hint. The
 * planned action is a disabled pill with a "Soon" chip.
 * Rendered by components/more/more-view.tsx inside PanelShell, which shows
 * the icon of the panel in its header.
 */

import { HourglassIcon } from "@phosphor-icons/react/Hourglass";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import {
	PANEL_PRIMARY_BUTTON_CLASS,
	PanelChip,
	PanelMessage,
} from "./panel-shell";

/** Props of EmptyPanel. more-view.tsx passes them for the Analytics and the Security panel. */
export type EmptyPanelProps = {
	/** Translated label of the planned action, for example "Turn on analytics". */
	ctaLabel: string;
};

/** The hourglass is the "not yet" sign of the backend states in cloud/backend-state.tsx too. */
export function EmptyPanel({ ctaLabel }: EmptyPanelProps) {
	const { t } = useTranslation();

	return (
		<PanelMessage
			tone="feature"
			icon={HourglassIcon}
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
