/**
 * "Soon" state of a More panel that Wandit cannot set up yet: Analytics, AI,
 * and Security. One card with a title, a hint, and the planned action as a
 * disabled button with a "Soon" badge, like the Integrations nav row.
 * Rendered by components/more/more-view.tsx inside PanelShell.
 */

import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";

import { useTranslation } from "@/lib/i18n";

export type EmptyPanelProps = {
	/** Translated label of the planned action, for example "Turn on analytics". */
	ctaLabel: string;
};

export function EmptyPanel({ ctaLabel }: EmptyPanelProps) {
	const { t } = useTranslation();

	return (
		<div className="flex max-w-lg flex-col items-start gap-2 rounded-2xl border bg-card p-6">
			<p className="font-semibold">{t("appBuilder.empty.title")}</p>
			<p className="text-muted-foreground text-sm">
				{t("appBuilder.empty.description")}
			</p>
			<div className="mt-2 flex items-center gap-2">
				<Button disabled>{ctaLabel}</Button>
				<Badge className="bg-primary/10 text-ember-strong">
					{t("appBuilder.soon")}
				</Badge>
			</div>
		</div>
	);
}
