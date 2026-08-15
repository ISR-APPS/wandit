// Barrel file for all Drizzle database schema modules.
//
// If you add a new table file and want it in the root schema, export it here.

// Academy guide tables.
export * from "./academy";
// Affiliate programs, attribution, commissions, and payouts.
export * from "./affiliates";
// Generated page/artifact tables.
export * from "./artifacts";
// Auth/user tables.
export * from "./auth";
// Billing tables.
export * from "./billing";
// Chat and message tables.
export * from "./chats";
// Connector (MCP) background generation attempt tables.
export * from "./connector-generation-attempts";
// Credit ledger tables.
export * from "./credits";
// Deployment tables.
export * from "./deployments";
// Domain tables.
export * from "./domains";
// Standalone image generation attempt tables (chat's generate_image tool).
export * from "./image-generation-attempts";
// Lead-scrape (outbound prospecting) attempt tables.
export * from "./lead-scrape-attempts";
// Lead tables.
export * from "./lead-sheet-syncs";
export * from "./leads";
// Marketing deliverable (HTML asset) tables.
export * from "./marketing-assets";
export * from "./mcp-connectors";
// Image-to-video generation attempt tables.
export * from "./media-generation-attempts";
// Payment order tables.
export * from "./orders";
// Organization (Teams/Workspaces) tables — Better Auth org plugin models +
// application-owned org billing settings/limits.
export * from "./organizations";
// Page generation attempt tables.
export * from "./page-attempts";
// Project tables.
export * from "./projects";
