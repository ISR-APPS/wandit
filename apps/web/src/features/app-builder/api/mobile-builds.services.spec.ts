import type {
	CreateMobileBuildBody,
	ListMobileBuildsResponse,
	MobileBuild,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { ApiRequestOptions, apiClient } from "@/lib/api-client";
import {
	cancelMobileBuild,
	createMobileBuild,
	listMobileBuilds,
} from "./mobile-builds.services";

const PROJECT_ID = crypto.randomUUID();
const BASE = `/api/v2/projects/${PROJECT_ID}/mobile-builds`;

/** One recorded request of a fake client method. Only the create POST sends a body. */
type Call = {
	url: string;
	body?: CreateMobileBuildBody;
	options?: ApiRequestOptions;
};

/** A GET that answers the raw `body` and records each URL and option it got. */
function getAnswers(body: unknown, calls: Call[] = []): typeof apiClient.get {
	// SAFETY: the fake answers the one GET of a case, and the service
	// parses the answer with its contracts schema.
	return (async (url: string, options?: ApiRequestOptions) => {
		calls.push({ url, options });
		return body;
	}) as typeof apiClient.get;
}

/** A POST that answers the raw `answer` and records each URL and body it got. */
function postAnswers(
	answer: unknown,
	calls: Call[] = [],
): typeof apiClient.post {
	// SAFETY: the fake answers the one POST of a case, and the service
	// parses the answer with its contracts schema.
	return (async (url: string, body?: CreateMobileBuildBody) => {
		calls.push({ url, body });
		return answer;
	}) as typeof apiClient.post;
}

const QUEUED: MobileBuild = {
	id: crypto.randomUUID(),
	projectId: PROJECT_ID,
	platform: "android",
	kind: "apk",
	status: "queued",
	commitSha: "a".repeat(40),
	artifactUrl: null,
	errorCode: null,
	createdAt: "2026-09-26T10:00:00.000Z",
	completedAt: null,
};

describe("listMobileBuilds", () => {
	it("reads the list route with the limit and parses the answer", async () => {
		const calls: Call[] = [];
		const page: ListMobileBuildsResponse = {
			items: [QUEUED],
			nextCursor: null,
		};

		expect(
			await listMobileBuilds(PROJECT_ID, 6, getAnswers(page, calls)),
		).toEqual(page);
		expect(calls).toEqual([{ url: BASE, options: { query: { limit: 6 } } }]);
	});

	it("rejects a build with an unknown status", async () => {
		await expect(
			listMobileBuilds(
				PROJECT_ID,
				6,
				getAnswers({
					items: [{ ...QUEUED, status: "uploading" }],
					nextCursor: null,
				}),
			),
		).rejects.toThrow();
	});
});

describe("createMobileBuild", () => {
	it("posts the platform and the request key and parses the build", async () => {
		const calls: Call[] = [];
		const body: CreateMobileBuildBody = {
			platform: "android",
			requestKey: crypto.randomUUID(),
		};

		expect(
			await createMobileBuild(PROJECT_ID, body, postAnswers(QUEUED, calls)),
		).toEqual(QUEUED);
		expect(calls).toEqual([{ url: BASE, body }]);
	});

	it("rejects an answer with a bad commit sha", async () => {
		await expect(
			createMobileBuild(
				PROJECT_ID,
				{ platform: "android", requestKey: crypto.randomUUID() },
				postAnswers({ ...QUEUED, commitSha: "main" }),
			),
		).rejects.toThrow();
	});
});

describe("cancelMobileBuild", () => {
	it("posts to the cancel route of the build with no body", async () => {
		const calls: Call[] = [];
		const canceled: MobileBuild = {
			...QUEUED,
			status: "canceled",
			completedAt: "2026-09-26T10:05:00.000Z",
		};

		expect(
			await cancelMobileBuild(
				PROJECT_ID,
				QUEUED.id,
				postAnswers(canceled, calls),
			),
		).toEqual(canceled);
		expect(calls).toEqual([
			{ url: `${BASE}/${QUEUED.id}/cancel`, body: undefined },
		]);
	});
});
