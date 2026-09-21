// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { PreviewTokenResponse } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { type PreviewTokenDeps, usePreviewToken } from "./use-preview-token";

const PROJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const NOW = "2026-01-01T12:00:00.000Z";

function tokenResponse(
	token: string,
	expiresAt = "2026-01-01T12:15:00.000Z",
): PreviewTokenResponse {
	return {
		token,
		previewUrl: `https://r-abcdef123456--p-${PROJECT_ID}.wanditpreview.app/?wt=${token}`,
		expiresAt,
	};
}

function sandboxNotRunning() {
	return new ApiClientError({
		code: "SANDBOX_NOT_RUNNING",
		message: "No sandbox runs for this project.",
		path: `/api/v2/projects/${PROJECT_ID}/preview-token`,
		requestId: "req-1",
		statusCode: 409,
		timestamp: NOW,
	});
}

// Lets the pending mint promise resolve inside act while the clock stays fake.
async function flushMints() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("usePreviewToken", () => {
	it("mints a token on mount and shows the ready url", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValue(tokenResponse("t1"));
		const { result } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		expect(result.current.status).toBe("loading");

		await flushMints();

		expect(getPreviewToken).toHaveBeenCalledTimes(1);
		expect(result.current.status).toBe("ready");
		expect(result.current.previewUrl).toBe(tokenResponse("t1").previewUrl);
		expect(result.current.errorText).toBeNull();
	});

	it("shows waking on SANDBOX_NOT_RUNNING and polls every 3 s", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockRejectedValueOnce(sandboxNotRunning())
			.mockResolvedValueOnce(tokenResponse("t2"));
		const { result } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		await flushMints();

		expect(result.current.status).toBe("waking");
		expect(result.current.previewUrl).toBeNull();
		expect(getPreviewToken).toHaveBeenCalledTimes(1);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});

		expect(getPreviewToken).toHaveBeenCalledTimes(2);
		expect(result.current.status).toBe("ready");
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);
	});

	it("re-mints one minute before expiresAt and swaps the url", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValueOnce(tokenResponse("t1", "2026-01-01T12:02:00.000Z"))
			.mockResolvedValueOnce(tokenResponse("t2"));
		const { result } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		await flushMints();
		expect(result.current.previewUrl).toBe(tokenResponse("t1").previewUrl);

		// The token expires at 12:02; the re-mint fires at 12:01.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(61_000);
		});

		expect(getPreviewToken).toHaveBeenCalledTimes(2);
		expect(result.current.status).toBe("ready");
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);
	});

	it("re-mints on the poll floor when expiresAt lands inside the lead", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValueOnce(tokenResponse("t1", "2026-01-01T12:00:30.000Z"))
			.mockResolvedValueOnce(tokenResponse("t2"));
		const { result } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		await flushMints();
		expect(result.current.previewUrl).toBe(tokenResponse("t1").previewUrl);

		// expiresAt minus the 1 min lead is 30 s in the past, so the 3 s floor sets the delay.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});

		expect(getPreviewToken).toHaveBeenCalledTimes(2);
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);
	});

	it("mints a new token when reloadKey changes", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValueOnce(tokenResponse("t1"))
			.mockResolvedValueOnce(tokenResponse("t2"));
		const { result, rerender } = renderHook(
			({ reloadKey }) =>
				usePreviewToken(PROJECT_ID, reloadKey, { getPreviewToken }),
			{ initialProps: { reloadKey: 0 } },
		);

		await flushMints();
		expect(result.current.previewUrl).toBe(tokenResponse("t1").previewUrl);

		rerender({ reloadKey: 1 });
		await flushMints();

		expect(getPreviewToken).toHaveBeenCalledTimes(2);
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);
	});

	it("enters the waking state from markNotRunning and polls until a mint succeeds", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValueOnce(tokenResponse("t1"))
			.mockResolvedValueOnce(tokenResponse("t2"));
		const { result } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		await flushMints();
		expect(result.current.status).toBe("ready");

		act(() => result.current.markNotRunning());
		expect(result.current.status).toBe("waking");
		expect(result.current.previewUrl).toBeNull();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(3_000);
		});

		expect(getPreviewToken).toHaveBeenCalledTimes(2);
		expect(result.current.status).toBe("ready");
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);
	});

	it("ignores the late answer of a mint a newer mint replaced", async () => {
		// Each mint call queues its resolver, so the spec answers them out of order.
		const resolvers: Array<(token: PreviewTokenResponse) => void> = [];
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockImplementation(
				() =>
					new Promise<PreviewTokenResponse>((resolve) => {
						resolvers.push(resolve);
					}),
			);
		const { result, rerender } = renderHook(
			({ reloadKey }) =>
				usePreviewToken(PROJECT_ID, reloadKey, { getPreviewToken }),
			{ initialProps: { reloadKey: 0 } },
		);

		// Mint 1 stays pending while the reload starts mint 2.
		rerender({ reloadKey: 1 });
		expect(resolvers).toHaveLength(2);

		await act(async () => {
			resolvers[1](tokenResponse("t2"));
		});
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);

		// The late mint-1 answer must not overwrite the newer token.
		await act(async () => {
			resolvers[0](tokenResponse("t1"));
		});
		expect(result.current.previewUrl).toBe(tokenResponse("t2").previewUrl);
	});

	it("shows the retry state on a token-expired report while the token is fresh", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValue(tokenResponse("t1"));
		const { result } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		await flushMints();
		expect(result.current.status).toBe("ready");

		// A report 1 s after the mint: the token still has 14 minutes left, so
		// the proxy report is the dropped-cookie case, not a real expiry.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1_000);
		});
		act(() => result.current.refresh());

		expect(result.current.status).toBe("error");
		expect(getPreviewToken).toHaveBeenCalledTimes(1);
	});

	it("stops the scheduled re-mint on unmount", async () => {
		const getPreviewToken = vi
			.fn<PreviewTokenDeps["getPreviewToken"]>()
			.mockResolvedValue(tokenResponse("t1", "2026-01-01T12:02:00.000Z"));
		const { unmount } = renderHook(() =>
			usePreviewToken(PROJECT_ID, 0, { getPreviewToken }),
		);

		await flushMints();
		expect(getPreviewToken).toHaveBeenCalledTimes(1);

		unmount();

		// The re-mint was set for 12:01; past it, the fake must stay silent.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(120_000);
		});
		expect(getPreviewToken).toHaveBeenCalledTimes(1);
	});
});
