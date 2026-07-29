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
export const MCP_CONNECTED_PARAM = "mcp_connected" as const;
export const MCP_ERROR_PARAM = "mcp_error" as const;
export const MCP_CONNECTOR_PARAM = "mcp_connector" as const;

export const mcpConnectorRoutes = {
	callback: "/api/v1/mcp/connectors/callback",
	connect: (slug: string) => `/api/v1/mcp/connectors/${slug}/connect`,
	disconnect: (slug: string) => `/api/v1/mcp/connectors/${slug}`,
	list: "/api/v1/mcp/connectors",
} as const;
