import { z } from "zod";
import { adminOverviewQuerySchema } from "./admin";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const storyLinkSlugSchema = z
	.string()
	.regex(/^[a-z0-9][a-z0-9-]{1,63}$/);

const storyLinkNameSchema = z.string().trim().min(1).max(200);
const storyLinkUtmValueSchema = z.string().trim().min(1).max(200);
const storyLinkUtmContentInputSchema = z.string().trim().min(1).max(500);
const storyLinkDestinationPathSchema = z
	.string()
	.trim()
	.min(1)
	.max(2_048)
	.regex(/^\/(?!\/)/);

export const storyLinkSchema = z
	.object({
		id: uuidSchema,
		slug: storyLinkSlugSchema,
		name: z.string().min(1),
		utmSource: z.string().min(1),
		utmMedium: z.string().min(1),
		utmCampaign: z.string().min(1),
		utmContent: z.string().nullable(),
		destinationPath: z.string().min(1),
		archivedAt: isoDateTimeSchema.nullable(),
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	})
	.strict();

export type StoryLink = z.infer<typeof storyLinkSchema>;

export const storyLinkListItemSchema = storyLinkSchema
	.omit({ updatedAt: true })
	.extend({
		clicksInRange: z.int().nonnegative(),
		uniqueVisitorsInRange: z.int().nonnegative(),
		allTimeClicks: z.int().nonnegative(),
	})
	.strict();

export type StoryLinkListItem = z.infer<typeof storyLinkListItemSchema>;

export const storyLinkClicksByDayPointSchema = z
	.object({
		date: z.iso.date(),
		clicks: z.int().nonnegative(),
	})
	.strict();

export type StoryLinkClicksByDayPoint = z.infer<
	typeof storyLinkClicksByDayPointSchema
>;

export const storyLinksResponseSchema = z
	.object({
		updatedAt: isoDateTimeSchema,
		links: z.array(storyLinkListItemSchema),
		clicksByDay: z.array(storyLinkClicksByDayPointSchema),
	})
	.strict();

export type StoryLinksResponse = z.infer<typeof storyLinksResponseSchema>;

export const createStoryLinkInputSchema = z
	.object({
		name: storyLinkNameSchema,
		slug: storyLinkSlugSchema,
		utmSource: storyLinkUtmValueSchema,
		utmMedium: storyLinkUtmValueSchema,
		utmCampaign: storyLinkUtmValueSchema,
		utmContent: storyLinkUtmContentInputSchema.optional(),
		destinationPath: storyLinkDestinationPathSchema.optional(),
	})
	.strict();

export type CreateStoryLinkInput = z.infer<typeof createStoryLinkInputSchema>;

export const updateStoryLinkInputSchema = z
	.object({
		name: storyLinkNameSchema.optional(),
		archived: z.boolean().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one story link field must be provided",
	});

export type UpdateStoryLinkInput = z.infer<typeof updateStoryLinkInputSchema>;

export const listStoryLinksQuerySchema = adminOverviewQuerySchema;

export type ListStoryLinksQuery = z.infer<typeof listStoryLinksQuerySchema>;

// --- Per-link stats (admin detail sheet) ---

// Same range semantics as the list endpoint, so the sheet's numbers match the
// table row the admin clicked.
export const storyLinkStatsQuerySchema = adminOverviewQuerySchema;

export type StoryLinkStatsQuery = z.infer<typeof storyLinkStatsQuerySchema>;

export const storyLinkSignupsQuerySchema = storyLinkStatsQuerySchema.safeExtend(
	{
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(10),
	},
);

export type StoryLinkSignupsQuery = z.infer<typeof storyLinkSignupsQuerySchema>;

export const storyLinkStatsClicksSchema = z
	.object({
		inRange: z.int().nonnegative(),
		uniqueInRange: z.int().nonnegative(),
		allTime: z.int().nonnegative(),
	})
	.strict();

export type StoryLinkStatsClicks = z.infer<typeof storyLinkStatsClicksSchema>;

export const storyLinkStatsSignupsSchema = z
	.object({
		inRange: z.int().nonnegative(),
		allTime: z.int().nonnegative(),
	})
	.strict();

export type StoryLinkStatsSignups = z.infer<typeof storyLinkStatsSignupsSchema>;

export const storyLinkStatsConversionSchema = z
	.object({
		// Attributed signups with at least one succeeded generation (the funnel's
		// "activated" definition), before the snapshot end.
		activatedUsers: z.int().nonnegative(),
		// Attributed signups with at least one positive subscription payment
		// (Stripe invoice cash or manual payment) — proof of money, unlike the
		// funnel's any-subscription-row "paid".
		convertedToPaid: z.int().nonnegative(),
		// Attributed signups with a live subscription now
		// (active / trialing / past_due).
		liveSubscriptions: z.int().nonnegative(),
		// Positive USD subscription cash from attributed signups, all-time up to
		// the snapshot end. Non-USD money is excluded rather than mis-summed.
		revenueUsdCents: z.int().nonnegative(),
	})
	.strict();

export type StoryLinkStatsConversion = z.infer<
	typeof storyLinkStatsConversionSchema
>;

export const storyLinkRecentSignupSchema = z
	.object({
		userId: z.string().min(1),
		name: z.string(),
		// Deliberately not z.email(): one malformed legacy address must not brick
		// the fail-closed client parse.
		email: z.string(),
		image: z.string().nullable(),
		signedUpAt: isoDateTimeSchema,
		convertedToPaid: z.boolean(),
	})
	.strict();

export type StoryLinkRecentSignup = z.infer<typeof storyLinkRecentSignupSchema>;

export const storyLinkSignupsResponseSchema = z
	.object({
		items: z.array(storyLinkRecentSignupSchema),
		page: z.int().min(1),
		pageSize: z.int().min(1),
		total: z.int().nonnegative(),
	})
	.strict();

export type StoryLinkSignupsResponse = z.infer<
	typeof storyLinkSignupsResponseSchema
>;

export const storyLinkStatsResponseSchema = z
	.object({
		updatedAt: isoDateTimeSchema,
		link: storyLinkSchema,
		clicks: storyLinkStatsClicksSchema,
		// Daily clicks for THIS link only (the list endpoint's series is all
		// links combined).
		clicksByDay: z.array(storyLinkClicksByDayPointSchema),
		signups: storyLinkStatsSignupsSchema,
		conversion: storyLinkStatsConversionSchema,
	})
	.strict();

export type StoryLinkStatsResponse = z.infer<
	typeof storyLinkStatsResponseSchema
>;

const adminStoryLinksRoot = "/api/v1/admin/story-links";

export const storyLinksRoutes = {
	click: (slug: string) => `/api/v1/s/${encodeURIComponent(slug)}`,
	adminStoryLinks: adminStoryLinksRoot,
	adminStoryLink: (storyLinkId: string) =>
		`${adminStoryLinksRoot}/${encodeURIComponent(storyLinkId)}`,
	adminStoryLinkStats: (storyLinkId: string) =>
		`${adminStoryLinksRoot}/${encodeURIComponent(storyLinkId)}/stats`,
	adminStoryLinkSignups: (storyLinkId: string) =>
		`${adminStoryLinksRoot}/${encodeURIComponent(storyLinkId)}/signups`,
} as const;
