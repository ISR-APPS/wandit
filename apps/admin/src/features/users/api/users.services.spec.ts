import { adminListUsersQuerySchema, adminRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api-client";

import { listUsers } from "./users.services";

vi.mock("@/lib/api-client", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);

afterEach(() => {
	vi.clearAllMocks();
});

describe("listUsers", () => {
	it("round-trips the credits-used range through query params the contract accepts", async () => {
		apiGetMock.mockResolvedValueOnce({
			items: [],
			page: 1,
			pageSize: 25,
			total: 0,
		});

		await listUsers({
			page: 1,
			pageSize: 25,
			sort: "newest",
			plan: ["pro"],
			creditsUsedMin: 100,
			creditsUsedMax: 500,
		});

		expect(apiGetMock).toHaveBeenCalledWith(adminRoutes.users, {
			page: 1,
			pageSize: 25,
			q: undefined,
			sort: "newest",
			plan: "pro",
			role: undefined,
			status: undefined,
			verified: undefined,
			creditsUsedMin: 100,
			creditsUsedMax: 500,
		});

		// The params the client sends must survive the server-side schema.
		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListUsersQuerySchema.parse(sentParams);

		expect(parsed).toMatchObject({
			creditsUsedMin: 100,
			creditsUsedMax: 500,
		});
	});

	it("omits both credits-used bounds when the filter is unset", async () => {
		apiGetMock.mockResolvedValueOnce({
			items: [],
			page: 1,
			pageSize: 25,
			total: 0,
		});

		await listUsers({ page: 1, pageSize: 25, sort: "newest" });

		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.users,
			expect.objectContaining({
				creditsUsedMin: undefined,
				creditsUsedMax: undefined,
			}),
		);
	});

	it("sends an open upper bound as min-only", async () => {
		apiGetMock.mockResolvedValueOnce({
			items: [],
			page: 1,
			pageSize: 25,
			total: 0,
		});

		await listUsers({
			page: 1,
			pageSize: 25,
			sort: "newest",
			creditsUsedMin: 1000,
		});

		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.users,
			expect.objectContaining({
				creditsUsedMin: 1000,
				creditsUsedMax: undefined,
			}),
		);
	});
});
