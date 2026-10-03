/**
 * Payments panel of the More view: a static "coming soon" page with three
 * planned features. It names no payment provider and has no action.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws
 * the title. Reads no data.
 */

import { Badge } from "@wandit/ui/components/badge";
import {
	CreditCard,
	FlaskConical,
	type LucideIcon,
	Receipt,
	Repeat,
} from "lucide-react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";

/** The planned features the page lists, in display order. */
const PLANNED_FEATURES = [
	{ icon: Receipt, label: "appBuilder.payments.features.oneTime" },
	{ icon: Repeat, label: "appBuilder.payments.features.subscriptions" },
	{ icon: FlaskConical, label: "appBuilder.payments.features.testMode" },
] as const satisfies readonly { icon: LucideIcon; label: TranslationKey }[];

/** Static page: no query, no mutation, no button. A provider name must not appear here. */
export function PaymentsPanel() {
	const { t } = useTranslation();

	return (
		<section className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
			{/* A soft ember glow at the top end corner. Decorative only; the tokens follow the theme. */}
			<div
				aria-hidden
				className="pointer-events-none absolute -end-20 -top-20 size-56 rounded-full bg-primary/15 blur-3xl"
			/>
			<div className="relative flex flex-col items-start gap-3">
				<div className="flex items-center gap-3">
					<span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-ember-strong ring-1 ring-primary/20">
						<CreditCard className="size-5" strokeWidth={1.7} />
					</span>
					<Badge className="bg-primary/10 text-ember-strong">
						{t("appBuilder.soon")}
					</Badge>
				</div>
				<h2 className="mt-2 font-semibold text-xl tracking-tight">
					{t("appBuilder.payments.title")}
				</h2>
				<p className="max-w-md text-muted-foreground text-sm">
					{t("appBuilder.payments.body")}
				</p>
				<ul className="mt-3 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
					{PLANNED_FEATURES.map((feature) => (
						<li
							key={feature.label}
							className="flex items-center gap-2.5 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm"
						>
							<feature.icon
								className="size-4 shrink-0 text-ember-strong"
								strokeWidth={1.7}
							/>
							<span>{t(feature.label)}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
