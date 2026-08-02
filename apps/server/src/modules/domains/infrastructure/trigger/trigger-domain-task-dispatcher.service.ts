import { Injectable } from "@nestjs/common";
import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";

import type { domainConfigurationTask } from "../../../../trigger/domain-configuration.task";
import type { domainPurchaseTask } from "../../../../trigger/domain-purchase.task";
import type {
	DomainConfigurationPayload,
	DomainPurchasePayload,
} from "../../application/fulfillment/domain-fulfillment.contracts";
import { DomainsUnavailableError } from "../../domain/errors/domain.errors";
import type {
	DomainTaskDispatcher,
	DomainTaskHandle,
} from "../../domain/ports/domain-task-dispatcher.port";

const DOMAIN_PURCHASE_TASK_ID = "domain-purchase";
const DOMAIN_CONFIGURATION_TASK_ID = "domain-configure";
const RESETTABLE_PURCHASE_STATUSES = new Set(["CANCELED", "COMPLETED"]);

/** Trigger-context handoff: the SDK supplies task-run authentication. */
export async function triggerDomainPurchaseTask(
	payload: DomainPurchasePayload,
): Promise<DomainTaskHandle> {
	const idempotencyKey = await purchaseKey(payload.orderId);

	return triggerPurchaseWithKey(payload, idempotencyKey);
}

/** Trigger-context handoff: the SDK supplies task-run authentication. */
export async function triggerDomainConfigurationTask(
	payload: DomainConfigurationPayload,
): Promise<DomainTaskHandle> {
	const idempotencyKey = await idempotencyKeys.create(
		`domain-configure:${payload.domainId}:${payload.nonce}`,
		{ scope: "global" },
	);

	return tasks.trigger<typeof domainConfigurationTask>(
		DOMAIN_CONFIGURATION_TASK_ID,
		payload,
		{
			idempotencyKey,
			tags: [`domain:${payload.domainId}`],
		},
	);
}

/**
 * Trigger-context recovery, called only after a DB-backed reconciler has
 * selected a stale row. It never resets a live or failed run.
 */
export async function recoverDomainPurchaseTask(
	payload: DomainPurchasePayload,
): Promise<DomainTaskHandle> {
	const idempotencyKey = await purchaseKey(payload.orderId);
	const handle = await triggerPurchaseWithKey(payload, idempotencyKey);
	const run = await runs.retrieve(handle.id);

	// Failed runs release their key automatically in Trigger.dev 4.5.3.
	// Live runs must never be disturbed. Only a canceled run, or a run that
	// completed while the stale DB row still needs healing, retains a key we
	// are allowed to reset from the reconciler path.
	if (!RESETTABLE_PURCHASE_STATUSES.has(run.status)) {
		return handle;
	}

	await idempotencyKeys.reset(DOMAIN_PURCHASE_TASK_ID, idempotencyKey);

	return triggerPurchaseWithKey(payload, idempotencyKey);
}

@Injectable()
export class TriggerDomainTaskDispatcherService
	implements DomainTaskDispatcher
{
	assertAvailable(): void {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			throw new DomainsUnavailableError();
		}
	}

	async triggerPurchase(
		payload: DomainPurchasePayload,
	): Promise<DomainTaskHandle> {
		this.assertAvailable();

		return triggerDomainPurchaseTask(payload);
	}

	async triggerConfiguration(
		payload: DomainConfigurationPayload,
	): Promise<DomainTaskHandle> {
		this.assertAvailable();

		return triggerDomainConfigurationTask(payload);
	}

	async recoverPurchase(
		payload: DomainPurchasePayload,
	): Promise<DomainTaskHandle> {
		this.assertAvailable();

		return recoverDomainPurchaseTask(payload);
	}
}

function purchaseKey(orderId: string) {
	return idempotencyKeys.create(`domain-purchase:${orderId}`, {
		scope: "global",
	});
}

function triggerPurchaseWithKey(
	payload: DomainPurchasePayload,
	idempotencyKey: Awaited<ReturnType<typeof idempotencyKeys.create>>,
): Promise<DomainTaskHandle> {
	return tasks.trigger<typeof domainPurchaseTask>(
		DOMAIN_PURCHASE_TASK_ID,
		payload,
		{
			idempotencyKey,
			tags: [`domain:${payload.domainId}`, `order:${payload.orderId}`],
		},
	);
}
