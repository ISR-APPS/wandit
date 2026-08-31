/**
 * Main export file for `@wandit/contracts`.
 *
 * When code imports from `@wandit/contracts`, it gets exports from this file.
 * Keep this file as re-exports only. No business logic here.
 */
// `export *` forwards exports from another file.
// Normal API response envelope.
export * from "./http/envelope";
// API error codes.
export * from "./http/error-codes";
// Pagination helpers.
export * from "./http/pagination";
// Academy guide contracts.
export * from "./v1/academy";
// Admin dashboard contracts.
export * from "./v1/admin";
// Admin analytics contracts.
export * from "./v1/admin-analytics";
// Admin monthly-cost contracts.
export * from "./v1/admin-costs";
// Admin feedback contracts.
export * from "./v1/admin-feedback";
// Affiliate capture and admin contracts.
export * from "./v1/affiliates";
// AI SDK chat tool and stream contracts.
export * from "./v1/ai-chat";
// Artifact/page contracts.
export * from "./v1/artifacts";
// Attachment upload contract.
export * from "./v1/attachments";
// UTM attribution capture contracts.
export * from "./v1/attribution";
// Auth contracts.
export * from "./v1/auth";
// Billing contracts.
export * from "./v1/billing";
// Chat API and stream contracts.
export * from "./v1/chats";
// Connector (MCP) background generation contracts.
export * from "./v1/connector-generations";
// Credits contracts.
export * from "./v1/credits";
// Deployment contracts.
export * from "./v1/deployments";
// Shared country calling-code data and E.164 country inference.
export * from "./v1/dial-codes";
// Domain contracts.
export * from "./v1/domains";
// In-app user feedback contracts.
export * from "./v1/feedback";
// Standalone image generation contracts.
export * from "./v1/image-generations";
// Lead-scrape (outbound prospecting) contracts.
export * from "./v1/lead-scrapes";
// Lead contracts.
export * from "./v1/lead-sheet-sync";
export * from "./v1/leads";
// Marketing asset (HTML deliverable) contracts.
export * from "./v1/marketing-assets";
// MCP connector contracts.
export * from "./v1/mcp-connectors";
// Image-to-video generation contracts.
export * from "./v1/media-generations";
// Post-signup onboarding contracts.
export * from "./v1/onboarding";
// Payment order contracts.
export * from "./v1/orders";
// Page edit-ops contract.
export * from "./v1/page-edits";
// Page theme vocabulary (tokens, fonts, presets).
export * from "./v1/page-theme";
// Page generation contracts.
export * from "./v1/pages";
// Product-event contracts.
export * from "./v1/product-events";
// Project media assets (Assets tab) contracts.
export * from "./v1/project-assets";
// Project contracts.
export * from "./v1/projects";
// Mobile push-notification token contracts.
export * from "./v1/push-tokens";
// Product settings contracts.
export * from "./v1/settings";
// Shared id/date validators.
export * from "./v1/shared/primitives";
// Story-link campaign and analytics contracts.
export * from "./v1/story-links";
// Support (live chat identity) contracts.
export * from "./v1/support";
// Audio transcription contract.
export * from "./v1/transcriptions";
// Workspace (organization) contracts.
export * from "./v1/workspaces";
