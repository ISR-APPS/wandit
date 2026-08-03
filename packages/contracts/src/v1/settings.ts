import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const productSettingsSchema = z.object({
	id: z.literal(1),
	earlyAccessRequired: z.boolean(),
	signupGrantEnabled: z.boolean(),
	signupGrantCredits: z.int().positive(),
	paidSubscriptionsEnabled: z.boolean(),
	topupsEnabled: z.boolean(),
	organizationsEnabled: z.boolean(),
	emailAuthEnabled: z.boolean(),
	version: z.int().positive(),
	updatedByUserId: z.string().nullable(),
	updatedAt: isoDateTimeSchema,
});

export type ProductSettings = z.infer<typeof productSettingsSchema>;

export const publicSettingsSchema = productSettingsSchema.pick({
	paidSubscriptionsEnabled: true,
	topupsEnabled: true,
	signupGrantEnabled: true,
	// Public: the web shows/hides workspace creation and the Business plan.
	organizationsEnabled: true,
	// Public: the web shows/hides the email sign-in form in the auth modal.
	emailAuthEnabled: true,
});

export type PublicSettings = z.infer<typeof publicSettingsSchema>;

export const patchProductSettingsBodySchema = z
	.object({
		earlyAccessRequired: z.boolean().optional(),
		signupGrantEnabled: z.boolean().optional(),
		signupGrantCredits: z.int().positive().optional(),
		paidSubscriptionsEnabled: z.boolean().optional(),
		topupsEnabled: z.boolean().optional(),
		organizationsEnabled: z.boolean().optional(),
		emailAuthEnabled: z.boolean().optional(),
		version: z.int().positive(),
	})
	.refine(
		(settings) =>
			settings.earlyAccessRequired !== undefined ||
			settings.signupGrantEnabled !== undefined ||
			settings.signupGrantCredits !== undefined ||
			settings.paidSubscriptionsEnabled !== undefined ||
			settings.topupsEnabled !== undefined ||
			settings.organizationsEnabled !== undefined ||
			settings.emailAuthEnabled !== undefined,
		{ message: "At least one setting must be provided" },
	);

export type PatchProductSettingsBody = z.infer<
	typeof patchProductSettingsBodySchema
>;

export const settingsRoutes = {
	admin: "/api/v1/admin/settings",
	public: "/api/v1/settings/public",
} as const;
