import {
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
import { getWorkspaceCreditBalances } from "./credits.services";

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

describe("creditsKeys.balances", () => {
	it("is un-scoped but stays under the credits prefix for invalidations", () => {
		expect(creditsKeys.balances()).toEqual([
			"credits",
			"balances",
			"all-workspaces",
		]);
	});
});
