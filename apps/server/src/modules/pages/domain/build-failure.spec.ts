import { describe, expect, it } from "vitest";

import { classifyBuildFailure, TaggedBuildError } from "./build-failure";

/** Minimal stand-in for an AI SDK provider error (AI_-prefixed name). */
function providerError(overrides: Record<string, unknown> = {}): Error {
	const error = new Error("Provider call failed");
	Object.assign(error, { name: "AI_APICallError", ...overrides });

	return error;
}

describe("classifyBuildFailure", () => {
	it("maps a provider 429 to provider_rate_limited", () => {
		expect(classifyBuildFailure(providerError({ statusCode: 429 }))).toBe(
			"provider_rate_limited",
		);
	});

	it("maps 503/529 to provider_overloaded", () => {
		expect(classifyBuildFailure(providerError({ statusCode: 503 }))).toBe(
			"provider_overloaded",
		);
		expect(classifyBuildFailure(providerError({ statusCode: 529 }))).toBe(
			"provider_overloaded",
		);
	});

	it("reads 'Overloaded' provider messages even without a status code", () => {
		const error = providerError();
		error.message = "Overloaded: the model is at capacity";

		expect(classifyBuildFailure(error)).toBe("provider_overloaded");
	});

	it("maps provider timeouts to provider_timeout", () => {
		const error = providerError();
		error.message = "Headers Timeout Error (UND_ERR_HEADERS_TIMEOUT)";

		expect(classifyBuildFailure(error)).toBe("provider_timeout");
	});

	it("maps any other provider-call failure to provider_error", () => {
		expect(classifyBuildFailure(providerError({ statusCode: 500 }))).toBe(
			"provider_error",
		);
		expect(classifyBuildFailure(providerError())).toBe("provider_error");
	});

	it("finds the provider cause buried under a RetryError wrapper", () => {
		const retryError = new Error("Failed after 3 attempts");
		Object.assign(retryError, {
			name: "AI_RetryError",
			lastError: providerError({ statusCode: 429 }),
			errors: [providerError({ statusCode: 429 })],
		});

		expect(classifyBuildFailure(retryError)).toBe("provider_rate_limited");
	});

	it("blames the provider when a validation error carries a provider cause", () => {
		// The exact shape site-builder-agent produces: assertValidSite threw
		// because the stream died mid-write, and the stream error rides along.
		const validation = new Error(
			"The builder finished without writing index.html — nothing to publish",
		);
		validation.name = "PageValidationError";
		validation.cause = providerError({ statusCode: 429 });

		expect(classifyBuildFailure(validation)).toBe("provider_rate_limited");
	});

	it("maps a causeless validation error to invalid_output", () => {
		const validation = new Error("index.html does not end with </html>");
		validation.name = "PageValidationError";

		expect(classifyBuildFailure(validation)).toBe("invalid_output");
	});

	it("recognizes the metering credit rejections before status codes", () => {
		// InsufficientCreditsError is an HttpException with statusCode 402 —
		// the message match must win over any provider-status reading.
		const credits = new Error("Insufficient credits: required 10, available 1");
		Object.assign(credits, { status: 402 });

		expect(classifyBuildFailure(credits)).toBe("insufficient_credits");

		const memberLimit = new Error(
			"Workspace member credit limit reached: limit 100, spent 95, required 10",
		);
		Object.assign(memberLimit, { status: 403 });

		expect(classifyBuildFailure(memberLimit)).toBe("member_limit");
	});

	it("classifies a PROVIDER's own credits 402 as provider_error, not the wallet", () => {
		// OpenRouter's documented 402 body — this is OUR account with THEM,
		// never the user's Wandit wallet. A wallet card here would send the
		// user to top up for a failure they cannot fix.
		const error = providerError({ statusCode: 402 });
		error.message =
			"Insufficient credits. Add more using https://openrouter.ai/settings/credits";

		expect(classifyBuildFailure(error)).toBe("provider_error");
	});

	it("honors phase-tagged errors (storage) and keeps their cause reachable", () => {
		const s3Error = new Error("connect ECONNREFUSED");
		const tagged = new TaggedBuildError(
			"Uploading the finished page to storage failed",
			"storage_failure",
			s3Error,
		);

		expect(classifyBuildFailure(tagged)).toBe("storage_failure");
		expect(tagged.cause).toBe(s3Error);
	});

	it("lets a provider signal under a tagged error win over the tag", () => {
		const tagged = new TaggedBuildError(
			"Uploading failed",
			"storage_failure",
			providerError({ statusCode: 429 }),
		);

		expect(classifyBuildFailure(tagged)).toBe("provider_rate_limited");
	});

	it("falls back to internal_error for anything unrecognized", () => {
		expect(classifyBuildFailure(new Error("boom"))).toBe("internal_error");
		expect(classifyBuildFailure("string failure")).toBe("internal_error");
		expect(classifyBuildFailure(undefined)).toBe("internal_error");
	});

	it("survives circular cause chains", () => {
		const a = new Error("a");
		const b = new Error("b");
		a.cause = b;
		b.cause = a;

		expect(classifyBuildFailure(a)).toBe("internal_error");
	});
});
