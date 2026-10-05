// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { AppBuild, AppPublishStatus } from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { appBuilderKeys } from "./app-builder.queries";
import {
	usePublishApp,
	useRollbackApp,
	useUnpublishApp,
} from "./publish.mutations";
import { appPublishKeys } from "./publish.queries";
import type { publishApp, rollbackApp, unpublishApp } from "./publish.services";

const PROJECT_ID = crypto.randomUUID();
const STATUS_KEY = appPublishKeys.status(PROJECT_ID);

const QUEUED: AppBuild = {
	id: crypto.randomUUID(),
	projectId: PROJECT_ID,
	status: "queued",
	commitSha: "c".repeat(40),
	sourceBuildId: null,
	errorCode: null,
	createdAt: "2026-10-01T10:00:00.000Z",
	completedAt: null,
	gateFindings: [],
	gateOverride: false,
};

const EMPTY: AppPublishStatus = {
	live: null,
	latestBuild: null,
	history: [],
	suspension: null,
	gateOverrideAllowed: false,
};

/** An API failure as the server sends it, with the envelope message. */
function apiError(statusCode: number, code: string): ApiClientError {
	return new ApiClientError(
		{
			code,
			message: "The request failed.",
			path: `/api/v2/projects/${PROJECT_ID}/publish`,
			requestId: "req-1",
			statusCode,
			timestamp: "2026-10-01T10:00:00.000Z",
		},
		{ hasServerEnvelopeMessage: true },
	);
}

// Each hook needs the query client for its cache writes.
function wrapperFor(queryClient: QueryClient) {
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children);
}

/** A cache with a loaded status and a loaded project. */
function seededClient(): QueryClient {
	const queryClient = new QueryClient();
	queryClient.setQueryData(STATUS_KEY, EMPTY);
	queryClient.setQueryData(appBuilderKeys.project(PROJECT_ID), {
		id: PROJECT_ID,
	});
	return queryClient;
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("usePublishApp and useRollbackApp", () => {
	it("send the keys and put the queued build in the status", async () => {
		const queryClient = seededClient();
		const publish = vi.fn<typeof publishApp>(async () => QUEUED);
		const rollback = vi.fn<typeof rollbackApp>(async () => QUEUED);
		const { result } = renderHook(
			() => ({
				publish: usePublishApp(PROJECT_ID, publish),
				rollback: useRollbackApp(PROJECT_ID, rollback),
			}),
			{ wrapper: wrapperFor(queryClient) },
		);
		const requestKey = crypto.randomUUID();
		const deploymentId = crypto.randomUUID();

		act(() => result.current.publish.mutate(requestKey));
		await waitFor(() =>
			expect(
				queryClient.getQueryData<AppPublishStatus>(STATUS_KEY)?.latestBuild,
			).toEqual(QUEUED),
		);
		act(() => result.current.rollback.mutate(deploymentId));
		await waitFor(() => expect(result.current.rollback.isSuccess).toBe(true));

		expect(publish).toHaveBeenCalledWith(PROJECT_ID, requestKey);
		expect(rollback).toHaveBeenCalledWith(PROJECT_ID, {
			deploymentId,
			requestKey: expect.any(String),
		});
	});

	it("shows no toast on a 402, and a toast and a status refresh on a 409", async () => {
		const toastError = vi.spyOn(toast, "error");
		const queryClient = seededClient();
		const publish = vi
			.fn<typeof publishApp>()
			.mockRejectedValueOnce(apiError(402, "INSUFFICIENT_CREDITS"))
			.mockRejectedValueOnce(apiError(409, "PUBLISH_ACTIVE"));
		const { result } = renderHook(() => usePublishApp(PROJECT_ID, publish), {
			wrapper: wrapperFor(queryClient),
		});

		act(() => result.current.mutate(crypto.randomUUID()));
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(toastError).not.toHaveBeenCalled();
		expect(queryClient.getQueryState(STATUS_KEY)?.isInvalidated).toBe(false);

		act(() => result.current.mutate(crypto.randomUUID()));
		await waitFor(() => expect(toastError).toHaveBeenCalledOnce());
		expect(queryClient.getQueryState(STATUS_KEY)?.isInvalidated).toBe(true);
	});
});

describe("useUnpublishApp", () => {
	it("writes the answered status and refreshes the project counts", async () => {
		const queryClient = seededClient();
		queryClient.setQueryData(STATUS_KEY, { ...EMPTY, latestBuild: QUEUED });
		const unpublish = vi.fn<typeof unpublishApp>(async () => EMPTY);
		const { result } = renderHook(
			() => useUnpublishApp(PROJECT_ID, unpublish),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate());

		await waitFor(() =>
			expect(queryClient.getQueryData(STATUS_KEY)).toEqual(EMPTY),
		);
		expect(
			queryClient.getQueryState(appBuilderKeys.project(PROJECT_ID))
				?.isInvalidated,
		).toBe(true);
	});
});
