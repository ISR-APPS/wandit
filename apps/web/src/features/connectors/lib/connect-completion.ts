export const CONNECT_COMPLETE_PATH = "/connect/complete" as const;
export const MCP_CONNECTORS_CHANNEL = "mcp-connectors" as const;

const mcpConnectOutcomes = [
	"success",
	"denied",
	"failed",
	"invalid_state",
] as const;

export type McpConnectOutcome = (typeof mcpConnectOutcomes)[number];

export type McpConnectMessage = {
	outcome: McpConnectOutcome;
	slug: string | null;
};

export function isMcpConnectMessage(
	value: unknown,
): value is McpConnectMessage {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as { outcome?: unknown; slug?: unknown };

	return (
		typeof candidate.outcome === "string" &&
		mcpConnectOutcomes.includes(candidate.outcome as McpConnectOutcome) &&
		(typeof candidate.slug === "string" || candidate.slug === null)
	);
}
