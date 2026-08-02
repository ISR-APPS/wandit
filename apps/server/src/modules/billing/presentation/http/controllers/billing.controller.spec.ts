import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { EarlyAccessGuard } from "../../../../auth";
import {
	SubscriptionsEnabledGuard,
	TopupsEnabledGuard,
} from "../../../../settings";
import { BillingController } from "./billing.controller";

function guardsFor(
	method: "change" | "checkout" | "previewChange" | "resume" | "topup",
): unknown[] {
	return (
		Reflect.getMetadata(GUARDS_METADATA, BillingController.prototype[method]) ??
		[]
	);
}

describe("BillingController admission guards", () => {
	it.each([
		"checkout",
		"previewChange",
		"change",
		"resume",
	] as const)("gates %s behind the subscriptions switch", (method) => {
		expect(guardsFor(method)).toEqual([
			SubscriptionsEnabledGuard,
			EarlyAccessGuard,
		]);
	});

	it("gates top-ups behind the top-ups switch", () => {
		expect(guardsFor("topup")).toEqual([TopupsEnabledGuard, EarlyAccessGuard]);
	});
});
