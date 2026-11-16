/**
 * TanStack Query key and options of the newest security scan of a project.
 * queryFn delegates to security-scan.services.ts. Read by
 * components/more/security-panel.tsx. use-builder-chat.ts refreshes the key
 * after every turn, because a `security_scan` turn stores a new report.
 */

import { queryOptions } from "@tanstack/react-query";

import { appBuilderKeys } from "./app-builder.queries";
import { getLatestSecurityScan } from "./security-scan.services";

/** Key of the newest scan, under `appBuilderKeys.all`. One per project. */
export const securityScanKeys = {
	latest: (projectId: string) =>
		[...appBuilderKeys.all, "security-scan", projectId] as const,
};

/**
 * The newest scan of the project. `enabled` is the `isActive` of the More
 * view: the view stays mounted while hidden, so the query must not fetch then.
 */
export const latestSecurityScanQuery = (projectId: string, enabled: boolean) =>
	queryOptions({
		queryKey: securityScanKeys.latest(projectId),
		queryFn: () => getLatestSecurityScan(projectId),
		enabled,
	});
