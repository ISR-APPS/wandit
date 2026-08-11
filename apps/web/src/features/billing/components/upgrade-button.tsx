import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Zap } from "lucide-react";

import { useBillingSubscriptionQuery } from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

/**
 * Shared visibility rule for every free-plan upgrade CTA. Waits for the
 * subscription view before showing anything — flashing "Upgrade" at a paying
 * customer is worse than showing it a beat late. Billing is owner-only
 * (teams-workspaces.md §9), and an explicit purchases-off setting hides these
 * like every other purchase CTA.
 */
function useUpgradeVisible(): boolean {
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const purchasesEnabled = usePurchasesEnabled();
	const subscriptionQuery = useBillingSubscriptionQuery();

	const isBillingOwner = isPersonal || actorCanManageBilling;
	const onFreePlan =
		subscriptionQuery.data !== undefined &&
		subscriptionQuery.data.subscription === null;

	return isBillingOwner && purchasesEnabled !== false && onFreePlan;
}

/** Compact workspace-header CTA, next to Publish. */
export function UpgradeButton() {
	const { t } = useTranslation();
	const { openPlanPicker } = useBillingModal();
	const visible = useUpgradeVisible();

	if (!visible) {
		return null;
	}

	return (
		<Button
			type="button"
			size="sm"
			variant="secondary"
			className="h-8 px-3.5"
			onClick={() => openPlanPicker()}
		>
			<Zap className="text-ember-text" aria-hidden />
			{t("workspace.upgrade")}
		</Button>
	);
}

/** Sidebar-footer card ("Upgrade to Pro — unlock more…"), Lovable-style. */
export function UpgradeCard({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { isPersonal } = useWorkspace();
	const { openPlanPicker } = useBillingModal();
	const visible = useUpgradeVisible();

	if (!visible) {
		return null;
	}

	return (
		<button
			type="button"
			onClick={() => openPlanPicker()}
			className={cn(
				"flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-card/70 px-3 py-2.5 text-start transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				className,
			)}
		>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium text-sm">
					{isPersonal
						? t("workspace.upgradeCard.titlePro")
						: t("workspace.upgradeCard.titleBusiness")}
				</span>
				<span className="mt-0.5 block text-muted-foreground text-xs">
					{t("workspace.upgradeCard.body")}
				</span>
			</span>
			<span
				aria-hidden
				className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
			>
				<Zap className="size-4" />
			</span>
		</button>
	);
}
