/**
 * Provisions the hidden Supabase backend of a new V2 project (D18).
 * `AppProjectsService.create` calls it after the create transaction, and
 * the Cloud route `POST backend` calls it for a project without a row.
 * It checks the plan entitlement (D3, WANDIT-184), writes the
 * `app_backends` row through `AppBackendsRepository`, and hands off to the
 * `provision-backend` task through `ProvisionBackendTaskStarter`.
 * Picks the region with pickSupabaseRegion from the request country code.
 */
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { type SupabaseRegion, supabaseRegionSchema } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import { resolveBillingPlan } from "../../../billing/application/services/resolve-billing-plan";
import { SubscriptionsRepository } from "../../../billing/infrastructure/persistence/subscriptions.repository";
import { subjectPayer } from "../../../credits/domain/credit-owner";
import { assertBackendEntitlement } from "../../domain/backend-lifecycle";
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

@Injectable()
export class BackendsService {
	private readonly logger = new Logger(BackendsService.name);

	constructor(
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<
			AppBackendsRepository,
			| "findByProjectId"
			| "insertCreatingWithinLimit"
			| "setTriggerRunId"
			| "markError"
		>,
		@Inject(PROVISION_BACKEND_TASK_STARTER)
		private readonly starter: ProvisionBackendTaskStarter,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
		/** The payer's subscription; the plan decides the backend limit. */
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: Pick<
			SubscriptionsRepository,
			"findActiveByOwner"
		>,
	) {}

	/**
	 * The single entry of backend provisioning: project create and the Cloud
	 * route `POST backend` call it. Answers the `app_backends` row; null means
	 * provisioning is not configured and nothing was written. Throws
	 * `BackendLimitReachedError` when the payer's plan has no free slot.
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

		// D3 product rule: the payer's plan caps the backends it holds. The
		// payer is the org of an org project, else the user.
		const subject = {
			actorUserId: input.userId,
			organizationId: input.organizationId,
		};
		const plan = await resolveBillingPlan(this.subscriptions, subject);

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

		// The count and the insert run under one lock per payer, so two
		// parallel creates cannot both pass the limit.
		const outcome = await this.backends.insertCreatingWithinLimit(
			{
				organizationId: input.organizationId,
				projectId,
				region,
				requestKey: randomUUID(),
				userId: input.userId,
			},
			subjectPayer(subject),
			(ownedBackends) => assertBackendEntitlement(plan, ownedBackends),
		);
		if (outcome.kind === "refused") {
			this.logger.warn(
				`supabase.provisioning.limit-reached project=${projectId} plan=${plan} limit=${outcome.refusal.limit}`,
			);
			throw new BackendLimitReachedError(
				outcome.refusal.plan,
				outcome.refusal.limit,
			);
		}
		const row = outcome.row;
		if (outcome.kind === "exists") {
			// A concurrent create wrote the row first and already queued its
			// task, so this call starts nothing.
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
