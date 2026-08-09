import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Zap } from "lucide-react";

import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

/**
 * Blocking notice rendered above a disabled composer when the workspace pool
 * is empty. Billing is owner-only (teams-workspaces.md §9): members of an org
 * workspace get "ask an owner" copy instead of a plan-picker CTA. While all
 * purchases are paused (beta), the CTA disappears and the copy says so.
 */
export function OutOfCreditsBanner({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const { openPlanPicker } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const isBillingOwner = isPersonal || actorCanManageBilling;
	const canUpgrade = isBillingOwner && purchasesEnabled !== false;

	return (
		<div
			role="status"
			className={cn(
				"rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				<Zap className="size-4 shrink-0 text-destructive" aria-hidden />
				<p className="font-medium text-sm">{t("credits.outOfCredits.title")}</p>
			</div>
			<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
				{!isBillingOwner
					? t("credits.outOfCredits.memberBody")
					: purchasesEnabled === false
						? t("credits.outOfCredits.pausedBody")
						: t("credits.outOfCredits.body")}
			</p>
			{canUpgrade ? (
				<Button
					type="button"
					size="sm"
					className="mt-2.5 w-full"
					onClick={() => openPlanPicker()}
				>
					{t("credits.outOfCredits.cta")}
				</Button>
			) : null}
		</div>
	);
}
