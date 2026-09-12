/**
 * Maps self-serve plans to workspace upgrade copy.
 * The sidebar upgrade card reads this map.
 */
import type { BillingPlanId } from "@wandit/contracts";

import type { TranslationKey } from "@/lib/i18n";

/**
 * Maps each new subscription plan to its sidebar title.
 * Starter remains available through retention and existing subscriptions.
 */
export const UPGRADE_CARD_TITLE_KEYS = {
	business: "workspace.upgradeCard.titleBusiness",
	pro: "workspace.upgradeCard.titlePro",
} as const satisfies Record<Exclude<BillingPlanId, "starter">, TranslationKey>;
