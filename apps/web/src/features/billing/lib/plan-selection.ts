import type {
	BillingPlanCatalogItem,
	BillingPlanId,
	BillingTierPrice,
	CreditTier,
	Subscription,
} from "@wandit/contracts";

export type PlanSelection = Partial<Record<BillingPlanId, CreditTier>>;

export function resolveSelectedTier(
	plan: BillingPlanCatalogItem,
	selection: PlanSelection | null,
	subscription: Pick<Subscription, "plan" | "tierCredits"> | null,
): BillingTierPrice | null {
	const firstTier = plan.tiers[0];
	if (!firstTier) return null;

	const selectedTierCredits = selection?.[plan.id];

	if (selectedTierCredits !== undefined) {
		return (
			plan.tiers.find((tier) => tier.tierCredits === selectedTierCredits) ??
			firstTier
		);
	}

	if (subscription?.plan !== plan.id) return firstTier;

	return (
		plan.tiers.find((tier) => tier.tierCredits === subscription.tierCredits) ??
		firstTier
	);
}
