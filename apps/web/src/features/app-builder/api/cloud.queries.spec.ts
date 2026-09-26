import { QueryClient } from "@tanstack/react-query";
import type { CloudBackendResponse } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { cloudBackendPollMs, cloudKeys } from "./cloud.queries";

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
});
