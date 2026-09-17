import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { redirectV2Project } from "./engine-redirect";

const PROJECT_ID = crypto.randomUUID();

function loadFails(statusCode: number): () => Promise<never> {
	return async () => {
		throw new ApiClientError({
			code: `HTTP_${statusCode}`,
			message: "The request failed.",
			path: `/api/v1/projects/${PROJECT_ID}`,
			requestId: "req-1",
			statusCode,
			timestamp: "2026-09-17T00:00:00.000Z",
		});
	};
}

describe("redirectV2Project", () => {
	it("throws the redirect to /app for a v2_app project", async () => {
		const call = redirectV2Project(PROJECT_ID, async () => ({
			engine: "v2_app",
		}));
		await expect(call).rejects.toSatisfy(isRedirect);
		await expect(call).rejects.toMatchObject({
			options: {
				to: "/app/$projectId",
				params: { projectId: PROJECT_ID },
				replace: true,
			},
		});
	});

	it("returns for a V1 project", async () => {
		await expect(
			redirectV2Project(PROJECT_ID, async () => ({ engine: "v1_page" })),
		).resolves.toBeUndefined();
	});

	it("returns on a 404, so V1 shows its not-found screen", async () => {
		await expect(
			redirectV2Project(PROJECT_ID, loadFails(404)),
		).resolves.toBeUndefined();
	});

	it("rethrows every other load failure", async () => {
		await expect(
			redirectV2Project(PROJECT_ID, loadFails(500)),
		).rejects.toMatchObject({ statusCode: 500 });
	});
});
