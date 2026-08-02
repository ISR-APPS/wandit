import type { ProductSettings } from "@wandit/contracts";

import { PRODUCT_SETTINGS_ID } from "../../domain/product-settings.constants";
import type { ProductSettingsRow } from "../persistence/product-settings.repository";

export function mapProductSettingsRow(
	row: ProductSettingsRow,
): ProductSettings {
	if (row.id !== PRODUCT_SETTINGS_ID) {
		throw new Error(`Unexpected product settings singleton id ${row.id}`);
	}

	return {
		earlyAccessRequired: row.earlyAccessRequired,
		id: PRODUCT_SETTINGS_ID,
		paidSubscriptionsEnabled: row.paidSubscriptionsEnabled,
		signupGrantCredits: row.signupGrantCredits,
		signupGrantEnabled: row.signupGrantEnabled,
		topupsEnabled: row.topupsEnabled,
		updatedAt: row.updatedAt.toISOString(),
		updatedByUserId: row.updatedByUserId,
		version: row.version,
	};
}
