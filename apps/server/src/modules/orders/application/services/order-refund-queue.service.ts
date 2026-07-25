import { InjectQueue } from "@nestjs/bullmq";
import {
	Injectable,
	Optional,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	ORDER_REFUNDS_QUEUE,
	type OrderRefundJobData,
	type OrderRefundJobName,
} from "@wandit/jobs";
import type { Queue } from "bullmq";

const REFUND_JOB_ATTEMPTS = Number.MAX_SAFE_INTEGER;
const REFUND_JOB_BACKOFF_MS = 60_000;

@Injectable()
export class OrderRefundQueueService {
	constructor(
		@Optional()
		@InjectQueue(ORDER_REFUNDS_QUEUE)
		private readonly refundQueue?: Queue<
			OrderRefundJobData,
			unknown,
			OrderRefundJobName
		>,
	) {}

	async enqueue(orderId: string, failureReason: string): Promise<void> {
		if (!this.refundQueue) {
			throw new ServiceUnavailableException(
				"Payment refund queue is temporarily unavailable",
			);
		}

		await this.refundQueue.add(
			"order-refund",
			{
				failureReason,
				orderId,
			},
			{
				attempts: REFUND_JOB_ATTEMPTS,
				backoff: {
					delay: REFUND_JOB_BACKOFF_MS,
					type: "fixed",
				},
				jobId: `order-refund-${orderId}`,
			},
		);
	}
}
