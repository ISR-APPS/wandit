// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { CloudBackendResponse, CloudSqlResponse } from "@wandit/contracts";
import { fallbackDictionary, I18nProvider } from "@wandit/internationalization";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import {
	useDeleteObjects,
	useDeleteSecret,
	useEnableBackend,
	useRestoreBackend,
	useRunSql,
	useSetSecret,
	useUploadObject,
} from "./cloud.mutations";
import { cloudKeys } from "./cloud.queries";
import type {
	deleteObjects,
	deleteSecret,
	runSql,
	setSecret,
	uploadObject,
} from "./cloud.services";

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

// Each hook needs the query client for its cache writes. useUploadObject
// also reads the English dictionary for its Storage toast.
function wrapperFor(queryClient: QueryClient) {
	return ({ children }: { children: ReactNode }) => {
		// I18nProvider requires children in its props type for createElement calls.
		const providerProps: ComponentProps<typeof I18nProvider> = {
			locale: "en",
			dictionary: fallbackDictionary,
			setLocale: () => {},
			children,
		};
		return createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(I18nProvider, providerProps),
		);
	};
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

describe("useUploadObject and useDeleteObjects", () => {
	const folderKey = cloudKeys.objects(PROJECT_ID, "avatars", "users/");
	const otherBucketKey = cloudKeys.objects(PROJECT_ID, "documents", "");

	/** A cache with one loaded folder of the bucket and one of another bucket. */
	function storageClient(): QueryClient {
		const queryClient = new QueryClient();
		queryClient.setQueryData(folderKey, null);
		queryClient.setQueryData(otherBucketKey, null);
		return queryClient;
	}

	it("uploads the file and marks the folders of the bucket stale, not another bucket", async () => {
		const queryClient = storageClient();
		const upload = vi.fn<typeof uploadObject>(async () => {});
		const file = new File(["hello"], "a.txt", { type: "text/plain" });
		const { result } = renderHook(
			() => useUploadObject(PROJECT_ID, "avatars", upload),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate({ path: "users/a.txt", file }));

		await waitFor(() =>
			expect(queryClient.getQueryState(folderKey)?.isInvalidated).toBe(true),
		);
		expect(upload).toHaveBeenCalledWith(PROJECT_ID, "avatars", {
			path: "users/a.txt",
			file,
		});
		expect(queryClient.getQueryState(otherBucketKey)?.isInvalidated).toBe(
			false,
		);
	});

	it("shows the same-name text for a Storage refusal and the API message for an API failure", async () => {
		const toastError = vi.spyOn(toast, "error");
		const upload = vi
			.fn<typeof uploadObject>()
			.mockRejectedValueOnce(
				new Error("Storage refused the upload with HTTP 409"),
			)
			.mockRejectedValueOnce(apiError(404, "BUCKET_NOT_FOUND"));
		const { result } = renderHook(
			() => useUploadObject(PROJECT_ID, "avatars", upload),
			{ wrapper: wrapperFor(new QueryClient()) },
		);
		const input = { path: "a.txt", file: new File(["x"], "a.txt") };

		act(() => result.current.mutate(input));
		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				"The file did not upload. A file with the same name can already be in this folder.",
			),
		);

		act(() => result.current.mutate(input));
		await waitFor(() =>
			expect(toastError).toHaveBeenLastCalledWith("The statement failed."),
		);
	});

	it("deletes the paths and marks the folders of the bucket stale", async () => {
		const queryClient = storageClient();
		const remove = vi.fn<typeof deleteObjects>(async () => 1);
		const { result } = renderHook(
			() => useDeleteObjects(PROJECT_ID, "avatars", remove),
			{ wrapper: wrapperFor(queryClient) },
		);

		act(() => result.current.mutate(["users/a.txt"]));

		await waitFor(() =>
			expect(queryClient.getQueryState(folderKey)?.isInvalidated).toBe(true),
		);
		expect(remove).toHaveBeenCalledWith(PROJECT_ID, "avatars", {
			paths: ["users/a.txt"],
		});
	});

	it("shows the API message when the delete fails", async () => {
		const toastError = vi.spyOn(toast, "error");
		const remove = vi
			.fn<typeof deleteObjects>()
			.mockRejectedValueOnce(apiError(409, "BACKEND_PAUSED"));
		const { result } = renderHook(
			() => useDeleteObjects(PROJECT_ID, "avatars", remove),
			{ wrapper: wrapperFor(new QueryClient()) },
		);

		act(() => result.current.mutate(["users/a.txt"]));

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith("The statement failed."),
		);
	});
});

describe("useSetSecret and useDeleteSecret", () => {
	/** A cache with the loaded secret list. */
	function secretsClient(): QueryClient {
		const queryClient = new QueryClient();
		queryClient.setQueryData(cloudKeys.secrets(PROJECT_ID), []);
		return queryClient;
	}

	it("sends the name and the value, then marks the secret list stale", async () => {
		const queryClient = secretsClient();
		const set = vi.fn<typeof setSecret>(async () => {});
		const { result } = renderHook(() => useSetSecret(PROJECT_ID, set), {
			wrapper: wrapperFor(queryClient),
		});

		act(() => result.current.mutate({ name: "API_KEY", value: "s3cret" }));

		await waitFor(() =>
			expect(
				queryClient.getQueryState(cloudKeys.secrets(PROJECT_ID))?.isInvalidated,
			).toBe(true),
		);
		expect(set).toHaveBeenCalledWith(PROJECT_ID, "API_KEY", {
			value: "s3cret",
		});
	});

	it("deletes the name and marks the secret list stale", async () => {
		const queryClient = secretsClient();
		const remove = vi.fn<typeof deleteSecret>(async () => {});
		const { result } = renderHook(() => useDeleteSecret(PROJECT_ID, remove), {
			wrapper: wrapperFor(queryClient),
		});

		act(() => result.current.mutate("API_KEY"));

		await waitFor(() =>
			expect(
				queryClient.getQueryState(cloudKeys.secrets(PROJECT_ID))?.isInvalidated,
			).toBe(true),
		);
		expect(remove).toHaveBeenCalledWith(PROJECT_ID, "API_KEY");
	});

	it("shows the translated text of the error code when the delete of a system secret fails", async () => {
		const toastError = vi.spyOn(toast, "error");
		const remove = vi
			.fn<typeof deleteSecret>()
			.mockRejectedValueOnce(apiError(409, "PROJECT_SECRET_SYSTEM"));
		const { result } = renderHook(() => useDeleteSecret(PROJECT_ID, remove), {
			wrapper: wrapperFor(new QueryClient()),
		});

		act(() => result.current.mutate("SUPABASE_URL"));

		await waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				"This secret belongs to Wandit. You cannot change or delete it.",
			),
		);
	});
});
