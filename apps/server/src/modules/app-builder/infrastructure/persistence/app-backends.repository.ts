/**
 * Read and write of the `app_backends` row of one project (D18).
 * `BackendsService` inserts the `creating` row and stores the
 * Trigger run id; the `provision-backend` runtime marks the row created,
 * active, or error. One project has at most one row: the unique index
 * `app_backends_projectId_uq` backs the rule.
 */
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import {
	type appBackendStatus,
	appBackends,
} from "@wandit/db/schema/app-backends";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

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
	 * Inserts the `creating` row of a new project. Answers null when the
	 * project already has a row: `onConflictDoNothing` on the `project_id`
	 * unique index makes a second insert a no-op.
	 */
	async insertCreating(input: {
		projectId: string;
		userId: string;
		organizationId: string | null;
		region: string;
		requestKey: string;
	}): Promise<AppBackendRow | null> {
		const [row] = await this.db
			.insert(appBackends)
			.values({
				projectId: input.projectId,
				userId: input.userId,
				organizationId: input.organizationId,
				region: input.region,
				requestKey: input.requestKey,
				status: "creating",
			})
			.onConflictDoNothing({ target: appBackends.projectId })
			.returning(APP_BACKEND_COLUMNS);

		return row ?? null;
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
	 * run.
	 */
	async markActive(
		projectId: string,
		input: { anonKey: string; dbHost: string; lastActiveAt: Date },
	): Promise<void> {
		await this.db
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
			.where(eq(appBackends.projectId, projectId));
	}

	/** Marks the backend failed and stores the eight failure columns. */
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
			.where(eq(appBackends.projectId, projectId));
	}
}
