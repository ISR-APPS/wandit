// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CloudBackendResponse, CloudSqlResponse } from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import {
	useEnableBackend,
	useRestoreBackend,
	useRunSql,
} from "./cloud.mutations";
import { cloudKeys } from "./cloud.queries";
import type { runSql } from "./cloud.services";

const PROJECT_ID = crypto.randomUUID();
const ROWS_KEY = cloudKeys.rows(PROJECT_ID, "orders", {
	page: 1,
	pageSize: 50,
	dir: "asc",
});

function backend(status: CloudBackendResponse["status"]): CloudBackendResponse {
	return {
		status,
		ref: "abcdefghijklmnopqrst",
		region: "eu-west-3",
		failureCode: null,
	};
}

/** A console answer of `kind` with no rows. */
function sqlAnswer(kind: CloudSqlResponse["kind"]): CloudSqlResponse {
	return { kind, rows: [], rowCount: 0, truncated: false };
}

/** An API failure as the server sends it: the envelope message is the text a toast shows. */
function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError(
		{
			code,
			message: "The statement failed.",
			path: `/api/v2/projects/${PROJECT_ID}/cloud/sql`,
			requestId: "req-1",
			statusCode,
			timestamp: "2026-09-25T00:00:00.000Z",
		},
		{ hasServerEnvelopeMessage: true },
	);
}

// Each hook needs the query client for its cache writes.
function wrapperFor(queryClient: QueryClient) {
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children);
}

/** A cache with a loaded table list, one loaded page, and the backend state. */
function seededClient(): QueryClient {
	const queryClient = new QueryClient();
	queryClient.setQueryData(cloudKeys.tables(PROJECT_ID), []);
	queryClient.setQueryData(ROWS_KEY, null);
	queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), backend("active"));
	return queryClient;
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("useEnableBackend and useRestoreBackend", () => {
	it("writes the creating answer into the backend key", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), backend("none"));
		const enable = vi.fn(async () => backend("creating"));
		const { result } = renderHook(() => useEnableBackend(PROJECT_ID, enable), {
			wrapper: wrapperFor(queryClient),
		});

		act(() => result.current.mutate());

		await waitFor(() =>
			expect(
				queryClient.getQueryData<CloudBackendResponse>(
					cloudKeys.backend(PROJECT_ID),
				)?.status,
			).toBe("creating"),
		);
		expect(enable).toHaveBeenCalledWith(PROJECT_ID);
	});

	it("writes the restoring answer into the backend key", async () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(cloudKeys.backend(PROJECT_ID), backend("paused"));
		const restore = vi.fn(async () => backend("restoring"));
		const { result } = renderHook(
			() => useRestoreBackend(PROJECT_ID, restore),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate());

		await waitFor(() =>
			expect(
				queryClient.getQueryData<CloudBackendResponse>(
					cloudKeys.backend(PROJECT_ID),
				)?.status,
			).toBe("restoring"),
		);
	});
});

describe("useRunSql", () => {
	it("marks the tables and their pages stale after a write, not the backend state", async () => {
		const queryClient = seededClient();
		const run = vi.fn<typeof runSql>(async () => sqlAnswer("write"));
		const { result } = renderHook(() => useRunSql(PROJECT_ID, run), {
			wrapper: wrapperFor(queryClient),
		});

		act(() =>
			result.current.mutate({
				query: "delete from orders",
				confirmWrite: true,
			}),
		);

		await waitFor(() =>
			expect(queryClient.getQueryState(ROWS_KEY)?.isInvalidated).toBe(true),
		);
		expect(
			queryClient.getQueryState(cloudKeys.tables(PROJECT_ID))?.isInvalidated,
		).toBe(true);
		expect(
			queryClient.getQueryState(cloudKeys.backend(PROJECT_ID))?.isInvalidated,
		).toBe(false);
	});

	it("keeps the tables fresh after a read and holds the answer in data", async () => {
		const queryClient = seededClient();
		const run = vi.fn<typeof runSql>(async () => sqlAnswer("read"));
		const { result } = renderHook(() => useRunSql(PROJECT_ID, run), {
			wrapper: wrapperFor(queryClient),
		});

		act(() =>
			result.current.mutate({ query: "select 1", confirmWrite: false }),
		);

		await waitFor(() => expect(result.current.data?.kind).toBe("read"));
		expect(
			queryClient.getQueryState(cloudKeys.tables(PROJECT_ID))?.isInvalidated,
		).toBe(false);
	});

	it("shows no toast for WRITE_NEEDS_CONFIRM and a toast for every other failure, another 409 too", async () => {
		const toastError = vi.spyOn(toast, "error");
		const run = vi
			.fn<typeof runSql>()
			.mockRejectedValueOnce(apiError(409, "WRITE_NEEDS_CONFIRM"))
			.mockRejectedValueOnce(apiError(409, "BACKEND_PAUSED"));
		const { result } = renderHook(() => useRunSql(PROJECT_ID, run), {
			wrapper: wrapperFor(new QueryClient()),
		});

		act(() =>
			result.current.mutate({ query: "select 1", confirmWrite: false }),
		);
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(toastError).not.toHaveBeenCalled();

		act(() =>
			result.current.mutate({ query: "select nope", confirmWrite: false }),
		);
		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith("The statement failed."),
		);
	});
});
