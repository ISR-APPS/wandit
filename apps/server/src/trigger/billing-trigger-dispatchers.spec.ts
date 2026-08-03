import { ServiceUnavailableException } from "@nestjs/common";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createKey: vi.fn(async () => "hashed-global-key"),
	trigger: vi.fn(async () => ({ id: "run_1" })),
}));

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: mocks.createKey },
	tasks: { trigger: mocks.trigger },
}));

import { TriggerAffiliateAttributionDispatcherService } from "../modules/affiliates/infrastructure/trigger/trigger-affiliate-attribution-dispatcher.service";
import { TriggerSignupGrantDispatcherService } from "../modules/auth/infrastructure/trigger/trigger-signup-grant-dispatcher.service";
import { TriggerBillingWebhookDispatcherService } from "../modules/billing/infrastructure/trigger/trigger-billing-webhook-dispatcher.service";

const originalTriggerSecret = process.env.TRIGGER_SECRET_KEY;

describe("billing Trigger dispatchers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.TRIGGER_SECRET_KEY = "tr_dev_test";
	});

	afterAll(() => {
		if (originalTriggerSecret === undefined) {
			delete process.env.TRIGGER_SECRET_KEY;
		} else {
			process.env.TRIGGER_SECRET_KEY = originalTriggerSecret;
		}
	});

	it("hashes user/source/token globally before affiliate attribution handoff", async () => {
		const dispatcher = new TriggerAffiliateAttributionDispatcherService();
		const payload = {
			source: "signup_cookie" as const,
			token: "signed-secret-token",
			userId: "user_1",
		};

		await dispatcher.triggerRetry(payload);

		expect(mocks.createKey).toHaveBeenCalledWith(
			[
				"affiliate-attribution",
				"user_1",
				"signup_cookie",
				"signed-secret-token",
			],
			{ scope: "global" },
		);
		expect(mocks.trigger).toHaveBeenCalledWith(
			"affiliate-attribution-retry",
			payload,
			{
				idempotencyKey: "hashed-global-key",
				tags: ["user:user_1"],
			},
		);
	});

	it("uses a once-per-user global key for signup grant delivery", async () => {
		await new TriggerSignupGrantDispatcherService().triggerDelivery("user_1");

		expect(mocks.createKey).toHaveBeenCalledWith("signup-grant:user_1", {
			scope: "global",
		});
		expect(mocks.trigger).toHaveBeenCalledWith(
			"signup-grant-outbox-delivery",
			{ userId: "user_1" },
			{
				idempotencyKey: "hashed-global-key",
				tags: ["user:user_1"],
			},
		);
	});

	it("scopes admin webhook retries to the durable event attempt", async () => {
		await new TriggerBillingWebhookDispatcherService().triggerRetry("evt_1", 7);

		expect(mocks.createKey).toHaveBeenCalledWith(
			"billing-webhook:evt_1:attempt:7",
			{ scope: "global" },
		);
		expect(mocks.trigger).toHaveBeenCalledWith(
			"billing-webhook-retry-event",
			{ eventId: "evt_1" },
			{
				idempotencyKey: "hashed-global-key",
				tags: ["billing-webhook:evt_1"],
			},
		);
	});

	it("fails before SDK calls when Trigger backend credentials are absent", async () => {
		delete process.env.TRIGGER_SECRET_KEY;

		await expect(
			new TriggerSignupGrantDispatcherService().triggerDelivery("user_1"),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(mocks.createKey).not.toHaveBeenCalled();
		expect(mocks.trigger).not.toHaveBeenCalled();
	});
});
