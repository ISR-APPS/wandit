// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type {
	AppCommit,
	ListVersionsResponse,
	RestoreVersionResponse,
} from "@wandit/contracts";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import {
	type RestoreVersionDeps,
	useRestoreVersion,
} from "./app-builder.mutations";
import { appBuilderKeys } from "./app-builder.queries";
import type { CodeFile } from "./dto";

const PROJECT_ID = crypto.randomUUID();
const HEAD_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const OLD_SHA = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

/** The function shape of the restore service. NonNullable because the dep field is optional. */
type RestoreFn = NonNullable<RestoreVersionDeps["restoreVersion"]>;

// The commit the restore POST answers: a copy-forward row on top.
const RESTORED: RestoreVersionResponse = {
	commit: {
		sha: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
		parentSha: HEAD_SHA,
		message: "Restore",
		source: "restore",
		restoredFromSha: OLD_SHA,
		turnId: null,
		messageId: null,
		numstat: null,
		createdAt: "2026-09-17T10:00:00.000Z",
	} satisfies AppCommit,
};

/** An API failure with the shared error envelope fields. */
function apiError(code: string, statusCode: number): ApiClientError {
	return new ApiClientError({
		code,
		message: "The request failed.",
		path: `/api/v2/projects/${PROJECT_ID}/versions/${OLD_SHA}/restore`,
		requestId: "req-1",
		statusCode,
		timestamp: "2026-09-17T00:00:00.000Z",
	});
}

// The mutation hook needs the query client for the invalidation.
function renderRestore(deps: RestoreVersionDeps, queryClient: QueryClient) {
	return renderHook(() => useRestoreVersion(PROJECT_ID, deps), {
		wrapper: ({ children }: { children: ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children),
	});
}

afterEach(cleanup);

describe("useRestoreVersion", () => {
	it("posts the restore, invalidates the seeded versions list and code, and runs onRestored", async () => {
		const queryClient = new QueryClient();
		const versions: ListVersionsResponse = { items: [], nextCursor: null };
		queryClient.setQueryData(appBuilderKeys.versions(PROJECT_ID), versions);
		const openFile: CodeFile = { kind: "missing", path: "src/app.tsx" };
		queryClient.setQueryData(
			appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx"),
			openFile,
		);
		const restoreVersion = vi.fn<RestoreFn>(async () => RESTORED);
		const onRestored = vi.fn();
		const { result } = renderRestore(
			{ restoreVersion, onRestored },
			queryClient,
		);

		act(() => {
			result.current.mutate({ sha: OLD_SHA, expectedHeadSha: HEAD_SHA });
		});

		await waitFor(() =>
			expect(restoreVersion).toHaveBeenCalledWith(PROJECT_ID, OLD_SHA, {
				expectedHeadSha: HEAD_SHA,
			}),
		);
		await waitFor(() =>
			expect(
				queryClient.getQueryState(appBuilderKeys.versions(PROJECT_ID))
					?.isInvalidated,
			).toBe(true),
		);
		expect(
			queryClient.getQueryState(
				appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx"),
			)?.isInvalidated,
		).toBe(true);
		expect(onRestored).toHaveBeenCalledOnce();
	});

	it("runs onRestored also when the caller unmounted during the restore", async () => {
		const queryClient = new QueryClient();
		let finish: (response: RestoreVersionResponse) => void = () => {};
		const restoreVersion = vi.fn<RestoreFn>(
			() =>
				new Promise<RestoreVersionResponse>((resolve) => {
					finish = resolve;
				}),
		);
		const onRestored = vi.fn();
		const { result, unmount } = renderRestore(
			{ restoreVersion, onRestored },
			queryClient,
		);

		act(() => {
			result.current.mutate({ sha: OLD_SHA, expectedHeadSha: HEAD_SHA });
		});
		// The fake runs in a microtask after `mutate`; this wait assigns `finish`.
		await waitFor(() => expect(restoreVersion).toHaveBeenCalled());
		act(() => unmount());
		await act(async () => {
			finish(RESTORED);
		});

		// A hook-level callback survives the unmount; a per-`mutate` one would not.
		expect(onRestored).toHaveBeenCalledOnce();
	});

	it("invalidates the versions list when the head moved", async () => {
		const queryClient = new QueryClient();
		const versions: ListVersionsResponse = { items: [], nextCursor: null };
		queryClient.setQueryData(appBuilderKeys.versions(PROJECT_ID), versions);
		const restoreVersion = vi.fn<RestoreFn>(async () => {
			throw apiError("VERSION_CONFLICT", 409);
		});
		const { result } = renderRestore({ restoreVersion }, queryClient);

		act(() => {
			result.current.mutate({ sha: OLD_SHA, expectedHeadSha: HEAD_SHA });
		});

		// The head moved, so the list the user saw is stale and must refresh.
		await waitFor(() =>
			expect(
				queryClient.getQueryState(appBuilderKeys.versions(PROJECT_ID))
					?.isInvalidated,
			).toBe(true),
		);
	});

	it("keeps the versions list untouched on another error code", async () => {
		const queryClient = new QueryClient();
		const versions: ListVersionsResponse = { items: [], nextCursor: null };
		queryClient.setQueryData(appBuilderKeys.versions(PROJECT_ID), versions);
		const restoreVersion = vi.fn<RestoreFn>(async () => {
			throw apiError("INTERNAL_ERROR", 500);
		});
		const { result } = renderRestore({ restoreVersion }, queryClient);

		act(() => {
			result.current.mutate({ sha: OLD_SHA, expectedHeadSha: HEAD_SHA });
		});

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(
			queryClient.getQueryState(appBuilderKeys.versions(PROJECT_ID))
				?.isInvalidated,
		).toBe(false);
	});
});
