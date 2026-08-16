import { describe, expect, it } from "vitest";

import { sanitizeConnectorOperationError } from "./connector-operation-error";

describe("sanitizeConnectorOperationError", () => {
	it("keeps a safe provider code while redacting credentials and PII", () => {
		const error = Object.assign(
			new Error(
				"Bearer raw-token for owner@example.com at https://provider.test/path?access_token=secret",
			),
			{ code: "PROVIDER_REJECTED" },
		);

		expect(sanitizeConnectorOperationError(error)).toEqual({
			errorCode: "PROVIDER_REJECTED",
			errorMessage: "Provider tool execution failed",
		});
	});

	it("does not persist arbitrary MCP payload text", () => {
		const sanitized = sanitizeConnectorOperationError({
			content: [
				{
					text: `Request failed for api_key=token-12345678901234567890 ${"provider failure ".repeat(60)}`,
					type: "text",
				},
			],
			isError: true,
			privateRequestArguments: { customerEmail: "customer@example.com" },
		});

		expect(sanitized.errorCode).toBeNull();
		expect(sanitized.errorMessage.length).toBeLessThanOrEqual(500);
		expect(sanitized.errorMessage).toBe("Provider tool execution failed");
		expect(sanitized.errorMessage).not.toContain("token-123");
		expect(sanitized.errorMessage).not.toContain("customer@example.com");
	});

	it("rejects token-shaped provider values from the error-code column", () => {
		const sanitized = sanitizeConnectorOperationError({
			code: "sk-live_123456789012345678901234567890",
			message: "Provider rejected the request",
		});

		expect(sanitized).toEqual({
			errorCode: null,
			errorMessage: "Provider tool execution failed",
		});
	});

	it("drops arbitrary names, addresses, and short unlabeled credentials", () => {
		expect(
			sanitizeConnectorOperationError({
				code: "JANE_SMITH",
				message:
					"Customer Jane Smith at 14 Main Street supplied secret abc-123-short",
			}),
		).toEqual({
			errorCode: null,
			errorMessage: "Provider tool execution failed",
		});
	});

	it("stays non-throwing when provider fields use hostile getters", () => {
		const providerError = Object.defineProperty({}, "code", {
			get() {
				throw new Error("hostile getter");
			},
		});

		expect(() => sanitizeConnectorOperationError(providerError)).not.toThrow();
		expect(sanitizeConnectorOperationError(providerError)).toEqual({
			errorCode: null,
			errorMessage: "Provider tool execution failed",
		});
	});
});
