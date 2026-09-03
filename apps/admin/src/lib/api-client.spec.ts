import { afterEach, describe, expect, it, vi } from "vitest";

import { apiDelete, apiPut } from "./api-client";

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

	it("sends JSON bodies with PUT requests", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: { updated: true } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			apiPut("/api/v1/admin/users/user-1/admin-views", {
				views: ["users"],
			}),
		).resolves.toEqual({ updated: true });
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringMatching(/\/api\/v1\/admin\/users\/user-1\/admin-views$/),
			expect.objectContaining({
				body: JSON.stringify({ views: ["users"] }),
				credentials: "include",
				method: "PUT",
			}),
		);
	});
});
