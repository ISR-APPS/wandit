import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";

import type { orderRefundTask } from "../../../../trigger/order-refund.task";
import type { OrderRefundPayload } from "../../application/refunds/order-refund.contracts";
import type {
	OrderRefundDispatcher,
	OrderRefundTaskHandle,
} from "../../domain/ports/order-refund-dispatcher.port";

const ORDER_REFUND_TASK_ID = "order-refund";

/** Trigger-context handoff: the SDK supplies task-run authentication. */
export async function triggerOrderRefundTask(
	payload: OrderRefundPayload,
): Promise<OrderRefundTaskHandle> {
	const idempotencyKey = await refundKey(payload.orderId);

	return triggerRefundWithKey(payload, idempotencyKey);
}

/**
 * Trigger-context recovery, called only after the DB reconciler has rechecked
 * refund eligibility. It never resets live, completed, or failed runs.
 */
export async function recoverOrderRefundTask(
	payload: OrderRefundPayload,
): Promise<OrderRefundTaskHandle> {
	const idempotencyKey = await refundKey(payload.orderId);
	const handle = await triggerRefundWithKey(payload, idempotencyKey);
	const run = await runs.retrieve(handle.id);

	// Trigger.dev clears failed-run keys itself. Completed refunds are not
	// reset: their persisted provider state is authoritative.
	if (run.status !== "CANCELED") {
		return handle;
	}

	await idempotencyKeys.reset(ORDER_REFUND_TASK_ID, idempotencyKey);

	return triggerRefundWithKey(payload, idempotencyKey);
}

@Injectable()
export class TriggerOrderRefundDispatcherService
	implements OrderRefundDispatcher
{
	assertAvailable(): void {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			throw new ServiceUnavailableException(
				"Payment refund task is temporarily unavailable",
			);
		}
	}

	async triggerRefund(
		payload: OrderRefundPayload,
	): Promise<OrderRefundTaskHandle> {
		this.assertAvailable();

		return triggerOrderRefundTask(payload);
	}

	async recoverRefund(
		payload: OrderRefundPayload,
	): Promise<OrderRefundTaskHandle> {
		this.assertAvailable();

		return recoverOrderRefundTask(payload);
	}
}

function refundKey(orderId: string) {
	return idempotencyKeys.create(`order-refund:${orderId}`, {
		scope: "global",
	});
}

function triggerRefundWithKey(
	payload: OrderRefundPayload,
	idempotencyKey: Awaited<ReturnType<typeof idempotencyKeys.create>>,
): Promise<OrderRefundTaskHandle> {
	return tasks.trigger<typeof orderRefundTask>(ORDER_REFUND_TASK_ID, payload, {
		idempotencyKey,
		tags: [`order:${payload.orderId}`],
	});
}
