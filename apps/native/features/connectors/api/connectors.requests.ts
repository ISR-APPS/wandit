/**
 * connectors.requests.ts — raw JSON calls for the MCP connectors API.
 *
 * The native connect flow is: POST connect (returnUrl = app deep link) →
 * open authorizeUrl in the system auth browser → the server callback 302s
 * back to the deep link with code+state → POST complete (authenticated)
 * finishes the token exchange server-side. Tokens never reach the app.
 */
import {
	type McpConnectCompleteRequest,
	type McpConnectorListItem,
	type McpConnectStartResponse,
	mcpConnectorListItemSchema,
	mcpConnectorListSchema,
	mcpConnectorRoutes,
	mcpConnectStartResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/shared/lib/api-client";

// GET /api/v1/mcp/connectors
export async function getConnectors(): Promise<McpConnectorListItem[]> {
	const data = await apiClient.get<unknown>(mcpConnectorRoutes.list);
	return mcpConnectorListSchema.parse(data);
}

// POST /api/v1/mcp/connectors/:slug/connect
export async function startConnect(
	slug: string,
	returnUrl: string,
): Promise<McpConnectStartResponse> {
	const data = await apiClient.post<unknown>(mcpConnectorRoutes.connect(slug), {
		returnUrl,
	});
	return mcpConnectStartResponseSchema.parse(data);
}

// POST /api/v1/mcp/connectors/complete
export async function completeConnect(
	body: McpConnectCompleteRequest,
): Promise<McpConnectorListItem> {
	const data = await apiClient.post<unknown>(mcpConnectorRoutes.complete, body);
	return mcpConnectorListItemSchema.parse(data);
}

// DELETE /api/v1/mcp/connectors/:slug
export async function disconnectConnector(
	slug: string,
): Promise<McpConnectorListItem> {
	const data = await apiClient.delete<unknown>(
		mcpConnectorRoutes.disconnect(slug),
	);
	return mcpConnectorListItemSchema.parse(data);
}
