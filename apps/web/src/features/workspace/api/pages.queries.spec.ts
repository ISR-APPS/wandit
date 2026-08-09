import { describe, expect, it, vi } from "vitest";

import { pageKeys, refreshOverviewAfterRestoreFailure } from "./pages.queries";

describe("refreshOverviewAfterRestoreFailure", () => {
	it("invalidates server truth so a restore retry does not reuse a stale active id", () => {
		const invalidateQueries = vi.fn().mockResolvedValue(undefined);

		refreshOverviewAfterRestoreFailure(
			{ invalidateQueries },
			"11111111-1111-4111-8111-111111111111",
		);

		expect(invalidateQueries).toHaveBeenCalledOnce();
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: pageKeys.overview("11111111-1111-4111-8111-111111111111"),
		});
	});
});
