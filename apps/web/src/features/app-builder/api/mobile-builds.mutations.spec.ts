// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type {
	ListMobileBuildsResponse,
	MobileBuild,
	MobileBuildStatus,
} from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { creditsKeys } from "@/features/credits";
import { ApiClientError } from "@/lib/api-client";
import {
	useCancelMobileBuild,
	useCreateMobileBuild,
} from "./mobile-builds.mutations";
import { mobileBuildsKeys } from "./mobile-builds.queries";
import type {
	cancelMobileBuild,
	createMobileBuild,
} from "./mobile-builds.services";

const PROJECT_ID = crypto.randomUUID();
const LIST_KEY = mobileBuildsKeys.list(PROJECT_ID);

function build(status: MobileBuildStatus): MobileBuild {
	return {
		id: crypto.randomUUID(),
		projectId: PROJECT_ID,
		platform: "android",
		kind: "apk",
		status,
		commitSha: "c".repeat(40),
		artifactUrl: null,
		errorCode: null,
		createdAt: "2026-09-26T10:00:00.000Z",
		completedAt: null,
	};
}

/** An API failure as the server sends it, with the envelope message. */
function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError(
		{
			code,
			message: "The request failed.",
			path: `/api/v2/projects/${PROJECT_ID}/mobile-builds`,
			requestId: "req-1",
			statusCode,
			timestamp: "2026-09-26T10:00:00.000Z",
		},
		{ hasServerEnvelopeMessage: true },
	);
}

// Each hook needs the query client for its cache writes.
function wrapperFor(queryClient: QueryClient) {
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children);
}

/** A cache with a loaded build list and a loaded balance. */
function seededClient(items: MobileBuild[]): QueryClient {
	const queryClient = new QueryClient();
	queryClient.setQueryData<ListMobileBuildsResponse>(LIST_KEY, {
		items,
		nextCursor: null,
	});
	queryClient.setQueryData(creditsKeys.balance(), { settledBalance: 100 });
	return queryClient;
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("useCreateMobileBuild", () => {
	it("sends the request key, puts the new build first, and refreshes the balance", async () => {
		const older = build("finished");
		const queryClient = seededClient([older]);
		const queued = build("queued");
		const create = vi.fn<typeof createMobileBuild>(async () => queued);
		const { result } = renderHook(
			() => useCreateMobileBuild(PROJECT_ID, create),
			{ wrapper: wrapperFor(queryClient) },
		);
		const requestKey = crypto.randomUUID();

		act(() => result.current.mutate(requestKey));

		await waitFor(() =>
			expect(
				queryClient.getQueryData<ListMobileBuildsResponse>(LIST_KEY)?.items,
			).toEqual([queued, older]),
		);
		expect(create).toHaveBeenCalledWith(PROJECT_ID, {
			platform: "android",
			requestKey,
		});
		expect(
			queryClient.getQueryState(creditsKeys.balance())?.isInvalidated,
		).toBe(true);
	});

	it("writes no list when the cache holds none", async () => {
		const queryClient = new QueryClient();
		const create = vi.fn<typeof createMobileBuild>(async () => build("queued"));
		const { result } = renderHook(
			() => useCreateMobileBuild(PROJECT_ID, create),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate(crypto.randomUUID()));

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(queryClient.getQueryData(LIST_KEY)).toBeUndefined();
	});

	it("shows no toast on a 402 or a 403 member limit, and a toast and a list refresh on a 409", async () => {
		const toastError = vi.spyOn(toast, "error");
		const queryClient = seededClient([]);
		const memberLimit = apiError(403, "MEMBER_CREDIT_LIMIT_REACHED");
		const create = vi
			.fn<typeof createMobileBuild>()
			.mockRejectedValueOnce(apiError(402, "INSUFFICIENT_CREDITS"))
			.mockRejectedValueOnce(memberLimit)
			.mockRejectedValueOnce(apiError(409, "MOBILE_BUILD_ACTIVE"));
		const { result } = renderHook(
			() => useCreateMobileBuild(PROJECT_ID, create),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate(crypto.randomUUID()));
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(toastError).not.toHaveBeenCalled();
		expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);
		expect(
			queryClient.getQueryState(creditsKeys.balance())?.isInvalidated,
		).toBe(true);

		act(() => result.current.mutate(crypto.randomUUID()));
		await waitFor(() => expect(result.current.error).toBe(memberLimit));
		expect(toastError).not.toHaveBeenCalled();
		expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(false);

		act(() => result.current.mutate(crypto.randomUUID()));
		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				"A build of this app is already running. Wait for it to finish.",
			),
		);
		expect(queryClient.getQueryState(LIST_KEY)?.isInvalidated).toBe(true);
	});

	it("shows the errors.json text, not the server text, on a 503 V2_ENV_MISSING", async () => {
		const toastError = vi.spyOn(toast, "error");
		const queryClient = seededClient([]);
		const create = vi
			.fn<typeof createMobileBuild>()
			.mockRejectedValueOnce(apiError(503, "V2_ENV_MISSING"));
		const { result } = renderHook(
			() => useCreateMobileBuild(PROJECT_ID, create),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate(crypto.randomUUID()));

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				"This feature is not set up on the server yet. Try again later.",
			),
		);
		expect(toastError).toHaveBeenCalledTimes(1);
	});
});

describe("useCancelMobileBuild", () => {
	it("changes the canceled build in place and refreshes the balance", async () => {
		const live = build("building");
		const older = build("failed");
		const queryClient = seededClient([live, older]);
		const canceled: MobileBuild = {
			...live,
			status: "canceled",
			completedAt: "2026-09-26T10:05:00.000Z",
		};
		const cancel = vi.fn<typeof cancelMobileBuild>(async () => canceled);
		const { result } = renderHook(
			() => useCancelMobileBuild(PROJECT_ID, cancel),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate(live.id));

		await waitFor(() =>
			expect(
				queryClient.getQueryData<ListMobileBuildsResponse>(LIST_KEY)?.items,
			).toEqual([canceled, older]),
		);
		expect(cancel).toHaveBeenCalledWith(PROJECT_ID, live.id);
		expect(
			queryClient.getQueryState(creditsKeys.balance())?.isInvalidated,
		).toBe(true);
	});
});
