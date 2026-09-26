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
// The hidden Supabase backend of a V2 user app.
export * from "./app-backends";
// V2 project git history: commits and branches.
export * from "./app-versions";
// Generated page/artifact tables.
export * from "./artifacts";
// V2 append-only audit trail.
export * from "./audit-events";
// Auth/user tables.
export * from "./auth";
// Billing tables.
export * from "./billing";
// V2 coding-agent session resume state.
export * from "./builder-sessions";
// V2 builder turn attempts.
export * from "./builder-turns";
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
// Shared durable generation lifecycle enum.
export * from "./generation-status";
// Standalone image generation attempt tables (chat's generate_image tool).
export * from "./image-generation-attempts";
// Lead-scrape (outbound prospecting) attempt tables.
export * from "./lead-scrape-attempts";
// Lead tables.
export * from "./lead-sheet-syncs";
export * from "./leads";
// Lifecycle email automation outbox.
export * from "./lifecycle-events";
// V2 LLM proxy request and usage rows.
export * from "./llm-proxy-requests";
// Marketing deliverable (HTML asset) tables.
export * from "./marketing-assets";
export * from "./mcp-connectors";
// V2 mobile app builds on EAS.
export * from "./mobile-builds";
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
// Per-project V2 spend limits.
export * from "./project-cost-caps";
// Encrypted per-project V2 secret values.
export * from "./project-secrets";
// Project tables.
export * from "./projects";
export * from "./push-tokens";
// Mobile push-notification device tokens.
// V2 provider sandbox lifecycle.
export * from "./sandbox-sessions";
// Story-link campaign and click analytics tables.
export * from "./story-links";
// Authenticated-user daily activity analytics.
export * from "./user-activity";
// Signup acquisition attribution.
export * from "./user-attributions";
