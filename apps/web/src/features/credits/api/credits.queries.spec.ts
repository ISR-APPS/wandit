import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn((options: unknown) => options),
}));
vi.mock("@/features/workspaces/lib/workspace-scope", () => ({
	getActiveWorkspaceId: () => "personal",
}));
vi.mock("./credits.services", () => ({
	getCreditActivity: vi.fn(),
	getCreditBalance: vi.fn(),
	getWorkspaceCreditBalances: vi.fn(),
}));

import {
	useCreditActivityQuery,
	useCreditBalanceQuery,
} from "./credits.queries";

describe("credits queries", () => {
	it("refetches the activity list on every mount (dropdown open)", () => {
		const options = useCreditActivityQuery({
			page: 1,
			pageSize: 3,
		}) as unknown as {
			refetchInterval?: number;
			refetchOnWindowFocus: boolean;
			staleTime: number;
		};

		expect(options.staleTime).toBe(0);
		expect(options.refetchOnWindowFocus).toBe(true);
		expect(options.refetchInterval).toBeUndefined();
	});

	it("never polls the balance", () => {
		const options = useCreditBalanceQuery() as unknown as {
			refetchInterval?: number;
			staleTime: number;
		};

		expect(options.refetchInterval).toBeUndefined();
		expect(options.staleTime).toBe(30_000);
	});
});
