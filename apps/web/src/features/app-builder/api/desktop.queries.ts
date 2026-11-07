/**
 * TanStack Query keys and options of the desktop builds
 * (docs/v2/desktop-apps.md). queryFn delegates to desktop.services.ts and
 * refreshes the credits when a build ends. Read by the desktop body of
 * components/shell/publish-popover.tsx, by desktop-build-card.tsx, and by
 * desktop.mutations.ts.
 */

import { queryOptions } from "@tanstack/react-query";
import {
	type DesktopBuildStatus,
	type DesktopOverviewResponse,
	liveDesktopBuildStatuses,
} from "@wandit/contracts";

import { creditsKeys } from "@/features/credits";
import { hasEndedLiveBuild } from "../lib/helpers";
import { appBuilderKeys } from "./app-builder.queries";
import { getDesktopOverview } from "./desktop.services";

/** Keys of the desktop builds, under `appBuilderKeys.all`. One overview per project. */
export const desktopKeys = {
	overview: (projectId: string) =>
		[...appBuilderKeys.all, "desktop", projectId] as const,
};

/** 10 s between two overview reads while a build runs. A build takes 8 to 25 minutes. */
const DESKTOP_OVERVIEW_POLL_MS = 10_000;

/** The statuses of a build that has not ended, from the contract. The card reads it too. */
export const LIVE_DESKTOP_STATUSES: ReadonlySet<DesktopBuildStatus> = new Set(
	liveDesktopBuildStatuses,
);

/**
 * The newest desktop builds of one project and its desktop identity. The
 * publish popover mounts it, so the poll stops when the popover closes.
 */
export const desktopOverviewQuery = (projectId: string) =>
	queryOptions({
		queryKey: desktopKeys.overview(projectId),
		queryFn: async ({ client, queryKey }) => {
			const cached = client.getQueryData<DesktopOverviewResponse>(queryKey);
			const overview = await getDesktopOverview(projectId);
			// No other surface refreshes the balance and the activity list when a build ends.
			if (
				hasEndedLiveBuild(
					cached?.builds,
					overview.builds,
					LIVE_DESKTOP_STATUSES,
				)
			) {
				void client.invalidateQueries({ queryKey: creditsKeys.scope() });
			}
			return overview;
		},
		// The server pushes no event when a build ends, so the overview polls until it does.
		refetchInterval: (query) =>
			query.state.data?.builds.some((build) =>
				LIVE_DESKTOP_STATUSES.has(build.status),
			)
				? DESKTOP_OVERVIEW_POLL_MS
				: false,
	});
