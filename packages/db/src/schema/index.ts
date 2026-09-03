// Barrel file for all Drizzle database schema modules.
//
// If you add a new table file and want it in the root schema, export it here.

// Academy guide tables.
export * from "./academy";
// Admin access audit trail.
export * from "./admin-audit-events";
// Admin funnel outreach tracking.
export * from "./admin-funnel-contacts";
// Per-user support dashboard view grants.
export * from "./admin-view-grants";
// Affiliate programs, attribution, commissions, and payouts.
export * from "./affiliates";
// Generated page/artifact tables.
export * from "./artifacts";
// Auth/user tables.
export * from "./auth";
// Billing tables.
export * from "./billing";
// Subscription cancellation survey tables.
export * from "./cancellation-reasons";
// Chat and message tables.
export * from "./chats";
// Connector (MCP) background generation attempt tables.
export * from "./connector-generation-attempts";
// Connector provider operation analytics tables.
export * from "./connector-operation-events";
// Credit ledger tables.
export * from "./credits";
// Deployment tables.
export * from "./deployments";
// Domain tables.
export * from "./domains";
// In-app feedback and activity tables.
export * from "./feedback";
// Standalone image generation attempt tables (chat's generate_image tool).
export * from "./image-generation-attempts";
// Lead-scrape (outbound prospecting) attempt tables.
export * from "./lead-scrape-attempts";
// Lead tables.
export * from "./lead-sheet-syncs";
export * from "./leads";
// Lifecycle email automation outbox.
export * from "./lifecycle-events";
// Marketing deliverable (HTML asset) tables.
export * from "./marketing-assets";
export * from "./mcp-connectors";
// Video generation attempt and continuation-leg tables.
export * from "./media-generation-attempts";
export * from "./media-generation-legs";
// Monthly cost input tables.
export * from "./monthly-costs";
// User onboarding questionnaire answers.
export * from "./onboarding";
// Payment order tables.
export * from "./orders";
// Organization (Teams/Workspaces) tables — Better Auth org plugin models +
// application-owned org billing settings/limits.
export * from "./organizations";
// Page generation attempt tables.
export * from "./page-attempts";
// Authenticated product intent event tables.
export * from "./product-events";
// Project tables.
export * from "./projects";
export * from "./push-tokens";
// Mobile push-notification device tokens.
// Story-link campaign and click analytics tables.
export * from "./story-links";
// Authenticated-user daily activity analytics.
export * from "./user-activity";
// Signup acquisition attribution.
export * from "./user-attributions";
