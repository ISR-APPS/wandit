/**
 * The pure rules of the backend lifecycle (WANDIT-184, D3): which backends
 * the daily sweep pauses, deletes, or moves to `deleting`, when a wake is
 * stuck, what happens to the project of an `error` row, and how many
 * backends a plan may own. `backend-pause-sweep.runtime.ts` and
 * `CloudService` call the rules; `BackendsService` hands
 * `assertBackendEntitlement` to the locked write of `AppBackendsRepository`.
 * No I/O here.
 */
import type { BillingPlanId, SupabaseProjectStatus } from "@wandit/contracts";
import type { appBackendStatus } from "@wandit/db/schema/app-backends";

// One day in milliseconds; every window below counts whole days.
const DAY_MS = 86_400_000;
// The delete-app-project task moves the backend of a deleted project to
// `deleting` within minutes. One day later, a row that is not there
// means that step failed or never ran.
const ORPHAN_AFTER_MS = DAY_MS;
// 10 min, from WANDIT-184. It is longer than the turn wake (about 5 min),
// so a wake that a turn started never times out here. A turn that joins an
// earlier Cloud tab restore can see that restore time out.
const RESTORE_TIMEOUT_MS = 600_000;
// 30 min: longer than the 15 min `maxDuration` of the provision-backend
// task plus a queue wait, so a run that still works never times out here.
const CREATE_TIMEOUT_MS = 1_800_000;

/**
 * Every number of the lifecycle. All values are provisional defaults from
 * D3, not settled product rules. The Supabase for Platforms contract
 * (WANDIT-153) replaces them. Env values override the two idle windows.
 */
export const BACKEND_DEFAULTS = Object.freeze({
	/** Provisional D3 default: idle days before the sweep pauses an unpublished backend. */
	idleDays: 7,
	/** Provisional D3 default (ESTIMATE): idle days for a backend with a live publish. */
	publishedIdleDays: 30,
	/** Provisional D3 default: days between `deleting` and the real Supabase delete. */
	deleteGraceDays: 7,
	/** Provisional default (ESTIMATE): at most this many rows in each of the six steps of one sweep run. */
	sweepBatchCap: 50,
	/**
	 * Provisional D3 default, WANDIT-153 open: backends one owner may hold per
	 * plan. D3 names Pro and Business; the issue sets `starter` to 0.
	 * Business is 1000, Zack's choice: in practice a Business owner has no limit.
	 */
	backendsPerPlan: Object.freeze({
		starter: 0,
		pro: 1,
		business: 1000,
	} satisfies Record<BillingPlanId, number>),
});

/** The windows one sweep run applies, in whole days. The runtime builds them from the env and `BACKEND_DEFAULTS`. */
export type BackendLifecycleWindows = {
	/** Idle days before an unpublished backend pauses. */
	idleDays: number;
	/** Idle days before a backend with a live publish pauses. */
	publishedIdleDays: number;
	/** Days a `deleting` backend waits before the real delete. */
	deleteGraceDays: number;
};

/** The row facts the select rules read; the sweep reads them with `listLifecycleCandidates`. */
export type BackendLifecycleFacts = {
	status: (typeof appBackendStatus.enumValues)[number];
	/** When the row was inserted; the idle clock starts here while `lastActiveAt` is null. */
	createdAt: Date;
	/** Last turn end, publish, Cloud tab read, or agent backend tool call; null before the first one. */
	lastActiveAt: Date | null;
	/** When the project delete or the sweep moved the row to `deleting`; null otherwise. */
	deletingAt: Date | null;
	/** True when the project has a live publish (an `active` `deployments` row). */
	published: boolean;
	/** `projects.deleted_at` of the project; null while the project lives. */
	projectDeletedAt: Date | null;
};

/**
 * The `active` rows of live projects whose last activity is older than
 * their window. A published row gets `publishedIdleDays`, because the
 * sweep cannot see the traffic of a published app. A row exactly on the
 * window stays.
 */
export function selectBackendsToPause<TRow extends BackendLifecycleFacts>(
	rows: readonly TRow[],
	now: Date,
	windows: BackendLifecycleWindows,
): TRow[] {
	return rows.filter((row) => {
		// Only a running backend can pause; every other state has its own
		// owner. A deleted project's backend goes to `deleting` instead.
		if (row.status !== "active" || row.projectDeletedAt !== null) {
			return false;
		}
		const days = row.published ? windows.publishedIdleDays : windows.idleDays;
		// Creation alone is no activity, so a row never touched counts from its insert.
		const lastActiveAt = row.lastActiveAt ?? row.createdAt;
		return lastActiveAt.getTime() < now.getTime() - days * DAY_MS;
	});
}

/**
 * The `deleting` rows whose grace window is over. A row exactly on the
 * window stays one more day.
 */
export function selectBackendsToDelete<TRow extends BackendLifecycleFacts>(
	rows: readonly TRow[],
	now: Date,
	windows: BackendLifecycleWindows,
): TRow[] {
	return rows.filter(
		(row) =>
			row.status === "deleting" &&
			row.deletingAt !== null &&
			row.deletingAt.getTime() <
				now.getTime() - windows.deleteGraceDays * DAY_MS,
	);
}

/**
 * The rows of projects deleted more than a day ago that never reached
 * `deleting`: a failed or missing delete step, or a delete from before
 * WANDIT-184. The sweep moves them to `deleting`, so the grace delete runs.
 */
export function selectOrphanedBackends<TRow extends BackendLifecycleFacts>(
	rows: readonly TRow[],
	now: Date,
): TRow[] {
	return rows.filter(
		(row) =>
			row.status !== "deleting" &&
			row.projectDeletedAt !== null &&
			row.projectDeletedAt.getTime() < now.getTime() - ORPHAN_AFTER_MS,
	);
}

/**
 * True when Supabase runs the project or brings it up. After a failed
 * restore call, the wake and the Cloud tab read the status: a project in
 * one of these states needs no restore, only a wait.
 */
export function isProjectComingUp(status: SupabaseProjectStatus): boolean {
	return (
		status === "ACTIVE_HEALTHY" ||
		status === "COMING_UP" ||
		status === "RESTORING"
	);
}

/**
 * The cutoff of a stuck wake: a row that entered `restoring` before this
 * moment moves to `error` with `backend_restore_failed`. The sweep and
 * the Cloud tab read it, so a project stuck in `COMING_UP` does not keep
 * the row `restoring` for ever.
 */
export function stuckRestoreCutoff(now: Date): Date {
	return new Date(now.getTime() - RESTORE_TIMEOUT_MS);
}

/**
 * The cutoff of a stuck provisioning: a `creating` row with no write since
 * this moment moves to `error`, so the Cloud tab offers "Try again". It
 * covers a run that never started or stopped without a status write.
 */
export function stuckCreatingCutoff(now: Date): Date {
	return new Date(now.getTime() - CREATE_TIMEOUT_MS);
}

/**
 * What the sweep does with the Supabase project of an `error` row. A
 * failed provisioning or restore can leave a project that runs and costs
 * money. `pause` stops it, `mark` records that it does not run, and
 * `wait` reads it again at the next run, because it is still changing.
 */
export function errorBackendAction(
	status: SupabaseProjectStatus,
): "pause" | "mark" | "wait" {
	// A failed pause can leave the project running, so it gets one more try.
	if (
		status === "ACTIVE_HEALTHY" ||
		status === "ACTIVE_UNHEALTHY" ||
		status === "PAUSE_FAILED"
	) {
		return "pause";
	}
	if (
		status === "INACTIVE" ||
		status === "INIT_FAILED" ||
		status === "REMOVED" ||
		status === "RESTORE_FAILED"
	) {
		return "mark";
	}
	return "wait";
}

/** Answer of `assertBackendEntitlement`: allowed, or the typed refusal. */
export type BackendEntitlement =
	| { allowed: true }
	| {
			allowed: false;
			code: "backend_limit_reached";
			/** The plan of the owner that pays for the backend. */
			plan: BillingPlanId;
			/** Backends the plan allows, from `BACKEND_DEFAULTS.backendsPerPlan`. */
			limit: number;
	  };

/** The refusal variant of `BackendEntitlement`; the repository answers it on a refused insert. */
export type BackendRefusal = Extract<BackendEntitlement, { allowed: false }>;

/**
 * Checks one more backend against the plan limit. `ownedBackends` counts
 * the owner's backends that are not `deleting` or `error`. At the limit
 * the answer is the `backend_limit_reached` refusal.
 */
export function assertBackendEntitlement(
	plan: BillingPlanId,
	ownedBackends: number,
): BackendEntitlement {
	const limit = BACKEND_DEFAULTS.backendsPerPlan[plan];
	if (ownedBackends < limit) {
		return { allowed: true };
	}
	return { allowed: false, code: "backend_limit_reached", limit, plan };
}
