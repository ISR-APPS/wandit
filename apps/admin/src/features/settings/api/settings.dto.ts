import {
	type PatchProductSettingsBody,
	type ProductSettings,
	productSettingsSchema,
} from "@wandit/contracts";

export type ProductSettingsView = Omit<ProductSettings, "updatedByUserId"> & {
	updatedBy: string | null;
};

export type UpdateProductSettingsInput = PatchProductSettingsBody;

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
