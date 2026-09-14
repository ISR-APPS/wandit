/**
 * Empty state of a More panel that has nothing set up yet: Analytics, AI,
 * Integrations, and Security. One card with a title, a hint, and one button.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import { Button } from "@wandit/ui/components/button";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";

export type EmptyPanelProps = {
	/** Translated label of the one action, for example "Turn on analytics". */
	ctaLabel: string;
	/** Runs on the button. Without it the button shows the "not connected" toast. */
	onCta?: () => void;
};

export function EmptyPanel({ ctaLabel, onCta }: EmptyPanelProps) {
	const { t } = useTranslation();

	return (
		<div className="flex max-w-lg flex-col items-start gap-2 rounded-2xl border bg-card p-6">
			<p className="font-semibold">{t("appBuilder.empty.title")}</p>
			<p className="text-muted-foreground text-sm">
				{t("appBuilder.empty.description")}
			</p>
			<Button
				className="mt-2"
				onClick={onCta ?? (() => toast(t("appBuilder.mock.notWired")))}
			>
				{ctaLabel}
			</Button>
		</div>
	);
}
