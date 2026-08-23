import {
	type PatchProductSettingsBody,
	type ProductSettings,
	productSettingsSchema,
	productSettingsUpdateResponseSchema,
} from "@wandit/contracts";

export type ProductSettingsView = Omit<ProductSettings, "updatedByUserId"> & {
	updatedBy: string | null;
};

// A PATCH that switches the signup grant on also reports how many users
// signed up while it was off; the settings view itself never carries it.
export type ProductSettingsUpdateView = ProductSettingsView & {
	signupGrantSkippedCount?: number;
};

export type UpdateProductSettingsInput = PatchProductSettingsBody;

export function mapProductSettingsUpdateDto(
	input: unknown,
): ProductSettingsUpdateView {
	const { signupGrantSkippedCount, updatedByUserId, ...settings } =
		productSettingsUpdateResponseSchema.parse(input);

	return {
		...settings,
		updatedBy: updatedByUserId,
		...(signupGrantSkippedCount === undefined
			? {}
			: { signupGrantSkippedCount }),
	};
}

/**
 * Validate the server payload at the feature boundary and rename the audit
 * field to the label used by the admin UI.
 */
export function mapProductSettingsDto(input: unknown): ProductSettingsView {
	const { updatedByUserId, ...settings } = productSettingsSchema.parse(input);

	return {
		...settings,
		updatedBy: updatedByUserId,
	};
}
