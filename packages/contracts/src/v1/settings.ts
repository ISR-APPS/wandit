import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const productSettingsSchema = z.object({
	id: z.literal(1),
	signupGrantEnabled: z.boolean(),
	// WHOLE credits at the admin API; the server stores the setting x100 as
	// centi-credits and converts at the settings presentation boundary.
	signupGrantCredits: z.int().positive(),
	paidSubscriptionsEnabled: z.boolean(),
	topupsEnabled: z.boolean(),
	organizationsEnabled: z.boolean(),
	emailAuthEnabled: z.boolean(),
	// Admin-only: captures continue while disabled, but lifecycle email outbox
	// rows are dropped instead of dispatched.
	lifecycleEmailsEnabled: z.boolean(),
	// Offline payments (cash on delivery / wire / CCP): shows the manual
	// request tab in the plan picker and opens the manual-request endpoint.
	manualPaymentsEnabled: z.boolean(),
	// Collection window in days after currentPeriodEnd for manual subscriptions;
	// 0 = strict.
	manualGraceDays: z.int().min(0).max(30),
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
	// Public: the web shows/hides the "cash / transfer" tab in the plan picker.
	manualPaymentsEnabled: true,
	// Public: the web computes the effective access-end date for manual plans.
	manualGraceDays: true,
});

export type PublicSettings = z.infer<typeof publicSettingsSchema>;

export const patchProductSettingsBodySchema = z
	.object({
		signupGrantEnabled: z.boolean().optional(),
		signupGrantCredits: z.int().positive().optional(),
		paidSubscriptionsEnabled: z.boolean().optional(),
		topupsEnabled: z.boolean().optional(),
		organizationsEnabled: z.boolean().optional(),
		emailAuthEnabled: z.boolean().optional(),
		lifecycleEmailsEnabled: z.boolean().optional(),
		manualPaymentsEnabled: z.boolean().optional(),
		manualGraceDays: z.int().min(0).max(30).optional(),
		version: z.int().positive(),
	})
	.refine(
		(settings) =>
			settings.signupGrantEnabled !== undefined ||
			settings.signupGrantCredits !== undefined ||
			settings.paidSubscriptionsEnabled !== undefined ||
			settings.topupsEnabled !== undefined ||
			settings.organizationsEnabled !== undefined ||
			settings.emailAuthEnabled !== undefined ||
			settings.lifecycleEmailsEnabled !== undefined ||
			settings.manualPaymentsEnabled !== undefined ||
			settings.manualGraceDays !== undefined,
		{ message: "At least one setting must be provided" },
	);

export type PatchProductSettingsBody = z.infer<
	typeof patchProductSettingsBodySchema
>;

// PATCH response: when the signup grant flips off->on the server reports how
// many users signed up while it was off (`skipped` outbox rows) so the admin
// can decide on the explicit backfill. Enabling alone never grants to them.
export const productSettingsUpdateResponseSchema = productSettingsSchema.extend(
	{
		signupGrantSkippedCount: z.int().nonnegative().optional(),
	},
);

export type ProductSettingsUpdateResponse = z.infer<
	typeof productSettingsUpdateResponseSchema
>;

export const backfillSignupGrantsBodySchema = z.object({
	// Only users whose outbox row was created after this instant.
	createdAfter: isoDateTimeSchema.optional(),
	// true: count only, change nothing.
	dryRun: z.boolean().default(false),
});

export type BackfillSignupGrantsBody = z.infer<
	typeof backfillSignupGrantsBodySchema
>;

export const backfillSignupGrantsResponseSchema = z.object({
	// Skipped rows matched before the run (the dry-run count).
	skipped: z.int().nonnegative(),
	// Rows moved to pending by this call (0 on a dry run).
	requeued: z.int().nonnegative(),
});

export type BackfillSignupGrantsResponse = z.infer<
	typeof backfillSignupGrantsResponseSchema
>;

export const settingsRoutes = {
	admin: "/api/v1/admin/settings",
	public: "/api/v1/settings/public",
	signupGrantBackfill: "/api/v1/admin/settings/signup-grants/backfill",
} as const;
