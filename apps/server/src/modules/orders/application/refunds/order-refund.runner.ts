import {
	type DurableWait,
	ORDER_REFUND_RETRY_DELAY_SECONDS,
	type OrderRefundErrorReporter,
	type OrderRefundLogger,
	type OrderRefundPayload,
	type OrderRefundResult,
	type OrderRefundStepExecutor,
	REFUND_FAILURES_BEFORE_ESCALATION,
} from "./order-refund.contracts";

export class OrderRefundRunner {
	constructor(
		private readonly refundStep: OrderRefundStepExecutor,
		private readonly durableWait: DurableWait,
		private readonly logger: OrderRefundLogger,
		private readonly reportError: OrderRefundErrorReporter,
	) {}

	async run(payload: OrderRefundPayload): Promise<OrderRefundResult> {
		let failures = 0;

		while (true) {
			try {
				return {
					processed: await this.refundStep.execute(
						payload.orderId,
						payload.failureReason,
					),
				};
			} catch (error) {
				failures += 1;

				// Failing refunds are money on the line, but they retry every minute
				// forever — capturing each attempt would burn 1,440 events/day per
				// broken refund. Report the first failure, the escalation threshold,
				// and an hourly heartbeat after that.
				if (
					failures <= 1 ||
					failures === REFUND_FAILURES_BEFORE_ESCALATION ||
					failures % 60 === 0
				) {
					this.reportError(error, {
						attempt: failures,
						orderId: payload.orderId,
					});
				}

				const context = {
					attemptsMade: failures,
					failureReason: payload.failureReason,
					lastError: errorMessage(error),
					orderId: payload.orderId,
				};
				const message =
					failures >= REFUND_FAILURES_BEFORE_ESCALATION
						? `MANUAL REVIEW REQUIRED: refund for payment order ${payload.orderId} has failed ${failures} times and is still retrying`
						: `Refund for payment order ${payload.orderId} failed and is retrying`;

				this.logger.error(message, context);
				await this.durableWait.for({
					seconds: ORDER_REFUND_RETRY_DELAY_SECONDS,
				});
			}
		}
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
