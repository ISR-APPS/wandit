import type {
	AdminFeedbackActivity,
	AdminFeedbackDetail,
	AdminFeedbackSummary,
	AdminListFeedbackSort,
	FeedbackPriority as ContractFeedbackPriority,
	FeedbackStatus as ContractFeedbackStatus,
	FeedbackCategory,
} from "@wandit/contracts";

export type FeedbackType = FeedbackCategory;
export type FeedbackStatus = ContractFeedbackStatus;
export type FeedbackPriority = ContractFeedbackPriority;
export type FeedbackItem = AdminFeedbackSummary;
export type FeedbackDetailItem = AdminFeedbackDetail;
export type FeedbackActivity = AdminFeedbackActivity;
export type FeedbackStatusFilter = "all" | FeedbackStatus;
export type FeedbackTypeFilter = "all" | FeedbackCategory;
export type FeedbackSort = AdminListFeedbackSort;
