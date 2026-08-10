import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Zap } from "lucide-react";
import type { ReactNode } from "react";

import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

/**
 * Out-of-credits treatment for composer surfaces: instead of a standalone
 * card, the PromptBox nests inside an ember halo with a one-line strip on
 * top — the same fused silhouette as the PromptBox beta banner, so the
 * blocked composer still reads as one component. Billing is owner-only
 * (teams-workspaces.md §9): org members get "ask an owner" copy instead of
 * an upgrade CTA, and while purchases are paused (beta) the CTA disappears.
 *
 * Inactive, it renders children untouched — callers keep the wrapper mounted
 * and flip `active` (callers should also drop the beta banner while active,
 * or the composer stacks two strips).
 */
export function OutOfCreditsBanner({
	active,
	className,
	children,
}: {
	active: boolean;
	className?: string;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const { openPlanPicker } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();

	if (!active) {
		return <>{children}</>;
	}

	const isBillingOwner = isPersonal || actorCanManageBilling;
	const canUpgrade = isBillingOwner && purchasesEnabled !== false;
	const detail = !isBillingOwner
		? t("credits.outOfCredits.memberBody")
		: purchasesEnabled === false
			? t("credits.outOfCredits.pausedBody")
			: null;

	return (
		<div className={cn("rounded-[1.25rem] bg-primary/10 p-1 pt-0", className)}>
			<div
				role="status"
				className="flex min-h-9 items-center gap-2 py-1 ps-4 pe-1"
			>
				<Zap className="size-3.5 shrink-0 text-primary" aria-hidden />
				<p className="min-w-0 flex-1 text-xs">
					<span className="font-medium">{t("credits.outOfCredits.title")}</span>
					{detail ? (
						<span className="text-muted-foreground"> — {detail}</span>
					) : null}
				</p>
				{canUpgrade ? (
					<Button
						type="button"
						size="sm"
						className="h-7 shrink-0 rounded-full px-3 text-xs"
						onClick={() => openPlanPicker()}
					>
						{t("credits.outOfCredits.cta")}
					</Button>
				) : null}
			</div>
			{children}
		</div>
	);
}
