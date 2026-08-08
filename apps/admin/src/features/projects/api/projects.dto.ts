import type {
	AdminProjectAsset,
	AdminProjectDetail,
	AdminProjectDomain,
	AdminProjectLeadScrapeExports,
	AdminProjectLeads,
	AdminProjectMarketingAsset,
	AdminProjectMetadata,
	AdminProjectOwner,
	AdminProjectSheetsIntegration,
	AdminProjectVersionHtmlResponse,
	AdminProjectVersionListItem,
	AdminProjectVersionsQuery,
	AdminProjectVersionsResponse,
	AdminProjectWebsite,
	Lead,
	LeadScrapeAttempt,
} from "@wandit/contracts";

export type {
	AdminProjectAsset,
	AdminProjectDetail,
	AdminProjectDomain,
	AdminProjectLeadScrapeExports,
	AdminProjectLeads,
	AdminProjectMarketingAsset,
	AdminProjectMetadata,
	AdminProjectOwner,
	AdminProjectSheetsIntegration,
	AdminProjectVersionHtmlResponse,
	AdminProjectVersionListItem,
	AdminProjectVersionsQuery,
	AdminProjectVersionsResponse,
	AdminProjectWebsite,
	Lead,
	LeadScrapeAttempt,
};

export type ListAdminProjectVersionsParams = AdminProjectVersionsQuery & {
	projectId: string;
};
