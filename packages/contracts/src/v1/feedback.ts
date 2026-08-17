/**
 * Shared contract for in-app user feedback.
 *
 * The web widget collects a message plus debug context (screenshot, session
 * replay URL, last error id) and posts it here. The server turns the payload
 * into a Linear issue and returns the created issue identifier.
 */
// Zod validates runtime JSON and also gives us TypeScript types.
import { z } from "zod";

import { isoDateTimeSchema } from "./shared/primitives";

// A PNG or JPEG data URL. The cap keeps the JSON body inside the server's
// 4 MiB route body limit with room for the rest of the payload.
const screenshotDataUrlSchema = z
	.string()
	.regex(/^data:image\/(png|jpeg);base64,/)
	.max(2_600_000);

// Kinds of feedback the widget offers. Mirrors the chips in the dialog.
export const feedbackCategories = ["bug", "idea", "other"] as const;

export const feedbackCategorySchema = z.enum(feedbackCategories);

// TypeScript type created from the schema above.
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

// What the widget sends when the user submits feedback.
export const createFeedbackRequestSchema = z.object({
	// The text the user typed.
	message: z.string().trim().min(3).max(4000),
	// Optional kind chosen in the dialog. Sharpens triage in Linear.
	category: feedbackCategorySchema.optional(),
	// The page the user was on at submit time.
	pageUrl: z.string().max(2000),
	// PostHog session replay deep link, when replay is active.
	replayUrl: z.string().max(2000).optional(),
	// Most recent Sentry error captured in this tab, if any.
	sentryEventId: z.string().max(64).optional(),
	// When that error happened, so the server can mark stale ones.
	sentryEventAt: isoDateTimeSchema.optional(),
	// DOM-rendered screenshot of the viewport.
	screenshot: z
		.object({
			dataUrl: screenshotDataUrlSchema,
			width: z.number().int().positive().max(10_000).optional(),
			height: z.number().int().positive().max(10_000).optional(),
		})
		.optional(),
	// Browser context shown in the issue body.
	context: z
		.object({
			userAgent: z.string().max(512).optional(),
			viewport: z
				.object({
					width: z.number().int().positive().max(10_000),
					height: z.number().int().positive().max(10_000),
				})
				.optional(),
			locale: z.string().max(20).optional(),
		})
		.optional(),
});

// TypeScript type created from the schema above.
export type CreateFeedbackRequest = z.infer<typeof createFeedbackRequestSchema>;

// Response after the server creates the Linear issue.
export const createFeedbackResponseSchema = z.object({
	// Linear issue identifier, for example "ISRECOM-123".
	issueId: z.string(),
});

// TypeScript type created from the schema above.
export type CreateFeedbackResponse = z.infer<
	typeof createFeedbackResponseSchema
>;

// Route path constants. These do not make network calls by themselves.
export const feedbackRoutes = {
	// POST JSON. Requires a signed-in session.
	create: "/api/v1/feedback",
} as const;
