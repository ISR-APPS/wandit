import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { describe, expect, it } from "vitest";

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
			error: "OpenAI is busy. Please wait a moment and try again.",
			failureCode: "provider_rate_limited",
			failureKind: "rate_limited",
			failureProvider: "openai",
			failureProviderMessage: null,
			failureRequestId: "gen_page_1",
			failureSource: "gateway",
		});
	});
});
