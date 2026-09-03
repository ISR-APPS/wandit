import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { refreshAcademyAfterDelete } from "./academy.mutations";
import { academyKeys } from "./academy.queries";

const GUIDE_ID = "11111111-1111-4111-8111-111111111111";

describe("Academy mutation cache updates", () => {
	it("removes the deleted detail and refreshes lists without awaiting refetches", () => {
		const neverResolvingInvalidation = new Promise<never>(() => undefined);
		const queryClient = {
			removeQueries: vi.fn(),
			invalidateQueries: vi.fn(() => neverResolvingInvalidation),
		} as unknown as Pick<QueryClient, "invalidateQueries" | "removeQueries">;

		expect(refreshAcademyAfterDelete(queryClient, GUIDE_ID)).toBeUndefined();
		expect(queryClient.removeQueries).toHaveBeenCalledWith({
			queryKey: academyKeys.guide(GUIDE_ID),
			exact: true,
		});
		expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
			queryKey: academyKeys.lists,
		});
	});
});
