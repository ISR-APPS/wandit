import { adminListUsersQuerySchema, adminRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost, apiPut } from "@/lib/api-client";

import { changeUserRole, listUsers, setUserAdminViews } from "./users.services";

vi.mock("@/lib/api-client", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiPut: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);
const apiPostMock = vi.mocked(apiPost);
const apiPutMock = vi.mocked(apiPut);

afterEach(() => {
	vi.clearAllMocks();
});

describe("listUsers", () => {
	it("round-trips a decimal credits-used range through query params the contract accepts", async () => {
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
			creditsUsedMin: 0.5,
			creditsUsedMax: 500.25,
		});

		expect(apiGetMock).toHaveBeenCalledWith(adminRoutes.users, {
			page: 1,
			pageSize: 25,
			q: undefined,
			sort: "newest",
			country: undefined,
			freeCredits: undefined,
			plan: "pro",
			role: undefined,
			status: undefined,
			verified: undefined,
			published: undefined,
			creditsUsedMin: 0.5,
			creditsUsedMax: 500.25,
		});

		// The params the client sends must survive the server-side schema.
		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListUsersQuerySchema.parse(sentParams);

		expect(parsed).toMatchObject({
			creditsUsedMin: 0.5,
			creditsUsedMax: 500.25,
		});
	});

	it("round-trips the Starter plan filter through query params the contract accepts", async () => {
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
			plan: ["starter"],
		});

		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.users,
			expect.objectContaining({ plan: "starter" }),
		);

		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListUsersQuerySchema.parse(sentParams);

		expect(parsed.plan).toEqual(["starter"]);
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
				country: undefined,
				freeCredits: undefined,
				creditsUsedMin: undefined,
				creditsUsedMax: undefined,
			}),
		);
	});

	it("round-trips the country filter as CSV through query params the contract accepts", async () => {
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
			country: ["DZ", "unknown"],
		});

		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.users,
			expect.objectContaining({
				country: "DZ,unknown",
			}),
		);

		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListUsersQuerySchema.parse(sentParams);

		expect(parsed.country).toEqual(["DZ", "unknown"]);
	});

	it("round-trips the free-credits filter as CSV through query params the contract accepts", async () => {
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
			freeCredits: ["consumed", "available"],
		});

		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.users,
			expect.objectContaining({
				freeCredits: "consumed,available",
			}),
		);

		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListUsersQuerySchema.parse(sentParams);

		expect(parsed.freeCredits).toEqual(["consumed", "available"]);
	});

	it("round-trips the published filter as CSV through query params the contract accepts", async () => {
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
			published: ["subdomain", "custom_domain"],
		});

		expect(apiGetMock).toHaveBeenCalledWith(
			adminRoutes.users,
			expect.objectContaining({
				published: "subdomain,custom_domain",
			}),
		);

		// The params the client sends must survive the server-side schema.
		const [, sentParams] = apiGetMock.mock.calls[0] as [string, object];
		const parsed = adminListUsersQuerySchema.parse(sentParams);

		expect(parsed.published).toEqual(["subdomain", "custom_domain"]);
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

describe("admin user access writes", () => {
	it("sends support views with the existing role mutation", async () => {
		apiPostMock.mockResolvedValueOnce({} as never);

		await changeUserRole({
			userId: "user-1",
			role: "support",
			views: ["users", "feedback"],
		});

		expect(apiPostMock).toHaveBeenCalledWith(adminRoutes.setRole("user-1"), {
			role: "support",
			views: ["users", "feedback"],
		});
	});

	it("updates views through the admin-views PUT route", async () => {
		apiPutMock.mockResolvedValueOnce({} as never);

		await setUserAdminViews({
			userId: "user-1",
			views: ["organizations", "academy"],
		});

		expect(apiPutMock).toHaveBeenCalledWith(
			adminRoutes.userAdminViews("user-1"),
			{ views: ["organizations", "academy"] },
		);
	});
});
