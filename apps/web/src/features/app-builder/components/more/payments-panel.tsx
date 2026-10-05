/**
 * Payments panel of the More view: a static "coming soon" page with three
 * planned features. It names no payment provider and has no action.
 * Rendered by components/more/more-view.tsx inside PanelShell, which draws
 * the title. Reads no data.
 */

import type { Icon } from "@phosphor-icons/react";
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { FlaskIcon } from "@phosphor-icons/react/Flask";
import { ReceiptIcon } from "@phosphor-icons/react/Receipt";
import { RepeatIcon } from "@phosphor-icons/react/Repeat";
import { cn } from "@wandit/ui/lib/utils";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { PANEL_CARD_CLASS, PanelChip } from "./panel-shell";

/** The planned features the page lists, in display order. */
const PLANNED_FEATURES = [
	{ icon: ReceiptIcon, label: "appBuilder.payments.features.oneTime" },
	{ icon: RepeatIcon, label: "appBuilder.payments.features.subscriptions" },
	{ icon: FlaskIcon, label: "appBuilder.payments.features.testMode" },
] as const satisfies readonly { icon: Icon; label: TranslationKey }[];

/** Static page: no query, no mutation, no button. A provider name must not appear here. */
export function PaymentsPanel() {
	const { t } = useTranslation();

	return (
		<section
			className={cn(PANEL_CARD_CLASS, "relative overflow-hidden p-6 sm:p-8")}
		>
			{/* A soft spark glow at the top end corner. Decorative only. */}
			<div
				aria-hidden
				className="pointer-events-none absolute -end-24 -top-24 size-64 rounded-full bg-spark/25 blur-3xl dark:bg-spark/10"
			/>
			<div className="relative flex flex-col items-start">
				<div className="flex items-center gap-3">
					<span
						aria-hidden
						className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-night text-spark dark:bg-spark dark:text-night"
					>
						<CreditCardIcon weight="duotone" className="size-6" />
					</span>
					<PanelChip tone="ember">{t("appBuilder.soon")}</PanelChip>
				</div>
				<h2 className="mt-5 font-grotesk font-semibold text-[22px] text-night tracking-[-0.02em] dark:text-foreground">
					{t("appBuilder.payments.title")}
				</h2>
				<p className="mt-1.5 max-w-md font-sans text-[15px] text-night/60 leading-relaxed dark:text-foreground/60">
					{t("appBuilder.payments.body")}
				</p>
				<ul className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3">
					{PLANNED_FEATURES.map((feature) => (
						<li
							key={feature.label}
							className="flex items-center gap-3 rounded-[14px] border border-night/[0.07] bg-paper px-3 py-3 font-grotesk font-medium text-[14px] text-night dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-foreground"
						>
							<span
								aria-hidden
								className="grid size-8 shrink-0 place-items-center rounded-full bg-spark/20 text-night dark:bg-spark/15 dark:text-spark"
							>
								<feature.icon weight="duotone" className="size-[18px]" />
							</span>
							<span>{t(feature.label)}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
