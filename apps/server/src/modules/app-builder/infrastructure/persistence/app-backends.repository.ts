/**
 * Read and write of the `app_backends` row of one project (D18).
 * `BackendsService` inserts the `creating` row under the plan limit; the
 * `provision-backend` runtime marks it created, active, or error. The
 * lifecycle (WANDIT-184) stamps activity, pauses, restores, and deletes
 * through compare-and-set writes. The unique index
 * `app_backends_projectId_uq` keeps one row per project.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, lt, ne, or, sql } from "@wandit/db";
import {
	type appBackendStatus,
	appBackends,
} from "@wandit/db/schema/app-backends";
import { deployments } from "@wandit/db/schema/deployments";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";
import type {
	BackendEntitlement,
	BackendLifecycleFacts,
	BackendRefusal,
} from "../../domain/backend-lifecycle";

/** The `app_backend_status` enum values the schema declares. */
export type AppBackendStatus = (typeof appBackendStatus.enumValues)[number];

/** The `app_backends` columns the provisioning flow reads and writes. */
export type AppBackendRow = {
	id: string;
	projectId: string;
	userId: string;
	organizationId: string | null;
	/** The 20-letter Supabase project ref; null until the create call answers. */
	ref: string | null;
	/** Supabase region of the project, for example "eu-west-3". D8 picks it from the user IP. */
	region: string;
	/** Id of the wandit organization on the Supabase platform account; null until create answers. */
	orgId: string | null;
	status: AppBackendStatus;
	/** Public anon key the app uses in the browser. Not a secret; null until active. */
	anonKey: string | null;
	/** Postgres host of the Supabase project; null until the project reports one. */
	dbHost: string | null;
	/** Dedupe key of the provision request; the task idempotency key derives from it. */
	requestKey: string;
	/** Trigger.dev run id of the provision task. */
	triggerRunId: string | null;
	/** Machine failure code of the last failed run; null while healthy. */
	failureCode: string | null;
};

/** Failure details `markError` stores on the row. */
export type AppBackendFailure = {
	/** Human-readable reason, from `getErrorMessage`. */
	error: string;
	/** Machine code, for example `backend_provision_timeout`. */
	failureCode: string;
	/** Coarse failure family for admin filtering. */
	failureKind: "timeout" | "provider" | "internal" | "config";
	/** Which layer failed: the Supabase API, the network, or the task. */
	failureSource: "supabase_api" | "network" | "task";
	/** External provider that reported the failure; null for task-side errors. */
	failureProvider: "supabase" | null;
	/** Raw message the provider returned; null without one. */
	failureProviderMessage: string | null;
	/** Provider-side request id for support lookups; null without one. */
	failureRequestId: string | null;
	/** Sentry event id of the captured failure; null when capture failed. */
	sentryEventId: string | null;
};

/**
 * One row the backend lifecycle sweep reads: the facts of the pure rules
 * plus the ids the sweep writes with. Its own projection, so the other
 * readers keep `APP_BACKEND_COLUMNS`.
 */
export type BackendLifecycleRow = BackendLifecycleFacts & {
	id: string;
	projectId: string;
	organizationId: string | null;
	/** The Supabase project ref; the query reads only rows that have one. */
	ref: string;
};

/** Answer of `insertCreatingWithinLimit`. */
export type InsertCreatingOutcome =
	| {
			/** `inserted`: this call wrote the row; `exists`: the project already had one. */
			kind: "inserted" | "exists";
			row: AppBackendRow;
	  }
	| { kind: "refused"; refusal: BackendRefusal };

// A read or a write that runs on the pool or inside one transaction.
type AppBackendsClient =
	| Database
	| Parameters<Parameters<Database["transaction"]>[0]>[0];

// The statuses that still hold a Supabase project for the owner. The
// schema comment of `app_backend_status` names the same four.
const OWNED_STATUSES: AppBackendStatus[] = [
	"creating",
	"active",
	"paused",
	"restoring",
];

// The columns every reader selects and the insert returns. A narrower
// projection than `$inferSelect`: the secret-row ids, the timestamps,
// provider, error, and the failure detail columns stay unread.
const APP_BACKEND_COLUMNS = {
	id: appBackends.id,
	projectId: appBackends.projectId,
	userId: appBackends.userId,
	organizationId: appBackends.organizationId,
	ref: appBackends.ref,
	region: appBackends.region,
	orgId: appBackends.orgId,
	status: appBackends.status,
	anonKey: appBackends.anonKey,
	dbHost: appBackends.dbHost,
	requestKey: appBackends.requestKey,
	triggerRunId: appBackends.triggerRunId,
	failureCode: appBackends.failureCode,
};

@Injectable()
export class AppBackendsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The backend row of one project, or null when none was written. */
	async findByProjectId(projectId: string): Promise<AppBackendRow | null> {
		const [row] = await this.db
			.select(APP_BACKEND_COLUMNS)
			.from(appBackends)
			.where(eq(appBackends.projectId, projectId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Inserts the `creating` row of a new project when `check` accepts the
	 * payer's count of owned backends. One transaction under a per-payer
	 * advisory lock: the project row check, the count, and the insert.
	 */
	async insertCreatingWithinLimit(
		input: {
			projectId: string;
			userId: string;
			organizationId: string | null;
			region: string;
			requestKey: string;
		},
		/** The payer whose backends count against the plan: the org, else the user. */
		owner: CreditOwner,
		/** The plan rule: `assertBackendEntitlement` bound to the payer's plan. */
		check: (ownedBackends: number) => BackendEntitlement,
	): Promise<InsertCreatingOutcome> {
		return this.db.transaction(async (tx) => {
			// Two parallel creates of one payer must not both pass the plan
			// limit. The prefix keeps this lock apart from the credit lock.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`app-backends:${creditOwnerLockValue(owner)}`}))`,
			);
			// A second call for the same project answers its row, not a refusal.
			const [existing] = await tx
				.select(APP_BACKEND_COLUMNS)
				.from(appBackends)
				.where(eq(appBackends.projectId, input.projectId))
				.limit(1);
			if (existing !== undefined) {
				return { kind: "exists", row: existing };
			}
			const entitlement = check(await this.countActiveForOwner(owner, tx));
			if (!entitlement.allowed) {
				return { kind: "refused", refusal: entitlement };
			}
			const [row] = await tx
				.insert(appBackends)
				.values({
					projectId: input.projectId,
					userId: input.userId,
					organizationId: input.organizationId,
					region: input.region,
					requestKey: input.requestKey,
					status: "creating",
				})
				.returning(APP_BACKEND_COLUMNS);
			if (row === undefined) {
				throw new Error(
					`app_backends insert returned no row for project ${input.projectId}`,
				);
			}
			return { kind: "inserted", row };
		});
	}

	/**
	 * Stores the run id the trigger call returned. No CAS: the API writes
	 * this once, right after `tasks.trigger` answers.
	 */
	async setTriggerRunId(
		projectId: string,
		triggerRunId: string,
	): Promise<void> {
		await this.db
			.update(appBackends)
			.set({ triggerRunId })
			.where(eq(appBackends.projectId, projectId));
	}

	/**
	 * Stores the ref and the platform org id after a successful create call.
	 * The status stays `creating` until the project reports healthy.
	 */
	async markCreated(
		projectId: string,
		input: { ref: string; orgId: string },
	): Promise<void> {
		await this.db
			.update(appBackends)
			.set({ ref: input.ref, orgId: input.orgId })
			.where(eq(appBackends.projectId, projectId));
	}

	/**
	 * Marks the backend ready: stores the anon key, the host, and the
	 * activity stamp, and clears the failure columns of an earlier failed
	 * run. A `deleting` row stays `deleting`, and the answer is false.
	 */
	async markActive(
		projectId: string,
		input: { anonKey: string; dbHost: string; lastActiveAt: Date },
	): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({
				anonKey: input.anonKey,
				dbHost: input.dbHost,
				error: null,
				failureCode: null,
				failureKind: null,
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: null,
				lastActiveAt: input.lastActiveAt,
				sentryEventId: null,
				status: "active",
			})
			.where(
				and(
					eq(appBackends.projectId, projectId),
					// A project delete during provisioning wins: the sweep must still
					// delete the Supabase project after the grace window.
					ne(appBackends.status, "deleting"),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * Moves a `paused` row to `restoring` with a compare-and-set. Answers
	 * false when the row is not `paused`, so a second restore click starts
	 * nothing. Callers: `CloudService.restoreBackend` and the turn wake.
	 */
	async markRestoring(projectId: string): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({ status: "restoring" })
			.where(
				and(
					eq(appBackends.projectId, projectId),
					eq(appBackends.status, "paused"),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * Marks the backend failed and stores the eight failure columns. A
	 * `deleting` row stays `deleting`, so the sweep still deletes it.
	 */
	async markError(
		projectId: string,
		failure: AppBackendFailure,
	): Promise<void> {
		await this.db
			.update(appBackends)
			.set({
				error: failure.error,
				failureCode: failure.failureCode,
				failureKind: failure.failureKind,
				failureProvider: failure.failureProvider,
				failureProviderMessage: failure.failureProviderMessage,
				failureRequestId: failure.failureRequestId,
				failureSource: failure.failureSource,
				sentryEventId: failure.sentryEventId,
				status: "error",
			})
			.where(
				and(
					eq(appBackends.projectId, projectId),
					ne(appBackends.status, "deleting"),
				),
			);
	}

	/**
	 * Stamps `lastActiveAt` on an `active` row; another status stays as it
	 * is. The pause sweep reads the stamp. Callers: the turn end, the Cloud
	 * tab reads, and the agent backend tools.
	 */
	async touchActive(projectId: string): Promise<void> {
		await this.db
			.update(appBackends)
			.set({ lastActiveAt: new Date() })
			.where(
				and(
					eq(appBackends.projectId, projectId),
					eq(appBackends.status, "active"),
				),
			);
	}

	/**
	 * Moves an `active` row to `paused` and sets `pausedAt`, with a
	 * compare-and-set. Answers false when the row left `active` first. The
	 * pause sweep calls it after the Supabase pause call.
	 */
	async markPaused(projectId: string): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({ pausedAt: new Date(), status: "paused" })
			.where(
				and(
					eq(appBackends.projectId, projectId),
					eq(appBackends.status, "active"),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * Moves a `restoring` row back to `active` after Supabase reports
	 * `ACTIVE_HEALTHY`. Clears `pausedAt` and stamps activity: a wake is a
	 * user coming back. Answers false when the row left `restoring` first.
	 */
	async markRestored(projectId: string): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({ lastActiveAt: new Date(), pausedAt: null, status: "active" })
			.where(
				and(
					eq(appBackends.projectId, projectId),
					eq(appBackends.status, "restoring"),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * Moves a `restoring` row to `error` with the code
	 * `backend_restore_failed`, when Supabase reports `RESTORE_FAILED` or
	 * `REMOVED`. Without it the row stays `restoring` for ever.
	 */
	async markRestoreFailed(
		projectId: string,
		/** The Supabase project status that ended the restore. */
		providerStatus: "RESTORE_FAILED" | "REMOVED",
	): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({
				error: `Supabase reported ${providerStatus} during the restore`,
				failureCode: "backend_restore_failed",
				failureKind: "provider",
				failureProvider: "supabase",
				failureProviderMessage: providerStatus,
				failureRequestId: null,
				failureSource: "supabase_api",
				sentryEventId: null,
				status: "error",
			})
			.where(
				and(
					eq(appBackends.projectId, projectId),
					eq(appBackends.status, "restoring"),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * Moves the row of a deleted project to `deleting` and sets
	 * `deletingAt`; the grace window counts from it. Answers false when the
	 * row was already `deleting`, so a second delete keeps the first stamp.
	 */
	async markDeleting(projectId: string): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({ deletingAt: new Date(), status: "deleting" })
			.where(
				and(
					eq(appBackends.projectId, projectId),
					ne(appBackends.status, "deleting"),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * Records the Supabase delete: the row stays `deleting` and loses its
	 * ref. A `deleting` row without a ref is the terminal state. Answers
	 * false when the row no longer holds `ref`.
	 */
	async markDeleted(projectId: string, ref: string): Promise<boolean> {
		const rows = await this.db
			.update(appBackends)
			.set({ ref: null })
			.where(
				and(
					eq(appBackends.projectId, projectId),
					eq(appBackends.status, "deleting"),
					eq(appBackends.ref, ref),
				),
			)
			.returning({ id: appBackends.id });

		return rows.length > 0;
	}

	/**
	 * The rows the daily sweep acts on, all with a ref: `active` rows with no
	 * activity since `idleBefore`, every `restoring` and `deleting` row, and
	 * every row of a soft-deleted project. Without a ref no Supabase project
	 * exists to act on.
	 */
	async listLifecycleCandidates(
		/** The oldest idle cutoff of the run: now minus the shorter idle window. */
		idleBefore: Date,
	): Promise<BackendLifecycleRow[]> {
		// LIMIT: one query reads every candidate row. Upgrade: page by id when
		// the idle backends reach tens of thousands.
		const rows = await this.db
			.select({
				createdAt: appBackends.createdAt,
				deletingAt: appBackends.deletingAt,
				id: appBackends.id,
				lastActiveAt: appBackends.lastActiveAt,
				organizationId: appBackends.organizationId,
				projectDeletedAt: projects.deletedAt,
				projectId: appBackends.projectId,
				// `deployments` holds the live publish of V1 pages and, from
				// WANDIT-178, of V2 apps: at most one `active` row per project.
				// The predicate is one nested chunk: a bare column in a `sql`
				// template can lose its table name, and then matches any row.
				published: sql<boolean>`exists (select 1 from ${deployments} where ${and(
					eq(deployments.projectId, appBackends.projectId),
					eq(deployments.status, "active"),
				)})`,
				ref: appBackends.ref,
				status: appBackends.status,
			})
			.from(appBackends)
			// The FK cascades from `projects`, so the join drops no row.
			.innerJoin(projects, eq(projects.id, appBackends.projectId))
			.where(
				and(
					sql`${appBackends.ref} IS NOT NULL`,
					or(
						and(
							eq(appBackends.status, "active"),
							lt(
								sql`coalesce(${appBackends.lastActiveAt}, ${appBackends.createdAt})`,
								idleBefore,
							),
						),
						inArray(appBackends.status, ["restoring", "deleting"]),
						sql`${projects.deletedAt} IS NOT NULL`,
					),
				),
			);

		// The where clause drops null refs; the loop narrows the type for the caller.
		return rows.flatMap((row) =>
			row.ref === null ? [] : [{ ...row, ref: row.ref }],
		);
	}

	/**
	 * Counts the backends one owner holds: `creating`, `active`, `paused`,
	 * or `restoring`, on a project that is not soft-deleted. The plan
	 * entitlement check reads it. An org owner counts the org rows only.
	 */
	async countActiveForOwner(
		owner: CreditOwner,
		/** The pool, or the transaction of `insertCreatingWithinLimit`. */
		client: AppBackendsClient = this.db,
	): Promise<number> {
		// Same owner split as `SubscriptionsRepository.findActiveByOwner`: a
		// personal count must not see the rows of an org the user created.
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(appBackends.userId, owner.userId),
						isNull(appBackends.organizationId),
					)
				: eq(appBackends.organizationId, owner.organizationId);
		const [row] = await client
			.select({ total: sql<number>`count(*)::int` })
			.from(appBackends)
			// A backend of a deleted project never blocks a new one, also when its
			// row predates the `deleting` step.
			.innerJoin(
				projects,
				and(eq(projects.id, appBackends.projectId), isNull(projects.deletedAt)),
			)
			.where(and(ownerPredicate, inArray(appBackends.status, OWNED_STATUSES)));

		return row?.total ?? 0;
	}
}
