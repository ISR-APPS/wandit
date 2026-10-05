import type { AppBuild, AppPublishStatus } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { apiClient } from "@/lib/api-client";
import {
	getAppPublishStatus,
	publishApp,
	rollbackApp,
	unpublishApp,
} from "./publish.services";

const PROJECT_ID = crypto.randomUUID();
const BASE = `/api/v2/projects/${PROJECT_ID}/publish`;

/** One recorded request of a fake client method. */
type Call = {
	url: string;
	body?: { requestKey: string; deploymentId?: string };
};

/** A client method that answers the raw `answer` and records each URL and body. */
function answers<
	T extends
		| typeof apiClient.get
		| typeof apiClient.post
		| typeof apiClient.delete,
>(answer: unknown, calls: Call[] = []): T {
	// SAFETY: the fake answers the one request of a case, and the service
	// parses the answer with its contracts schema.
	return (async (url: string, body?: Call["body"]) => {
		calls.push(body === undefined ? { url } : { url, body });
		return answer;
	}) as T;
}

const QUEUED: AppBuild = {
	id: crypto.randomUUID(),
	projectId: PROJECT_ID,
	status: "queued",
	commitSha: "a".repeat(40),
	sourceBuildId: null,
	errorCode: null,
	createdAt: "2026-10-01T10:00:00.000Z",
	completedAt: null,
	gateFindings: [],
	gateOverride: false,
};

const STATUS: AppPublishStatus = {
	live: null,
	latestBuild: QUEUED,
	history: [],
	suspension: null,
	gateOverrideAllowed: false,
};

describe("getAppPublishStatus", () => {
	it("reads the publish route and parses the status", async () => {
		const calls: Call[] = [];

		expect(
			await getAppPublishStatus(
				PROJECT_ID,
				answers<typeof apiClient.get>(STATUS, calls),
			),
		).toEqual(STATUS);
		expect(calls).toEqual([{ url: BASE }]);
	});

	it("rejects a live URL that is not https", async () => {
		await expect(
			getAppPublishStatus(
				PROJECT_ID,
				answers<typeof apiClient.get>({
					...STATUS,
					live: {
						deploymentId: crypto.randomUUID(),
						url: "javascript:alert(1)",
						slug: "shop",
						commitSha: "a".repeat(40),
						publishedAt: "2026-10-01T10:00:00.000Z",
					},
				}),
			),
		).rejects.toThrow();
	});
});

describe("publishApp and rollbackApp", () => {
	it("post the request key, and the deployment id for a rollback", async () => {
		const calls: Call[] = [];
		const requestKey = crypto.randomUUID();
		const deploymentId = crypto.randomUUID();
		const post = answers<typeof apiClient.post>(QUEUED, calls);

		expect(await publishApp(PROJECT_ID, requestKey, post)).toEqual(QUEUED);
		expect(
			await rollbackApp(PROJECT_ID, { deploymentId, requestKey }, post),
		).toEqual(QUEUED);
		expect(calls).toEqual([
			{ url: BASE, body: { requestKey } },
			{ url: `${BASE}/rollback`, body: { deploymentId, requestKey } },
		]);
	});
});

describe("unpublishApp", () => {
	it("sends a DELETE to the publish route and parses the status", async () => {
		const calls: Call[] = [];
		const down: AppPublishStatus = { ...STATUS, latestBuild: null };

		expect(
			await unpublishApp(
				PROJECT_ID,
				answers<typeof apiClient.delete>(down, calls),
			),
		).toEqual(down);
		expect(calls).toEqual([{ url: BASE }]);
	});
});
