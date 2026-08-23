import {
	type CreditActivityResponse,
	creditsRoutes,
	type WorkspaceCreditBalancesResponse,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	ApiService: {
		get: vi.fn(),
	},
}));

import { ApiService } from "@/lib/api-client";
import { creditsKeys } from "./credits.queries";
import {
	getCreditActivity,
	getWorkspaceCreditBalances,
} from "./credits.services";

const RESPONSE: WorkspaceCreditBalancesResponse = {
	items: [
		{
			workspaceId: "personal",
			name: null,
			balance: 0,
			settledBalance: 0,
		},
		{
			workspaceId: "0d6f9f3a-8f6a-4c8e-9f1e-0a4b7c1d2e3f",
			name: "Acme Marketing",
			balance: 41.5,
			settledBalance: 43.5,
		},
	],
};

describe("getWorkspaceCreditBalances", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches the all-workspaces balances route and returns parsed items", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(RESPONSE);

		await expect(getWorkspaceCreditBalances()).resolves.toEqual(RESPONSE);
		expect(ApiService.get).toHaveBeenCalledWith(creditsRoutes.balances);
	});

	it("rejects a payload whose rows miss settledBalance", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce({
			items: [{ workspaceId: "personal", name: null, balance: 3 }],
		});

		await expect(getWorkspaceCreditBalances()).rejects.toThrow();
	});
});

const ACTIVITY: CreditActivityResponse = {
	items: [
		{
			id: "6f1c2a4e-1b2c-4d3e-8f90-a1b2c3d4e5f6",
			kind: "usage",
			operation: "chat",
			status: "in_progress",
			credits: null,
			ledgerKind: null,
			bucket: null,
			reason: null,
			createdAt: "2026-08-22T10:00:00.000Z",
			finalizedAt: null,
		},
		{
			id: "7a2d3b5f-2c3d-4e4f-9a01-b2c3d4e5f6a7",
			kind: "ledger",
			operation: null,
			status: "settled",
			credits: 50,
			ledgerKind: "grant",
			bucket: "promo",
			reason: "signup_grant",
			createdAt: "2026-08-21T10:00:00.000Z",
			finalizedAt: "2026-08-21T10:00:00.000Z",
		},
	],
	page: 1,
	pageSize: 3,
	total: 2,
};

describe("getCreditActivity", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches the activity route with the page query and parses the rows", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(ACTIVITY);

		await expect(getCreditActivity({ page: 1, pageSize: 3 })).resolves.toEqual(
			ACTIVITY,
		);
		expect(ApiService.get).toHaveBeenCalledWith(creditsRoutes.activity, {
			query: { page: 1, pageSize: 3 },
		});
	});

	it("rejects a row with an unknown status", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce({
			...ACTIVITY,
			items: [{ ...ACTIVITY.items[0], status: "reserved" }],
		});

		await expect(getCreditActivity({ page: 1, pageSize: 3 })).rejects.toThrow();
	});
});

describe("creditsKeys.activity", () => {
	it("nests the page under the workspace-scoped activities prefix", () => {
		const key = creditsKeys.activity({ page: 2, pageSize: 10 });

		expect(key.slice(0, creditsKeys.activities().length)).toEqual(
			creditsKeys.activities(),
		);
		expect(key.slice(-2)).toEqual([2, 10]);
		expect(key[0]).toBe("credits");
	});
});

describe("creditsKeys.balances", () => {
	it("is un-scoped but stays under the credits prefix for invalidations", () => {
		expect(creditsKeys.balances()).toEqual([
			"credits",
			"balances",
			"all-workspaces",
		]);
	});
});
