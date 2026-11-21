/**
 * Maps one `product_settings` row to the `ProductSettings` type of the contract.
 * ProductSettingsService calls it after each read and each update of the row.
 * It calls nothing.
 */
import type { ProductSettings } from "@wandit/contracts";

import { PRODUCT_SETTINGS_ID } from "../../domain/product-settings.constants";
import type { ProductSettingsRow } from "../persistence/product-settings.repository";

/**
 * Maps the row for INTERNAL consumers. signupGrantCredits and the three
 * userReferral*Credits stay in integer centi-credits, exactly as stored.
 * The signup-grant outbox and the referral claim copy them unconverted.
 * The admin settings controller converts to whole credits at the API boundary.
 */
export function mapProductSettingsRow(
	row: ProductSettingsRow,
): ProductSettings {
	if (row.id !== PRODUCT_SETTINGS_ID) {
		throw new Error(`Unexpected product settings singleton id ${row.id}`);
	}

	return {
		dzdPerUsdRate: row.dzdPerUsdRate,
		emailAuthEnabled: row.emailAuthEnabled,
		id: PRODUCT_SETTINGS_ID,
		lifecycleEmailsEnabled: row.lifecycleEmailsEnabled,
		manualGraceDays: row.manualGraceDays,
		manualPaymentsEnabled: row.manualPaymentsEnabled,
		organizationsEnabled: row.organizationsEnabled,
		paidSubscriptionsEnabled: row.paidSubscriptionsEnabled,
		signupGrantCredits: row.signupGrantCredits,
		signupGrantEnabled: row.signupGrantEnabled,
		starterPassRequired: row.starterPassRequired,
		topupsEnabled: row.topupsEnabled,
		updatedAt: row.updatedAt.toISOString(),
		updatedByUserId: row.updatedByUserId,
		userReferralActivationCredits: row.userReferralActivationCredits,
		userReferralFriendCredits: row.userReferralFriendCredits,
		userReferralPaidCredits: row.userReferralPaidCredits,
		userReferralsEnabled: row.userReferralsEnabled,
		v2BuilderEnabled: row.v2BuilderEnabled,
		v2DisabledModels: row.v2DisabledModels,
		version: row.version,
	};
}
