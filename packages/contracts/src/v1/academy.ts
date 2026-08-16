import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

const youtubeHosts = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
	"youtube-nocookie.com",
	"www.youtube-nocookie.com",
]);

/** Extracts a YouTube video id from a supported YouTube URL. */
export function parseYouTubeVideoId(value: string): string | null {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (
		(url.protocol !== "https:" && url.protocol !== "http:") ||
		url.username !== "" ||
		url.password !== ""
	) {
		return null;
	}

	const hostname = url.hostname.toLowerCase();
	const pathSegments = url.pathname.split("/").filter(Boolean);
	let videoId: string | null = null;

	if (hostname === "youtu.be") {
		if (pathSegments.length === 1) {
			videoId = pathSegments[0] ?? null;
		}
	} else if (youtubeHosts.has(hostname)) {
		const format = pathSegments[0];

		if (format === "watch" && pathSegments.length === 1) {
			videoId = url.searchParams.get("v");
		} else if (
			pathSegments.length === 2 &&
			(format === "shorts" || format === "live" || format === "embed")
		) {
			videoId = pathSegments[1] ?? null;
		}
	}

	return videoId !== null && youtubeVideoIdPattern.test(videoId)
		? videoId
		: null;
}

export function youtubeThumbnailUrl(videoId: string): string {
	return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string): string {
	return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeWatchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${videoId}`;
}

export const ACADEMY_GUIDE_CATEGORIES = [
	"getting-started",
	"websites",
	"landing-pages",
	"ads",
	"leads",
	"marketing",
	"domains",
	"apps",
] as const;

export const academyGuideCategorySchema = z.enum(ACADEMY_GUIDE_CATEGORIES);

export type AcademyGuideCategory = z.infer<typeof academyGuideCategorySchema>;

export const academyGuideStatusSchema = z.enum(["draft", "published"]);

export type AcademyGuideStatus = z.infer<typeof academyGuideStatusSchema>;

const youtubeVideoIdSchema = z.string().regex(youtubeVideoIdPattern);

export const academyGuideSchema = z
	.object({
		id: uuidSchema,
		title: z.string(),
		description: z.string().nullable(),
		category: z.string().nullable(),
		youtubeUrl: z.string().nullable(),
		youtubeVideoId: youtubeVideoIdSchema.nullable(),
		bodyHtml: z.string(),
		status: academyGuideStatusSchema,
		publishedAt: isoDateTimeSchema.nullable(),
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	})
	.strict();

export type AcademyGuide = z.infer<typeof academyGuideSchema>;

export const adminAcademyGuideListItemSchema = academyGuideSchema.omit({
	bodyHtml: true,
});

export type AdminAcademyGuideListItem = z.infer<
	typeof adminAcademyGuideListItemSchema
>;

export const academyGuideListItemSchema = z
	.object({
		id: uuidSchema,
		title: z.string(),
		description: z.string().nullable(),
		category: z.string().nullable(),
		youtubeVideoId: youtubeVideoIdSchema.nullable(),
		publishedAt: isoDateTimeSchema.nullable(),
	})
	.strict();

export type AcademyGuideListItem = z.infer<typeof academyGuideListItemSchema>;

export const listAcademyGuidesResponseSchema = z.array(
	academyGuideListItemSchema,
);

export type ListAcademyGuidesResponse = z.infer<
	typeof listAcademyGuidesResponseSchema
>;

const titleSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().trim().max(300).nullable();
const categorySchema = academyGuideCategorySchema.nullable();
const youtubeUrlSchema = z
	.url()
	.refine((url) => parseYouTubeVideoId(url) !== null, {
		message: "youtubeUrl must be a supported YouTube video URL",
	});
const bodyHtmlSchema = z.string().max(300_000);

type AcademyGuideContentInput = {
	bodyHtml?: string;
	youtubeUrl?: string | null;
};

function hasAcademyGuideContent(value: AcademyGuideContentInput): boolean {
	return value.youtubeUrl != null || (value.bodyHtml?.trim().length ?? 0) > 0;
}

export const createAcademyGuideInputSchema = z
	.object({
		title: titleSchema,
		description: descriptionSchema.optional(),
		category: categorySchema.optional(),
		youtubeUrl: youtubeUrlSchema.nullable().optional(),
		bodyHtml: bodyHtmlSchema.default(""),
		status: academyGuideStatusSchema.optional(),
	})
	.strict()
	.refine(hasAcademyGuideContent, {
		message: "At least a YouTube video or non-empty body is required",
		path: ["bodyHtml"],
	});

export type CreateAcademyGuideInput = z.infer<
	typeof createAcademyGuideInputSchema
>;

export const updateAcademyGuideInputSchema = z
	.object({
		title: titleSchema.optional(),
		description: descriptionSchema.optional(),
		category: categorySchema.optional(),
		youtubeUrl: youtubeUrlSchema.nullable().optional(),
		bodyHtml: bodyHtmlSchema.optional(),
		status: academyGuideStatusSchema.optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one guide field must be provided",
	})
	.refine(
		(value) =>
			!Object.hasOwn(value, "youtubeUrl") ||
			!Object.hasOwn(value, "bodyHtml") ||
			hasAcademyGuideContent(value),
		{
			message: "At least a YouTube video or non-empty body is required",
			path: ["bodyHtml"],
		},
	);

export type UpdateAcademyGuideInput = z.infer<
	typeof updateAcademyGuideInputSchema
>;

export const adminListAcademyGuidesQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().max(200).optional(),
		status: academyGuideStatusSchema.optional(),
	})
	.strict();

export type AdminListAcademyGuidesQuery = z.infer<
	typeof adminListAcademyGuidesQuerySchema
>;

export const adminListAcademyGuidesResponseSchema = paginatedResultSchema(
	adminAcademyGuideListItemSchema,
).strict();

export type AdminListAcademyGuidesResponse = z.infer<
	typeof adminListAcademyGuidesResponseSchema
>;

export const deleteAcademyGuideResponseSchema = z
	.object({ deleted: z.literal(true) })
	.strict();

export type DeleteAcademyGuideResponse = z.infer<
	typeof deleteAcademyGuideResponseSchema
>;

export const academyRoutes = {
	list: "/api/v1/academy/guides",
	byId: (id: string) => `/api/v1/academy/guides/${id}`,
	adminList: "/api/v1/admin/academy/guides",
	adminById: (id: string) => `/api/v1/admin/academy/guides/${id}`,
} as const;
