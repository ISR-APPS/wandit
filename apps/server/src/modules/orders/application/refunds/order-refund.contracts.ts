const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ORDER_REFUND_FAILURE_REASON_MAX_LENGTH = 2_000;
export const ORDER_REFUND_RETRY_DELAY_SECONDS = 60;
export const REFUND_FAILURES_BEFORE_ESCALATION = 30;

export type OrderRefundPayload = {
	failureReason: string;
	orderId: string;
};

export type OrderRefundResult = {
	processed: boolean;
};

export type OrderRefundFailureContext = {
	attemptsMade: number;
	failureReason: string;
	lastError: string;
	orderId: string;
};

export interface DurableWait {
	for(input: { seconds: number }): Promise<void>;
}

export interface OrderRefundLogger {
	error(message: string, context: OrderRefundFailureContext): void;
}

export interface OrderRefundStepExecutor {
	execute(orderId: string, failureReason: string): Promise<boolean>;
}

/**
 * Validate the only payload shape accepted by the refund task. Keeping this
 * parser local lets schemaTask enforce the handoff without adding a direct
 * schema-library dependency to the server package.
 */
export function parseOrderRefundPayload(value: unknown): OrderRefundPayload {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError("Order refund payload must be an object");
	}

	const input = value as Record<string, unknown>;
	const keys = Object.keys(input).sort();

	if (
		keys.length !== 2 ||
		keys[0] !== "failureReason" ||
		keys[1] !== "orderId"
	) {
		throw new TypeError(
			"Order refund payload must contain only failureReason and orderId",
		);
	}

	if (typeof input.orderId !== "string" || !UUID_PATTERN.test(input.orderId)) {
		throw new TypeError("orderId must be a UUID");
	}

	if (
		typeof input.failureReason !== "string" ||
		input.failureReason.length === 0 ||
		input.failureReason.length > ORDER_REFUND_FAILURE_REASON_MAX_LENGTH
	) {
		throw new TypeError(
			`failureReason must contain between 1 and ${ORDER_REFUND_FAILURE_REASON_MAX_LENGTH} characters`,
		);
	}

	return {
		failureReason: input.failureReason,
		orderId: input.orderId,
	};
}
