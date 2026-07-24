// Barrel file for all Drizzle database schema modules.
//
// If you add a new table file and want it in the root schema, export it here.

// Generated page/artifact tables.
export * from "./artifacts";
// Auth/user tables.
export * from "./auth";
// Billing tables.
export * from "./billing";
// Chat and message tables.
export * from "./chats";
// Credit ledger tables.
export * from "./credits";
// Deployment tables.
export * from "./deployments";
// Domain tables.
export * from "./domains";
// Lead-scrape (outbound prospecting) attempt tables.
export * from "./lead-scrape-attempts";
// Lead tables.
export * from "./leads";
// Image-to-video generation attempt tables.
export * from "./media-generation-attempts";
// Payment order tables.
export * from "./orders";
// Page generation attempt tables.
export * from "./page-attempts";
// Project tables.
export * from "./projects";
