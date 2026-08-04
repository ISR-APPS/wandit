import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { getPublishErrorMessage } from "./publish-error";

function apiError(code: string, message: string): ApiClientError {
	return new ApiClientError(
		{
			code,
			message,
			path: "/api/v1/deployments/publish",
			requestId: "request-1",
			statusCode: 403,
			timestamp: "2026-08-04T08:00:00.000Z",
		},
		{ hasServerEnvelopeMessage: true },
	);
}

describe("publish error message", () => {
	it("maps the early-access guard code to the distinct publish message", () => {
		const message =
			"Your account does not have early access yet. Publishing is limited to early-access users.";

		expect(
			getPublishErrorMessage(
				apiError("EARLY_ACCESS_REQUIRED", "Early access is required"),
				message,
			),
		).toBe(message);
	});

	it("keeps the existing API error mapping for other publish errors", () => {
		expect(
			getPublishErrorMessage(
				apiError("PUBLISH_FAILED", "The deployment failed"),
				"Early-access message",
			),
		).toBe("The deployment failed");
	});
});
