import type { Subscription } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { getBillingReturnCopy } from "./billing-return-copy";
import { subscriptionReturnStateFor } from "./subscription-return-state";

const subscription = {
	entitled: true,
	status: "active",
} as Subscription;

describe("subscription return state", () => {
	it("keeps entitled subscriptions on the successful return path", () => {
		const copy = getBillingReturnCopy("en");

		expect(subscriptionReturnStateFor(subscription, copy.subscription)).toEqual(
			{
				body: copy.subscription.updatedBody,
				needsPortal: false,
				title: copy.subscription.updatedTitle,
				tone: "success",
			},
		);
	});

	it.each([
		"past_due",
		"incomplete",
		"unpaid",
		"paused",
	])("routes a visible non-entitled %s subscription to payment repair", (status) => {
		const copy = getBillingReturnCopy("en");

		expect(
			subscriptionReturnStateFor(
				{ ...subscription, entitled: false, status },
				copy.subscription,
			),
		).toEqual({
			body: copy.subscription.paymentAttentionBody,
			needsPortal: true,
			title: copy.subscription.paymentAttentionTitle,
			tone: "warning",
		});
	});
});
