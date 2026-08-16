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

const adminStoryLinksRoot = "/api/v1/admin/story-links";

export const storyLinksRoutes = {
	click: (slug: string) => `/api/v1/s/${encodeURIComponent(slug)}`,
	adminStoryLinks: adminStoryLinksRoot,
	adminStoryLink: (storyLinkId: string) =>
		`${adminStoryLinksRoot}/${encodeURIComponent(storyLinkId)}`,
} as const;
