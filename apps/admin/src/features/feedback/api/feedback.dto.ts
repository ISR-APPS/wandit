// The admin feedback feature consumes the shared API contract directly. These
// re-exports and aliases keep the contract as the single source of truth.
import type {
	AdminFeedbackActivity,
	AdminFeedbackContext,
	AdminFeedbackDetail,
	AdminFeedbackLinear,
	AdminFeedbackProject,
	AdminFeedbackReporter,
	AdminFeedbackStats,
	AdminFeedbackSummary,
	AdminListFeedbackResponse,
	AdminListFeedbackSort,
	AdminUpdateFeedbackInput,
	FeedbackActivityKind,
	FeedbackCategory,
	FeedbackPriority,
	FeedbackStatus,
} from "@wandit/contracts";

export type {
	AdminFeedbackActivity,
	AdminFeedbackContext,
	AdminFeedbackDetail,
	AdminFeedbackLinear,
	AdminFeedbackProject,
	AdminFeedbackReporter,
	AdminFeedbackStats,
	AdminFeedbackSummary,
	AdminListFeedbackResponse,
	AdminListFeedbackSort,
	AdminUpdateFeedbackInput,
	FeedbackActivityKind,
	FeedbackCategory,
	FeedbackPriority,
	FeedbackStatus,
};

export type FeedbackItem = AdminFeedbackSummary;
export type FeedbackDetailItem = AdminFeedbackDetail;
export type FeedbackStats = AdminFeedbackStats;

export type ListFeedbackParams = {
	page: number;
	pageSize: number;
	q?: string;
	sort: AdminListFeedbackSort;
	status?: FeedbackStatus[];
	category?: FeedbackCategory[];
	priority?: FeedbackPriority[];
};

export type UpdateFeedbackInput = AdminUpdateFeedbackInput & {
	feedbackId: string;
};
