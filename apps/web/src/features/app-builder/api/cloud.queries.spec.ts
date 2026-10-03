import { QueryClient } from "@tanstack/react-query";
import type {
	CloudBackendResponse,
	CloudObjectsResponse,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	cloudBackendPollMs,
	cloudKeys,
	cloudObjectsQuery,
} from "./cloud.queries";

const PROJECT_ID = crypto.randomUUID();

function backend(status: CloudBackendResponse["status"]): CloudBackendResponse {
	return { status, ref: null, region: null, failureCode: null };
}

describe("cloudBackendPollMs", () => {
	it("polls every 5 s while Supabase creates or wakes the project", () => {
		expect(cloudBackendPollMs(backend("creating"))).toBe(5_000);
		expect(cloudBackendPollMs(backend("restoring"))).toBe(5_000);
	});

	it("does not poll in any other state, or before the first answer", () => {
		for (const status of [
			"none",
			"active",
			"paused",
			"deleting",
			"error",
		] as const) {
			expect(cloudBackendPollMs(backend(status))).toBe(false);
		}
		expect(cloudBackendPollMs(undefined)).toBe(false);
	});
});

describe("cloudKeys", () => {
	it("refreshes the table list and its pages together, and not the backend state", async () => {
		const queryClient = new QueryClient();
		const rowsKey = cloudKeys.rows(PROJECT_ID, "orders", {
			page: 1,
			pageSize: 50,
			dir: "asc",
		});
		queryClient.setQueryData(cloudKeys.tables(PROJECT_ID), []);
		queryClient.setQueryData(rowsKey, null);
		queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), backend("active"));

		await queryClient.invalidateQueries({
			queryKey: cloudKeys.tables(PROJECT_ID),
		});

		expect(queryClient.getQueryState(rowsKey)?.isInvalidated).toBe(true);
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID))?.isInvalidated,
		).toBe(false);
	});

	it("refreshes every loaded folder of a bucket together with the bucket list", async () => {
		const queryClient = new QueryClient();
		const folderKey = cloudKeys.objects(PROJECT_ID, "avatars", "users/");
		queryClient.setQueryData(cloudKeys.buckets(PROJECT_ID), []);
		queryClient.setQueryData(folderKey, null);

		await queryClient.invalidateQueries({
			queryKey: cloudKeys.buckets(PROJECT_ID),
		});

		expect(queryClient.getQueryState(folderKey)?.isInvalidated).toBe(true);
	});

	it("refreshes the folders of one bucket and not those of another bucket", async () => {
		const queryClient = new QueryClient();
		const folderOfA = cloudKeys.objects(PROJECT_ID, "a", "");
		const folderOfB = cloudKeys.objects(PROJECT_ID, "b", "");
		queryClient.setQueryData(folderOfA, null);
		queryClient.setQueryData(folderOfB, null);

		await queryClient.invalidateQueries({
			queryKey: cloudKeys.bucketObjects(PROJECT_ID, "a"),
		});

		expect(queryClient.getQueryState(folderOfA)?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(folderOfB)?.isInvalidated).toBe(false);
	});
});

describe("cloudObjectsQuery", () => {
	const options = cloudObjectsQuery(PROJECT_ID, "avatars", "", true);

	function objectsPage(nextCursor: string | null): CloudObjectsResponse {
		return { items: [], nextCursor };
	}

	it("starts at the cursor of the first page", () => {
		expect(options.initialPageParam).toBe("0");
	});

	it("reads the next page at the cursor of the last page, and stops after the last page", () => {
		const lastPage = objectsPage("200");
		const pages = [objectsPage("100"), lastPage];
		const pageParams = ["0", "100"];

		expect(options.getNextPageParam(lastPage, pages, "100", pageParams)).toBe(
			"200",
		);
		expect(
			options.getNextPageParam(objectsPage(null), pages, "100", pageParams),
		).toBeNull();
	});
});
