import type { ArgumentsHost } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../modules/credits/domain/errors/insufficient-credits.error";
import { GenerationPaymentRequiredError } from "../../modules/generation/domain/errors/generation-payment-required.error";
import { ApiExceptionFilter } from "./api-exception.filter";

function setupHost() {
	const send = vi.fn();
	const reply = {
		send,
		sent: false,
		status: vi.fn().mockReturnThis(),
	};
	const request = {
		id: "req_402",
		method: "POST",
		url: "/api/v1/generations",
	};
	const host = {
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => reply,
		}),
	} as unknown as ArgumentsHost;

	return { host, reply, send };
}

describe("ApiExceptionFilter payment-required details", () => {
	it.each([
		// Constructed with centi-credits; details expose decimal credits.
		new InsufficientCreditsError(2500, 400),
		new GenerationPaymentRequiredError(25, 4),
	])("emits typed 402 details for %s", (exception) => {
		const { host, reply, send } = setupHost();

		new ApiExceptionFilter().catch(exception, host);

		expect(reply.status).toHaveBeenCalledWith(402);
		expect(send).toHaveBeenCalledWith({
			error: expect.objectContaining({
				code: expect.any(String),
				details: {
					availableCredits: 4,
					requiredCredits: 25,
				},
				statusCode: 402,
			}),
		});
	});
});
