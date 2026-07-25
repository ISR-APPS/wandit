import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import {
	ORDER_REFUNDS_QUEUE,
	type OrderRefundJobData,
	type OrderRefundJobName,
} from "@wandit/jobs";
import type { Job } from "bullmq";

import { OrderRefundExecutorService } from "../../../server/src/modules/orders/application/services/order-refund-executor.service";

// Refund jobs retry indefinitely (money must not be dropped), so a refund that
// keeps failing — bad Stripe key, missing payment intent — would otherwise loop
// silently forever. Escalate loudly once it has clearly stopped being transient.
const REFUND_FAILURES_BEFORE_ESCALATION = 30;

@Processor(ORDER_REFUNDS_QUEUE)
export class OrderRefundProcessor extends WorkerHost {
	private readonly logger = new Logger(OrderRefundProcessor.name);

	constructor(
		@Inject(OrderRefundExecutorService)
		private readonly refundExecutor: OrderRefundExecutorService,
	) {
		super();
	}

	async process(
		job: Job<OrderRefundJobData, unknown, OrderRefundJobName>,
	): Promise<{ processed: boolean }> {
		return {
			processed: await this.refundExecutor.execute(
				job.data.orderId,
				job.data.failureReason,
			),
		};
	}

	@OnWorkerEvent("failed")
	onFailed(
		job: Job<OrderRefundJobData, unknown, OrderRefundJobName> | undefined,
		error: Error,
	): void {
		if (!job) {
			return;
		}

		if (job.attemptsMade >= REFUND_FAILURES_BEFORE_ESCALATION) {
			this.logger.error(
				`MANUAL REVIEW REQUIRED: refund for payment order ${job.data.orderId} has failed ${job.attemptsMade} times and is still retrying`,
				JSON.stringify({
					attemptsMade: job.attemptsMade,
					failureReason: job.data.failureReason,
					lastError: error.message,
					orderId: job.data.orderId,
				}),
			);
		}
	}
}
