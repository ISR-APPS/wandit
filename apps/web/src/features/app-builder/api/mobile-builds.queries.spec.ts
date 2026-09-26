import { QueryClient } from "@tanstack/react-query";
import type {
	ListMobileBuildsResponse,
	MobileBuild,
	MobileBuildStatus,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { creditsKeys } from "@/features/credits";
import type { apiClient } from "@/lib/api-client";
import { mobileBuildsPollMs, mobileBuildsQuery } from "./mobile-builds.queries";

const PROJECT_ID = crypto.randomUUID();

/** A list answer with one build per status, newest first. */
function listOf(...statuses: MobileBuildStatus[]) {
	const items: MobileBuild[] = statuses.map((status) => ({
		id: crypto.randomUUID(),
		projectId: crypto.randomUUID(),
		platform: "android",
		kind: "apk",
		status,
		commitSha: "b".repeat(40),
		artifactUrl: null,
		errorCode: null,
		createdAt: "2026-09-26T10:00:00.000Z",
		completedAt: null,
	}));
	return { items, nextCursor: null };
}

describe("mobileBuildsPollMs", () => {
	it("polls every 10 s while a build is queued or building", () => {
		expect(mobileBuildsPollMs(listOf("queued"))).toBe(10_000);
		expect(mobileBuildsPollMs(listOf("building", "finished"))).toBe(10_000);
	});

	it("does not poll when every build ended, with no build, or before the first answer", () => {
		expect(mobileBuildsPollMs(listOf("finished", "failed", "canceled"))).toBe(
			false,
		);
		expect(mobileBuildsPollMs(listOf())).toBe(false);
		expect(mobileBuildsPollMs(undefined)).toBe(false);
	});
});

/** A GET that answers `bodies` in order, one per call. */
function getAnswers(
	...bodies: ListMobileBuildsResponse[]
): typeof apiClient.get {
	const queue = [...bodies];
	// SAFETY: the fake answers the GETs of one case, and the service
	// parses each answer with its contracts schema.
	return (async () => queue.shift()) as typeof apiClient.get;
}

describe("mobileBuildsQuery", () => {
	it("refreshes the credits only when a cached live build ends", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(creditsKeys.balance(), { settledBalance: 100 });
		const building = listOf("building");
		const finished = {
			items: building.items.map((build) => ({
				...build,
				status: "finished" as const,
			})),
			nextCursor: null,
		};
		const options = mobileBuildsQuery(
			PROJECT_ID,
			getAnswers(building, building, finished),
		);
		const isBalanceInvalidated = () =>
			queryClient.getQueryState(creditsKeys.balance())?.isInvalidated;

		// The first answer has no cached list, and the second has the same live build.
		await queryClient.fetchQuery(options);
		await queryClient.fetchQuery(options);
		expect(isBalanceInvalidated()).toBe(false);

		await queryClient.fetchQuery(options);
		expect(isBalanceInvalidated()).toBe(true);
	});
});
