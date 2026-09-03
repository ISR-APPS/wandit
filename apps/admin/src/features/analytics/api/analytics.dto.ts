import type {
	AdminAnalyticsFunnelStepUsersExportQuery,
	AdminAnalyticsFunnelStepUsersQuery,
	AdminAnalyticsQuery,
} from "@wandit/contracts";

export type {
	AdminAnalyticsAcquisitionResponse as AnalyticsAcquisitionResponse,
	AdminAnalyticsDevice as AnalyticsDevice,
	AdminAnalyticsDuration as AnalyticsDuration,
	AdminAnalyticsEngagementResponse as AnalyticsEngagementResponse,
	AdminAnalyticsFeaturesResponse as AnalyticsFeaturesResponse,
	AdminAnalyticsFunnelContact as AnalyticsFunnelContact,
	AdminAnalyticsFunnelContactInput as AnalyticsFunnelContactInput,
	AdminAnalyticsFunnelContactResponse as AnalyticsFunnelContactResponse,
	AdminAnalyticsFunnelResponse as AnalyticsFunnelResponse,
	AdminAnalyticsFunnelStepUser as AnalyticsFunnelStepUser,
	AdminAnalyticsFunnelStepUsersExportQuery as AnalyticsFunnelStepUsersExportQuery,
	AdminAnalyticsFunnelStepUsersQuery as AnalyticsFunnelStepUsersQuery,
	AdminAnalyticsFunnelStepUsersResponse as AnalyticsFunnelStepUsersResponse,
	AdminAnalyticsFunnelUserStep as AnalyticsFunnelUserStep,
	AdminAnalyticsHealthResponse as AnalyticsHealthResponse,
	AdminAnalyticsQuery as AnalyticsQuery,
	AdminAnalyticsRange as AnalyticsRange,
	AdminAnalyticsRevenueResponse as AnalyticsRevenueResponse,
} from "@wandit/contracts";

type DefaultedFunnelStepUsersListFields = "contacted" | "page" | "pageSize";

export type AnalyticsFunnelStepUsersQueryInput = AdminAnalyticsQuery &
	Partial<
		Pick<AdminAnalyticsFunnelStepUsersQuery, DefaultedFunnelStepUsersListFields>
	>;

export type AnalyticsFunnelStepUsersExportQueryInput = AdminAnalyticsQuery &
	Partial<Pick<AdminAnalyticsFunnelStepUsersExportQuery, "contacted">>;
