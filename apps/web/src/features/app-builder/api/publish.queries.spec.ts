import { QueryClient } from "@tanstack/react-query";
import type { AppBuildStatus, AppPublishStatus } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { apiClient } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import { appPublishQuery, isPublishRunning } from "./publish.queries";

const PROJECT_ID = crypto.randomUUID();

/** A status whose newest attempt has `status`, or no attempt for null. */
function statusWith(status: AppBuildStatus | null): AppPublishStatus {
	return {
		live: null,
		latestBuild:
			status === null
				? null
				: {
						id: crypto.randomUUID(),
						projectId: PROJECT_ID,
						status,
						commitSha: "b".repeat(40),
						sourceBuildId: null,
						errorCode: null,
						createdAt: "2026-10-01T10:00:00.000Z",
						completedAt: null,
					},
		history: [],
	};
}

describe("isPublishRunning", () => {
	it("is true while the newest attempt is queued, building, or uploading", () => {
		for (const status of ["queued", "building", "uploading"] as const) {
			expect(isPublishRunning(statusWith(status))).toBe(true);
		}
	});

	it("is false after the end, before the first publish, and before the first answer", () => {
		for (const status of ["published", "blocked", "failed"] as const) {
			expect(isPublishRunning(statusWith(status))).toBe(false);
		}
		expect(isPublishRunning(statusWith(null))).toBe(false);
		expect(isPublishRunning(undefined)).toBe(false);
	});
});

/** A GET that answers `bodies` in order, one per call. */
function getAnswers(...bodies: AppPublishStatus[]): typeof apiClient.get {
	const queue = [...bodies];
	// SAFETY: the fake answers the GETs of one case, and the service
	// parses each answer with its contracts schema.
	return (async () => queue.shift()) as typeof apiClient.get;
}

describe("appPublishQuery", () => {
	it("refreshes the project only when a cached running publish ends", async () => {
		const queryClient = new QueryClient();
		const projectKey = appBuilderKeys.project(PROJECT_ID);
		queryClient.setQueryData(projectKey, { id: PROJECT_ID });
		const options = appPublishQuery(
			PROJECT_ID,
			getAnswers(
				statusWith("building"),
				statusWith("uploading"),
				statusWith("published"),
			),
		);
		const isProjectInvalidated = () =>
			queryClient.getQueryState(projectKey)?.isInvalidated;

		// The first answer has no cached status, and the second still runs.
		await queryClient.fetchQuery(options);
		await queryClient.fetchQuery(options);
		expect(isProjectInvalidated()).toBe(false);

		await queryClient.fetchQuery(options);
		expect(isProjectInvalidated()).toBe(true);
	});
});
