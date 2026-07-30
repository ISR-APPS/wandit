import type { McpConnectorListItem } from "@wandit/contracts";

export type ConnectionStatusSource = {
	accessToken: string | null;
	accessTokenExpiresAt: Date | null;
	refreshToken?: string | null;
};

export function deriveStatus(
	connection: ConnectionStatusSource | null | undefined,
): McpConnectorListItem["status"] {
	if (!connection || connection.accessToken === null) {
		return "not_connected";
	}

	if (
		connection.accessTokenExpiresAt &&
		connection.accessTokenExpiresAt.getTime() < Date.now() &&
		!connection.refreshToken
	) {
		return "expired";
	}

	return "connected";
}
