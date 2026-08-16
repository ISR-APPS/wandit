import { afterEach, describe, expect, it, vi } from "vitest";

import { apiDelete } from "./api-client";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("admin api client", () => {
	it("accepts a bodyless 204 response from a DELETE request", async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			apiDelete<void>("/api/v1/admin/costs/2026-08"),
		).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringMatching(/\/api\/v1\/admin\/costs\/2026-08$/),
			expect.objectContaining({
				body: "{}",
				credentials: "include",
				method: "DELETE",
			}),
		);
	});
});
