export type ProviderStatusTool = {
	idProperty?: string;
	toolName: string;
};

const DEFAULT_FOLLOW_DEADLINE_MS = 25 * 60 * 1000;
const PERSONAL_CLIPPER_FOLLOW_DEADLINE_MS = 50 * 60 * 1000;
const PERSONAL_CLIPPER_TOOL_NAME = "personal_clipper_create";

/** Provider-specific status surface for a submitted connector tool. */
export function statusToolFor(
	connectorSlug: string,
	toolName: string,
): ProviderStatusTool {
	if (
		connectorSlug.trim().toLowerCase() === "higgsfield" &&
		normalizeToolName(toolName) === PERSONAL_CLIPPER_TOOL_NAME
	) {
		return {
			idProperty: "row_id",
			toolName: "personal_clipper_status",
		};
	}

	return { toolName: "job_status" };
}

/** Follow window kept below the Trigger task's duration ceiling. */
export function followDeadlineFor(toolName: string): number {
	return normalizeToolName(toolName) === PERSONAL_CLIPPER_TOOL_NAME
		? PERSONAL_CLIPPER_FOLLOW_DEADLINE_MS
		: DEFAULT_FOLLOW_DEADLINE_MS;
}

function normalizeToolName(toolName: string): string {
	return toolName.trim().toLowerCase();
}
