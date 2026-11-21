/**
 * Provisions the hidden Supabase backend of a new V2 project (D18).
 * A desktop project never gets one: it keeps its data in a local SQLite file.
 * `AppProjectsService.create` calls it after the create transaction.
 * The Cloud route `POST backend` also calls it.
 * `TurnsService.create` calls it for each new chat message.
 * Both provision a missing row or a failed (`error`) row again.
 * It checks the paid-owner backend limit (D3, pricing v8 section 6), writes the
 * `app_backends` row through `AppBackendsRepository`, and hands off to the
 * `provision-backend` task through `ProvisionBackendTaskStarter`.
 * Picks the region with pickSupabaseRegion from the request country code.
 */
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { type SupabaseRegion, supabaseRegionSchema } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import { PaidOwnerRepository } from "../../../billing/infrastructure/persistence/paid-owner.repository";
import { subjectPayer } from "../../../credits/domain/credit-owner";
import {
	assertBackendEntitlement,
	backendLimitFor,
} from "../../domain/backend-lifecycle";
import { BackendLimitReachedError } from "../../domain/errors/backend-limit-reached.error";
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
import { TurnProjectRepository } from "../../infrastructure/persistence/turn-project.repository";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";

@Injectable()
export class BackendsService {
	private readonly logger = new Logger(BackendsService.name);

	constructor(
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<
			AppBackendsRepository,
			| "findByProjectId"
			| "writeCreatingWithinLimit"
			| "setTriggerRunId"
			| "markError"
		>,
		@Inject(PROVISION_BACKEND_TASK_STARTER)
		private readonly starter: ProvisionBackendTaskStarter,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		/** Decides if the payer is a paid owner; that decides the backend limit. */
		@Inject(PaidOwnerRepository)
		private readonly paidOwners: Pick<PaidOwnerRepository, "isPaidOwner">,
		/** Reads the template of the project: a desktop app gets no backend. */
		@Inject(TurnProjectRepository)
		private readonly projects: Pick<TurnProjectRepository, "findForTurn">,
	) {}

	/**
	 * The single entry of backend provisioning: project create, the Cloud
	 * route `POST backend`, and each new chat message call it. An `error`
	 * row gets a new run; any other row comes back as it is. Answers the
	 * `app_backends` row; null means provisioning is not configured, or the
	 * project is a desktop app, and nothing was written. Throws
	 * `BackendLimitReachedError` when the payer has no free backend slot.
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

		// Product rule: a desktop app keeps its data in a local SQLite file. A backend
		// would take a plan slot and a Supabase project that the app never reaches.
		const project = await this.projects.findForTurn(projectId);
		if (project?.framework === TEMPLATE_PROFILES.desktop.framework) {
			return null;
		}

		// Only a failed row needs the locked write: it provisions again.
		const existing = await this.backends.findByProjectId(projectId);
		if (existing !== null && existing.status !== "error") {
			return existing;
		}

		// Product rule (spec section 6): a free owner gets no backend, a paid owner
		// gets 1 (personal) or 1000 (team). The payer is the org of an org project, else the user.
		// The read before the lock is safe: a paid owner never becomes free again.
		const payer = subjectPayer({
			actorUserId: input.userId,
			organizationId: input.organizationId,
		});
		const limit = backendLimitFor(
			await this.paidOwners.isPaidOwner(payer),
			payer,
		);

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

		// The count and the write run under one lock per payer, so two
		// parallel creates cannot both pass the limit, and two retries of one
		// `error` row cannot both start a run.
		const outcome = await this.backends.writeCreatingWithinLimit(
			{
				organizationId: input.organizationId,
				projectId,
				region,
				requestKey: randomUUID(),
				userId: input.userId,
			},
			payer,
			(ownedBackends) =>
				// BACKEND_LIMIT_OFF is a staging and local test switch: testers get backends with no limit.
				this.v2Env.BACKEND_LIMIT_OFF === true
					? { allowed: true }
					: assertBackendEntitlement(limit, ownedBackends),
		);
		if (outcome.kind === "refused") {
			this.logger.warn(
				`supabase.provisioning.limit-reached project=${projectId} payer=${payer.type} limit=${outcome.refusal.limit}`,
			);
			throw new BackendLimitReachedError(outcome.refusal.limit, payer.type);
		}
		const row = outcome.row;
		if (outcome.kind === "exists") {
			// A concurrent create or retry wrote the row first and already
			// queued its task, so this call starts nothing.
			return row;
		}

		let runId: string;
		try {
			({ runId } = await this.starter.start({
				projectId,
				requestKey: row.requestKey,
			}));
		} catch (error) {
			// A start failure must not fail project creation: the project
			// exists and the user can work; the row carries the failure for
			// an operator to re-run.
			const message = getErrorMessage(error);
			this.logger.error(
				`supabase.provisioning.start-failed project=${projectId}: ${message}`,
			);
			await this.backends.markError(projectId, row.requestKey, {
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

		// The run id is a trace field. A failed write must not fail a run
		// that Trigger accepted, so the error only goes to the log.
		try {
			await this.backends.setTriggerRunId(projectId, runId);
		} catch (error) {
			this.logger.error(
				`supabase.provisioning.run-id-write-failed project=${projectId} run=${runId}: ${getErrorMessage(error)}`,
			);
		}

		return row;
	}
}
