/**
 * TanStack Query key and options of the AI panel of the More view. queryFn
 * delegates to app-ai.services.ts. Read by components/more/ai-panel.tsx;
 * app-ai.mutations.ts refreshes the key after a write.
 */

import { queryOptions } from "@tanstack/react-query";

import { getAppAiStatus } from "./app-ai.services";
import { cloudKeys } from "./cloud.queries";

/**
 * Key of the AI status, under `cloudKeys.all`. The `enable_ai` tool of a
 * builder turn changes the status, and use-builder-chat.ts refreshes
 * `cloudKeys.all` after every turn.
 */
export const appAiKeys = {
	status: (projectId: string) => [...cloudKeys.all(projectId), "ai"] as const,
};

/**
 * The gateway state, the month usage, and the models of the project.
 * `enabled` is the `isActive` of the More view: the view stays mounted
 * while hidden, so the query must not fetch then.
 */
export const appAiStatusQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: appAiKeys.status(projectId),
		queryFn: () => getAppAiStatus(projectId),
		enabled,
	});
