import { describe, expect, it } from "vitest";

import type { ListUsersParams } from "./users.dto";
import { userKeys } from "./users.queries";

describe("user query keys", () => {
	it("includes Starter, country, and free-credits filters in the users-list key", () => {
		const params: ListUsersParams = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			country: ["DZ", "unknown"],
			freeCredits: ["consumed"],
			plan: ["starter"],
		};

		expect(userKeys.list(params)).toEqual([
			"admin-users",
			"list",
			{
				page: 1,
				pageSize: 25,
				sort: "newest",
				country: ["DZ", "unknown"],
				freeCredits: ["consumed"],
				plan: ["starter"],
			},
		]);
	});
});
