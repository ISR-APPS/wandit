import type { PaymentOrder } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { getBillingReturnCopy } from "./billing-return-copy";
import {
	isOrderLifecycleTerminal,
	orderReturnStateFor,
	type RefundAwarePaymentOrder,
	shouldPollOrder,
} from "./order-return-state";

const copy = getBillingReturnCopy("en").order;

function order(
	status: PaymentOrder["status"],
	refundStatus: string | null = null,
	paidAt: string | null = null,
): RefundAwarePaymentOrder {
	return {
		amountCents: 3_000,
		createdAt: "2026-07-24T12:00:00.000Z",
		currency: "usd",
		error: null,
		fulfilledAt: null,
		id: "11111111-1111-4111-8111-111111111111",
		kind: "domain_registration",
		paidAt,
		refundStatus,
		status,
	};
}

describe("order return state", () => {
	it("treats an unpaid async payment failure as terminal without promising a refund", () => {
		const failed = order("failed");

		expect(isOrderLifecycleTerminal(failed.status)).toBe(true);
		expect(shouldPollOrder(failed)).toBe(false);
		expect(orderReturnStateFor(failed, copy)).toEqual({
			body: copy.failedBody,
			title: copy.failedTitle,
			tone: "error",
		});
	});

	it("keeps polling a captured failure while the durable refund worker attaches its status", () => {
		const failed = order("failed", null, "2026-07-24T12:01:00.000Z");

		expect(isOrderLifecycleTerminal(failed.status)).toBe(true);
		expect(shouldPollOrder(failed)).toBe(true);
		expect(orderReturnStateFor(failed, copy)).toEqual({
			body: copy.refundPendingBody,
			title: copy.refundPendingTitle,
			tone: "warning",
		});
	});

	it.each([
		"pending",
		"requires_action",
		"refund_pending",
	])("surfaces and continues polling a %s refund without using timeout copy", (refundStatus) => {
		const failed = order("failed", refundStatus);

		expect(isOrderLifecycleTerminal(failed.status)).toBe(true);
		expect(shouldPollOrder(failed)).toBe(true);
		expect(orderReturnStateFor(failed, copy)).toEqual({
			body: copy.refundPendingBody,
			title: copy.refundPendingTitle,
			tone: "warning",
		});
	});

	it.each([
		"failed",
		"canceled",
		"partial",
	])("surfaces a %s refund as needing attention", (refundStatus) => {
		const failed = order("failed", refundStatus);

		expect(shouldPollOrder(failed)).toBe(false);
		expect(orderReturnStateFor(failed, copy)).toEqual({
			body: copy.refundProblemBody,
			title: copy.refundProblemTitle,
			tone: "error",
		});
	});

	it("keeps pending fulfillment polling and stops for canceled orders", () => {
		expect(isOrderLifecycleTerminal("pending")).toBe(false);
		expect(shouldPollOrder(order("pending"))).toBe(true);
		expect(isOrderLifecycleTerminal("canceled")).toBe(true);
		expect(shouldPollOrder(order("canceled"))).toBe(false);
	});
});
