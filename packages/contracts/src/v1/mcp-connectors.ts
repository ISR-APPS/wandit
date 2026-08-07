import { z } from "zod";
import { isoDateTimeSchema } from "./shared/primitives";

export const mcpConnectorAuthKinds = ["mcp_dcr", "oauth_prereg"] as const;
export const mcpConnectorAuthKindSchema = z.enum(mcpConnectorAuthKinds);

export const mcpConnectorStatuses = [
	"not_connected",
	"connected",
	"expired",
] as const;
export const mcpConnectorStatusSchema = z.enum(mcpConnectorStatuses);

export const mcpConnectorListItemSchema = z.object({
	// False when the server cannot run this connector's OAuth yet (e.g. a
	// pre-registered provider whose app credentials aren't configured) — the
	// UI shows "Coming soon" instead of Connect. Defaulted for tolerance of
	// older server responses that predate the field.
	available: z.boolean().default(true),
	connectedAt: isoDateTimeSchema.nullable(),
	description: z.string(),
	iconUrl: z.string().nullable(),
	name: z.string(),
	slug: z.string(),
	status: mcpConnectorStatusSchema,
});

export type McpConnectorListItem = z.infer<typeof mcpConnectorListItemSchema>;

export const mcpConnectorListSchema = z.array(mcpConnectorListItemSchema);

export const mcpConnectStartRequestSchema = z.object({
	returnUrl: z.url(),
});

export type McpConnectStartRequest = z.infer<
	typeof mcpConnectStartRequestSchema
>;

export const mcpConnectStartResponseSchema = z.object({
	authorizeUrl: z.url(),
});

export type McpConnectStartResponse = z.infer<
	typeof mcpConnectStartResponseSchema
>;

// Return-redirect query params (read by the web app after the 302 back).
// Deliberately say "app", not "mcp": these land in the user's address bar,
// and the product never says MCP anywhere a user can see.
export const MCP_CONNECTED_PARAM = "app_connected" as const;
export const MCP_ERROR_PARAM = "app_error" as const;
export const MCP_CONNECTOR_PARAM = "app_connector" as const;

export const mcpConnectorRoutes = {
	callback: "/api/v1/mcp/connectors/callback",
	connect: (slug: string) => `/api/v1/mcp/connectors/${slug}/connect`,
	disconnect: (slug: string) => `/api/v1/mcp/connectors/${slug}`,
	list: "/api/v1/mcp/connectors",
} as const;
