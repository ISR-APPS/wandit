import { uuidSchema } from "@wandit/contracts";

const WORKSPACE_PROJECT_PATH = /^\/p\/([0-9a-f-]{36})(?:\/|$)/;

/** Extracts the optional workspace project id from a feedback page URL. */
export function projectIdFromPageUrl(pageUrl: string): string | null {
	let parsed: URL;

	try {
		parsed = new URL(pageUrl);
	} catch {
		return null;
	}

	const projectId = WORKSPACE_PROJECT_PATH.exec(parsed.pathname)?.[1];

	return projectId && uuidSchema.safeParse(projectId).success
		? projectId
		: null;
}
