import type { ProductSettings } from "@wandit/contracts";

import { PRODUCT_SETTINGS_ID } from "../../domain/product-settings.constants";
import type { ProductSettingsRow } from "../persistence/product-settings.repository";

/**
 * Maps the row for INTERNAL consumers: signupGrantCredits stays in integer
 * centi-credits exactly as stored (the signup-grant outbox writes it to the
 * ledger unconverted). The admin settings controller converts to whole
 * credits at the API boundary.
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
		topupsEnabled: row.topupsEnabled,
		updatedAt: row.updatedAt.toISOString(),
		updatedByUserId: row.updatedByUserId,
		version: row.version,
	};
}
