import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { describe, expect, it } from "vitest";

import { BuilderStallError } from "../modules/pages/domain/build-failure";
import {
	classifyPageTaskFailure,
	pageFailurePersistenceValues,
} from "./generate-page-failure";

describe("page task failure persistence", () => {
	it("writes both the legacy page code and normalized failure columns", () => {
		const error = new GatewayRateLimitError({ generationId: "gen_page_1" });
		const classified = classifyPageTaskFailure(error, {
			model: "openai/gpt-5.2",
			route: "vercel",
		});
		const values = pageFailurePersistenceValues(
			classified.normalized,
			classified.failureCode,
		);

		expect(values).toMatchObject({
			error:
				"Our AI provider is experiencing high demand. Please try again in a few minutes.",
			failureCode: "provider_rate_limited",
			failureKind: "rate_limited",
			failureProvider: "openai",
			failureProviderMessage: null,
			failureRequestId: "gen_page_1",
			failureSource: "gateway",
		});
	});

	it("keeps a builder stall behind a page validation error", () => {
		// The production watchdog marks 180 seconds without progress as a stall.
		const stall = new BuilderStallError(180_000, "google/gemini-3.8-flash");
		const validation = new Error(
			"The builder finished without writing index.html",
			{ cause: stall },
		);
		validation.name = "PageValidationError";

		const classified = classifyPageTaskFailure(validation, {
			model: "google/gemini-3.8-flash",
			route: "vercel",
		});

		expect(classified).toMatchObject({
			failureCode: "provider_timeout",
			normalized: {
				kind: "timeout",
				provider: "google",
				providerLabel: "Google",
				source: "gateway",
			},
		});
		expect(
			pageFailurePersistenceValues(
				classified.normalized,
				classified.failureCode,
			).error,
		).toBe(
			"Our AI provider is experiencing high demand. Please try again in a few minutes.",
		);
	});

	it("keeps a network failure behind a page validation error", () => {
		const network = new TypeError("fetch failed", {
			cause: Object.assign(new Error("read ECONNRESET"), {
				code: "ECONNRESET",
			}),
		});
		const validation = new Error(
			"The builder finished without writing index.html",
			{ cause: network },
		);
		validation.name = "PageValidationError";

		const classified = classifyPageTaskFailure(validation, {
			model: "google/gemini-3.8-flash",
			route: "vercel",
		});

		expect(classified.normalized).toMatchObject({
			kind: "network",
			source: "gateway",
		});
	});
});
