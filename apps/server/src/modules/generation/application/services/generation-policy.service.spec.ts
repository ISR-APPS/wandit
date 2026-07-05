import { HttpStatus } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";

import type { BillingService } from "../../../billing/application/services/billing.service";
import type { CreditsService } from "../../../credits/application/services/credits.service";
import { GenerationPaymentRequiredError } from "../../domain/errors/generation-payment-required.error";
import { GenerationPolicyService } from "./generation-policy.service";

class FakeBillingService {
	hasActiveSubscription = vi.fn<() => Promise<boolean>>();
}

class FakeCreditsService {
	getBalance =
		vi.fn<() => Promise<{ balance: number; plan: number; topup: number }>>();
}

function setBillingMode(mode: "enforce" | "off") {
	(
		env as { GENERATION_BILLING_MODE: "enforce" | "off" }
	).GENERATION_BILLING_MODE = mode;
}

function setup() {
	const billing = new FakeBillingService();
	const credits = new FakeCreditsService();
	const service = new GenerationPolicyService(
		billing as unknown as BillingService,
		credits as unknown as CreditsService,
	);

	return { billing, credits, service };
}

describe("GenerationPolicyService", () => {
	it("allows all generations when billing mode is off", async () => {
		setBillingMode("off");
		const { billing, credits, service } = setup();

		await expect(
			service.assertCanGenerate("user_1", "landingPageGeneration"),
		).resolves.toBeUndefined();
		expect(billing.hasActiveSubscription).not.toHaveBeenCalled();
		expect(credits.getBalance).not.toHaveBeenCalled();
	});

	it("allows users with an active subscription", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		billing.hasActiveSubscription.mockResolvedValue(true);
		credits.getBalance.mockResolvedValue({ balance: 0, plan: 0, topup: 0 });

		await expect(
			service.assertCanGenerate("user_1", "chatMessage"),
		).resolves.toBeUndefined();
	});

	it("allows users with enough credits", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		billing.hasActiveSubscription.mockResolvedValue(false);
		credits.getBalance.mockResolvedValue({ balance: 1, plan: 1, topup: 0 });

		await expect(
			service.assertCanGenerate("user_1", "chatMessage"),
		).resolves.toBeUndefined();
	});

	it("rejects users without a subscription or enough credits", async () => {
		setBillingMode("enforce");
		const { billing, credits, service } = setup();
		billing.hasActiveSubscription.mockResolvedValue(false);
		credits.getBalance.mockResolvedValue({ balance: 0, plan: 0, topup: 0 });

		await expect(
			service.assertCanGenerate("user_1", "chatMessage"),
		).rejects.toBeInstanceOf(GenerationPaymentRequiredError);

		try {
			await service.assertCanGenerate("user_1", "chatMessage");
		} catch (error) {
			expect((error as GenerationPaymentRequiredError).getStatus()).toBe(
				HttpStatus.PAYMENT_REQUIRED,
			);
		}
	});
});
