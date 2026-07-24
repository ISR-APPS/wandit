import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import {
	ORDER_REFUNDS_QUEUE,
	type OrderRefundJobData,
	type OrderRefundJobName,
} from "@wandit/jobs";
import type { Job } from "bullmq";

import { OrderRefundExecutorService } from "../../../server/src/modules/orders/application/services/order-refund-executor.service";

@Processor(ORDER_REFUNDS_QUEUE)
export class OrderRefundProcessor extends WorkerHost {
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
}
