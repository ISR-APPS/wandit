import {
	type McpConnectorListItem,
	type McpConnectStartRequest,
	type McpConnectStartResponse,
	mcpConnectorListItemSchema,
	mcpConnectorListSchema,
	mcpConnectorRoutes,
	mcpConnectStartResponseSchema,
} from "@wandit/contracts";

import { apiClient } from "@/lib/api-client";

export async function listConnectors(): Promise<McpConnectorListItem[]> {
	const data = await apiClient.get<unknown>(mcpConnectorRoutes.list);
	return mcpConnectorListSchema.parse(data);
}

export async function startConnect(
	slug: string,
	returnUrl: string,
): Promise<McpConnectStartResponse> {
	const data = await apiClient.post<unknown, McpConnectStartRequest>(
		mcpConnectorRoutes.connect(slug),
		{ returnUrl },
	);
	return mcpConnectStartResponseSchema.parse(data);
}

export async function disconnectConnector(
	slug: string,
): Promise<McpConnectorListItem> {
	const data = await apiClient.delete<unknown>(
		mcpConnectorRoutes.disconnect(slug),
	);
	return mcpConnectorListItemSchema.parse(data);
}
