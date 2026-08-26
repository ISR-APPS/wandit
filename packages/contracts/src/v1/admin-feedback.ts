import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { adminUserPlanSchema, optionalCsvEnum } from "./admin";
import { feedbackCategories, feedbackCategorySchema } from "./feedback";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const feedbackStatuses = [
	"new",
	"reviewing",
	"planned",
	"resolved",
] as const;

export const feedbackStatusSchema = z.enum(feedbackStatuses);

export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;

export const feedbackPriorities = ["urgent", "high", "medium", "low"] as const;

export const feedbackPrioritySchema = z.enum(feedbackPriorities);

export type FeedbackPriority = z.infer<typeof feedbackPrioritySchema>;

export const feedbackActivityKinds = [
	"received",
	"status_changed",
	"priority_changed",
	"note_updated",
] as const;

export const feedbackActivityKindSchema = z.enum(feedbackActivityKinds);

export type FeedbackActivityKind = z.infer<typeof feedbackActivityKindSchema>;

export const adminListFeedbackSorts = ["newest", "oldest", "priority"] as const;

export const adminListFeedbackSortSchema = z.enum(adminListFeedbackSorts);

export type AdminListFeedbackSort = z.infer<typeof adminListFeedbackSortSchema>;

export const adminFeedbackReporterSchema = z.object({
	// Null once the account is deleted.
	id: z.string().nullable(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	plan: adminUserPlanSchema.nullable(),
	memberSince: isoDateTimeSchema.nullable(),
});

export type AdminFeedbackReporter = z.infer<typeof adminFeedbackReporterSchema>;

export const adminFeedbackContextSchema = z.object({
	pageUrl: z.string(),
	replayUrl: z.string().nullable(),
	sentryEventId: z.string().nullable(),
	sentryEventAt: isoDateTimeSchema.nullable(),
	userAgent: z.string().nullable(),
	viewport: z
		.object({
			width: z.number().int(),
			height: z.number().int(),
		})
		.nullable(),
	locale: z.string().nullable(),
});

export type AdminFeedbackContext = z.infer<typeof adminFeedbackContextSchema>;

export const adminFeedbackProjectSchema = z.object({
	id: uuidSchema,
	name: z.string(),
});

export type AdminFeedbackProject = z.infer<typeof adminFeedbackProjectSchema>;

export const adminFeedbackLinearSchema = z.object({
	issueId: z.string(),
	url: z.string().nullable(),
});

export type AdminFeedbackLinear = z.infer<typeof adminFeedbackLinearSchema>;

export const adminFeedbackActivitySchema = z.object({
	id: uuidSchema,
	kind: feedbackActivityKindSchema,
	fromValue: z.string().nullable(),
	toValue: z.string().nullable(),
	actor: z
		.object({
			id: z.string(),
			name: z.string(),
		})
		.nullable(),
	createdAt: isoDateTimeSchema,
});

export type AdminFeedbackActivity = z.infer<typeof adminFeedbackActivitySchema>;

export const adminFeedbackSummarySchema = z.object({
	id: uuidSchema,
	// The server derives the title from the message.
	title: z.string(),
	message: z.string(),
	category: feedbackCategorySchema.nullable(),
	status: feedbackStatusSchema,
	priority: feedbackPrioritySchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
	resolvedAt: isoDateTimeSchema.nullable(),
	reporter: adminFeedbackReporterSchema,
	context: adminFeedbackContextSchema,
	project: adminFeedbackProjectSchema.nullable(),
	screenshotUrl: z.string().nullable(),
	linear: adminFeedbackLinearSchema.nullable(),
	adminNote: z.string(),
});

export type AdminFeedbackSummary = z.infer<typeof adminFeedbackSummarySchema>;

export const adminFeedbackDetailSchema = adminFeedbackSummarySchema.extend({
	// Newest entries come first.
	activity: z.array(adminFeedbackActivitySchema),
});

export type AdminFeedbackDetail = z.infer<typeof adminFeedbackDetailSchema>;

export const adminListFeedbackQuerySchema = paginationQuerySchema.extend({
	q: z.string().trim().min(1).max(200).optional(),
	sort: adminListFeedbackSortSchema.default("newest"),
	status: optionalCsvEnum(feedbackStatuses),
	category: optionalCsvEnum(feedbackCategories),
	priority: optionalCsvEnum(feedbackPriorities),
});

export type AdminListFeedbackQuery = z.infer<
	typeof adminListFeedbackQuerySchema
>;

export const adminListFeedbackResponseSchema = paginatedResultSchema(
	adminFeedbackSummarySchema,
);

export type AdminListFeedbackResponse = z.infer<
	typeof adminListFeedbackResponseSchema
>;

export const adminFeedbackStatsSchema = z.object({
	total: z.number().int(),
	byStatus: z.object({
		new: z.number().int(),
		reviewing: z.number().int(),
		planned: z.number().int(),
		resolved: z.number().int(),
	}),
	// Bug reports that are not resolved.
	openBugs: z.number().int(),
	// Urgent or high priority feedback that is not resolved.
	highPriorityOpen: z.number().int(),
	// Feedback resolved in the last seven days.
	resolvedLast7Days: z.number().int(),
});

export type AdminFeedbackStats = z.infer<typeof adminFeedbackStatsSchema>;

export const adminUpdateFeedbackInputSchema = z
	.object({
		status: feedbackStatusSchema.optional(),
		priority: feedbackPrioritySchema.optional(),
		adminNote: z.string().trim().max(4000).optional(),
	})
	.refine(
		(input) =>
			input.status !== undefined ||
			input.priority !== undefined ||
			input.adminNote !== undefined,
		{ message: "At least one field must change" },
	);

export type AdminUpdateFeedbackInput = z.infer<
	typeof adminUpdateFeedbackInputSchema
>;

export const deleteAdminFeedbackResponseSchema = z
	.object({ deleted: z.literal(true) })
	.strict();

export type DeleteAdminFeedbackResponse = z.infer<
	typeof deleteAdminFeedbackResponseSchema
>;
