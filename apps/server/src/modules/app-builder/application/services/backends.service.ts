/**
 * Provisions the hidden Supabase backend of a new V2 project (D18).
 * `AppProjectsService.create` is the only caller: after the create
 * transaction, before the first turn. Writes the `app_backends` row
 * through `AppBackendsRepository` and hands off to the
 * `provision-backend` task through `ProvisionBackendTaskStarter`.
 * Picks the region with pickSupabaseRegion from the request country code.
 */
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { type SupabaseRegion, supabaseRegionSchema } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import {
	PROVISION_BACKEND_TASK_STARTER,
	type ProvisionBackendTaskStarter,
} from "../../domain/ports/provision-backend-task-starter";
import { pickSupabaseRegion } from "../../domain/supabase-region";
import { V2_ENV, type V2EnvSource } from "../../infrastructure/env/v2-env";
import {
	type AppBackendRow,
	AppBackendsRepository,
} from "../../infrastructure/persistence/app-backends.repository";

@Injectable()
export class BackendsService {
	private readonly logger = new Logger(BackendsService.name);

	constructor(
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<
			AppBackendsRepository,
			"findByProjectId" | "insertCreating" | "setTriggerRunId" | "markError"
		>,
		@Inject(PROVISION_BACKEND_TASK_STARTER)
		private readonly starter: ProvisionBackendTaskStarter,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	/**
	 * The single entry of backend provisioning, called once per project
	 * create. Answers the `app_backends` row; null means provisioning is
	 * not configured and nothing was written.
	 */
	async provisionBackend(
		projectId: string,
		input: {
			/** ISO country code of the create request; the region pick reads it. */
			countryCode: string | null;
			/** Creator of the project; lands on the `app_backends` row. */
			userId: string;
			/** Org workspace of the project; null for a personal scope. */
			organizationId: string | null;
		},
	): Promise<AppBackendRow | null> {
		// No platform token exists yet, so a missing key must not block
		// project creation: the project goes without a backend row.
		if (
			this.v2Env.SUPABASE_PLATFORM_TOKEN === undefined ||
			this.v2Env.SUPABASE_PLATFORM_ORG_ID === undefined
		) {
			this.logger.warn(
				`supabase.provisioning.unconfigured project=${projectId}`,
			);
			return null;
		}

		const existing = await this.backends.findByProjectId(projectId);
		if (existing !== null) {
			return existing;
		}

		let region: SupabaseRegion = pickSupabaseRegion(input.countryCode);
		const regionOverride = this.v2Env.SUPABASE_PLATFORM_REGION;
		if (regionOverride !== undefined) {
			// SUPABASE_PLATFORM_REGION is a manual override for a test or a
			// Supabase capacity problem; an invalid value keeps the picked region.
			const parsed = supabaseRegionSchema.safeParse(regionOverride);
			if (parsed.success) {
				region = parsed.data;
			} else {
				this.logger.warn(
					`supabase.provisioning.region-override-invalid project=${projectId} value=${regionOverride}`,
				);
			}
		}

		const inserted = await this.backends.insertCreating({
			organizationId: input.organizationId,
			projectId,
			region,
			requestKey: randomUUID(),
			userId: input.userId,
		});
		const row = inserted ?? (await this.backends.findByProjectId(projectId));
		if (row === null) {
			throw new Error(
				`app_backends insert returned no row for project ${projectId}`,
			);
		}
		if (inserted === null) {
			// The insert answered null: a concurrent create wrote the row first
			// and already queued its task, so this call starts nothing.
			return row;
		}

		try {
			const { runId } = await this.starter.start({
				projectId,
				requestKey: row.requestKey,
			});
			await this.backends.setTriggerRunId(projectId, runId);
		} catch (error) {
			// A start failure must not fail project creation: the project
			// exists and the user can work; the row carries the failure for
			// an operator to re-run.
			const message = getErrorMessage(error);
			this.logger.error(
				`supabase.provisioning.start-failed project=${projectId}: ${message}`,
			);
			await this.backends.markError(projectId, {
				error: message,
				failureCode: "backend_provision_start_failed",
				failureKind: "internal",
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: "task",
				sentryEventId: null,
			});
			return this.backends.findByProjectId(projectId);
		}

		return row;
	}
}
