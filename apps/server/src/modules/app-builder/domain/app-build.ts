/**
 * The status machine of a V2 web app publish attempt (WANDIT-178).
 * `AppPublishRepository.transition` puts `appBuildStatusesThatMayMoveTo`
 * in its WHERE clause, so a stale writer changes nothing. Nothing here does IO.
 */
import { type AppBuildStatus, appBuildStatuses } from "@wandit/contracts";

/**
 * The next statuses of each status. A rollback also passes `building`: its
 * claim is the same compare-and-set, and it skips the sandbox build.
 */
const APP_BUILD_TRANSITIONS: Readonly<
	Record<AppBuildStatus, readonly AppBuildStatus[]>
> = {
	queued: ["building", "failed"],
	building: ["uploading", "blocked", "failed"],
	uploading: ["published", "failed"],
	published: [],
	blocked: [],
	failed: [],
};

/** The statuses a row must hold before a compare-and-set to `to`. */
export function appBuildStatusesThatMayMoveTo(
	to: AppBuildStatus,
): AppBuildStatus[] {
	return appBuildStatuses.filter((from) =>
		APP_BUILD_TRANSITIONS[from].includes(to),
	);
}
