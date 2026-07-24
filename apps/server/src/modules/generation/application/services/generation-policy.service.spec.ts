/**
 * Tests for the "can this user generate?" gate.
 *
 * If this service throws, the app should not save a message or enqueue a job.
 */
import { HttpStatus } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";

import type { BillingService } from "../../../billing/application/services/billing.service";
import type { CreditsService } from "../../../credits/application/services/credits.service";
import { GenerationPaymentRequiredError } from "../../domain/errors/generation-payment-required.error";
import { GenerationPolicyService } from "./generation-policy.service";

// Fake billing dependency.
class FakeBillingService {
	hasActiveSubscription = vi.fn<() => Promise<boolean>>();
}

// Fake credits dependency.
class FakeCreditsService {
	getBalance =
		vi.fn<() => Promise<{ balance: number; plan: number; topup: number }>>();
}

// Tests change the env flag directly because env is a shared object.
function setBillingMode(mode: "enforce" | "off") {
	(
		env as { GENERATION_BILLING_MODE: "enforce" | "off" }
	).GENERATION_BILLING_MODE = mode;
}

// Build service with fakes.
function setup() {
	const billing = new FakeBillingService();
	const credits = new FakeCreditsService();
	const service = new GenerationPolicyService(
		billing as unknown as BillingService,
		credits as unknown as CreditsService,
	);

	return { billing, credits, service };
}

// Test the generation permission rules.
describe("GenerationPolicyService", () => {
	// Local/dev mode can bypass billing.
	it("allows all generations when billing mode is off", async () => {
		setBillingMode("off");
		const { billing, credits, service } = setup();

		await expect(
			service.assertCanGenerate("user_1", "landingPageGeneration"),
		).resolves.toBeUndefined();
		expect(billing.hasActiveSubscription).not.toHaveBeenCalled();
		expect(credits.getBalance).not.toHaveBeenCalled();
	});

	// Active subscription is enough.
	it("allows users with an active subscription", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		billing.hasActiveSubscription.mockResolvedValue(true);
		credits.getBalance.mockResolvedValue({ balance: 0, plan: 0, topup: 0 });

		await expect(
			service.assertCanGenerate("user_1", "chatMessage"),
		).resolves.toBeUndefined();
	});

	// Without subscription, enough credits is enough.
	it("allows users with enough credits", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		billing.hasActiveSubscription.mockResolvedValue(false);
		credits.getBalance.mockResolvedValue({ balance: 1, plan: 1, topup: 0 });

		await expect(
			service.assertCanGenerate("user_1", "chatMessage"),
		).resolves.toBeUndefined();
	});

	it("requires credits when a past_due subscription is not entitled", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		// BillingService maps `past_due` to false; the generation policy must then
		// use the normal credit gate instead of treating dunning as entitlement.
		billing.hasActiveSubscription.mockResolvedValue(false);
		credits.getBalance.mockResolvedValue({ balance: 0, plan: 0, topup: 0 });

		await expect(
			service.assertCanGenerate("user_past_due", "chatMessage"),
		).rejects.toBeInstanceOf(GenerationPaymentRequiredError);
		expect(billing.hasActiveSubscription).toHaveBeenCalledWith("user_past_due");
	});

	// No subscription and not enough credits should throw 402.
	it("rejects users without a subscription or enough credits", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		billing.hasActiveSubscription.mockResolvedValue(false);
		credits.getBalance.mockResolvedValue({ balance: 0, plan: 0, topup: 0 });

		await expect(
			service.assertCanGenerate("user_1", "chatMessage"),
		).rejects.toBeInstanceOf(GenerationPaymentRequiredError);

		// Check the HTTP status on the actual error object.
		try {
			await service.assertCanGenerate("user_1", "chatMessage");
		} catch (error) {
			expect((error as GenerationPaymentRequiredError).getStatus()).toBe(
				HttpStatus.PAYMENT_REQUIRED,
			);
		}
	});
});
