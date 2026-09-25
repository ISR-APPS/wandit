import { QueryClient } from "@tanstack/react-query";
import type { CodeSnapshotResponse } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	ApiClientError,
	type ApiRequestOptions,
	type apiClient,
} from "@/lib/api-client";
import { appBuilderKeys, codeSnapshotQuery } from "./app-builder.queries";

const PROJECT_ID = crypto.randomUUID();

/** A snapshot answer whose one prefetched file `src/app.tsx` holds `content`. */
function snapshotWith(content: string): CodeSnapshotResponse {
	return {
		branch: "main",
		defaultFilePath: "src/app.tsx",
		files: [
			{ binary: false, content, path: "src/app.tsx", size: content.length },
		],
		tree: [{ kind: "file", name: "app.tsx", path: "src/app.tsx" }],
	};
}

/** A GET that answers `body`. */
function getAnswers(body: CodeSnapshotResponse): typeof apiClient.get {
	// SAFETY: the fake answers the one GET of a case, and the service
	// parses the answer with its contracts schema.
	return (async () => body) as typeof apiClient.get;
}

describe("codeSnapshotQuery", () => {
	it("answers the tree and puts each prefetched file into its file query", async () => {
		const queryClient = new QueryClient();

		const snapshot = await queryClient.fetchQuery(
			codeSnapshotQuery(
				PROJECT_ID,
				getAnswers({
					branch: "main",
					defaultFilePath: "src/app.tsx",
					files: [
						{ binary: false, content: "x", path: "src/app.tsx", size: 1 },
					],
					tree: [{ kind: "file", name: "app.tsx", path: "src/app.tsx" }],
				}),
			),
		);

		expect(snapshot).toEqual({
			branch: "main",
			defaultFilePath: "src/app.tsx",
			tree: [{ kind: "file", name: "app.tsx", path: "src/app.tsx" }],
		});
		expect(
			queryClient.getQueryData(
				appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx"),
			),
		).toEqual({ content: "x", kind: "text", path: "src/app.tsx", size: 1 });
		// The entry has the 30 min of the file query, not the 5 min default.
		expect(
			queryClient
				.getQueryCache()
				.find({ queryKey: appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx") })
				?.gcTime,
		).toBe(30 * 60 * 1000);
	});

	it("drops the late answer of a fetch that a newer fetch cancelled", async () => {
		const queryClient = new QueryClient();
		let calls = 0;
		// The second GET is slow and stops on abort, like axios. The others
		// answer at once.
		const get = (async (_url: string, options?: ApiRequestOptions) => {
			calls += 1;
			if (calls !== 2) return snapshotWith(`answer ${calls}`);
			await new Promise<void>((resolve, reject) => {
				options?.signal?.addEventListener?.("abort", () =>
					reject(new Error("aborted")),
				);
				setTimeout(resolve, 50);
			});
			return snapshotWith("answer 2");
			// SAFETY: the fake answers the GETs of this case, and the service
			// parses each answer with its contracts schema.
		}) as typeof apiClient.get;
		const options = codeSnapshotQuery(PROJECT_ID, get);
		await queryClient.fetchQuery(options);

		// A remount refetch starts; then a turn end refetches and cancels it.
		const cancelled = queryClient.refetchQueries({
			queryKey: options.queryKey,
		});
		await queryClient.refetchQueries({ queryKey: options.queryKey });
		await cancelled;
		await new Promise((resolve) => setTimeout(resolve, 80));

		expect(
			queryClient.getQueryData(
				appBuilderKeys.codeFile(PROJECT_ID, "src/app.tsx"),
			),
		).toMatchObject({ content: "answer 3" });
	});

	it("answers null for an asleep sandbox and puts no file in the cache", async () => {
		const queryClient = new QueryClient();
		const asleep: typeof apiClient.get = async () => {
			throw new ApiClientError({
				code: "SANDBOX_NOT_RUNNING",
				message: "The sandbox is not running",
				path: `/api/v2/projects/${PROJECT_ID}/code`,
				requestId: "req-1",
				statusCode: 409,
				timestamp: "2026-09-24T00:00:00.000Z",
			});
		};

		const snapshot = await queryClient.fetchQuery(
			codeSnapshotQuery(PROJECT_ID, asleep),
		);

		expect(snapshot).toBeNull();
		expect(
			queryClient
				.getQueryCache()
				.findAll({ queryKey: appBuilderKeys.code(PROJECT_ID) }),
		).toHaveLength(1);
	});
});
