import type { BillingPlanId } from "@wandit/contracts";

import type { TranslationKey } from "@/lib/i18n";

export const UPGRADE_CARD_TITLE_KEYS = {
	business: "workspace.upgradeCard.titleBusiness",
	pro: "workspace.upgradeCard.titlePro",
	starter: "workspace.upgradeCard.titleStarter",
} as const satisfies Record<BillingPlanId, TranslationKey>;
