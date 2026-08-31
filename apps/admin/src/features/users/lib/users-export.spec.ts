import { describe, expect, it, vi } from "vitest";

import type { AdminUserSummary } from "../api/users.dto";
import {
	buildUsersExportRow,
	fetchAllFilteredUsers,
	USERS_EXPORT_COLUMNS,
	USERS_EXPORT_PAGE_SIZE,
	usersExportFileName,
} from "./users-export";

function makeUser(overrides: Partial<AdminUserSummary> = {}): AdminUserSummary {
	return {
		id: "user-1",
		name: "Ada Lovelace",
		email: "ada@example.com",
		phone: "+15551234567",
		countryCode: "US",
		emailVerified: true,
		image: null,
		role: "user",
		banned: false,
		createdAt: "2026-08-01T09:30:00.000Z",
		lastSeenAt: "2026-08-15T18:00:00.000Z",
		plan: "pro",
		creditsBalance: 240.87,
		creditsConsumed: 760.45,
		projectsCount: 3,
		...overrides,
	};
}

describe("buildUsersExportRow", () => {
	it("maps a user to one worksheet row in column order", () => {
		const row = buildUsersExportRow(makeUser());

		expect(row).toHaveLength(USERS_EXPORT_COLUMNS.length);
		expect(row).toEqual([
			"Ada Lovelace",
			"ada@example.com",
			"+15551234567",
			"US",
			"Yes",
			"User",
			"active",
			"pro",
			// Balance floors to one decimal; consumption stays exact at 2 dp.
			240.8,
			760.45,
			3,
			"2026-08-01T09:30:00.000Z",
			"2026-08-15T18:00:00.000Z",
		]);
	});

	it("exports the support role with a readable label", () => {
		const row = buildUsersExportRow(makeUser({ role: "support" }));

		expect(row[5]).toBe("Support");
	});

	it("maps banned, unverified, and never-seen users to readable cells", () => {
		const row = buildUsersExportRow(
			makeUser({
				phone: null,
				countryCode: null,
				emailVerified: false,
				banned: true,
				lastSeenAt: null,
			}),
		);

		expect(row[2]).toBe("");
		expect(row[3]).toBe("");
		expect(row[4]).toBe("No");
		expect(row[6]).toBe("banned");
		expect(row[12]).toBe("");
	});

	it("never rounds a balance up and keeps whole-credit amounts whole", () => {
		const row = buildUsersExportRow(
			makeUser({ creditsBalance: 2.99, creditsConsumed: 20 }),
		);

		expect(row[8]).toBe(2.9);
		expect(row[9]).toBe(20);
	});
});

describe("fetchAllFilteredUsers", () => {
	it("walks every page sequentially at the contract's max page size", async () => {
		const pageOne = Array.from({ length: USERS_EXPORT_PAGE_SIZE }, (_, i) =>
			makeUser({ id: `user-${i}` }),
		);
		const pageTwo = [makeUser({ id: "user-last" })];
		const fetchPage = vi
			.fn()
			.mockResolvedValueOnce({
				items: pageOne,
				page: 1,
				pageSize: USERS_EXPORT_PAGE_SIZE,
				total: USERS_EXPORT_PAGE_SIZE + 1,
			})
			.mockResolvedValueOnce({
				items: pageTwo,
				page: 2,
				pageSize: USERS_EXPORT_PAGE_SIZE,
				total: USERS_EXPORT_PAGE_SIZE + 1,
			});

		const users = await fetchAllFilteredUsers(
			{
				sort: "newest",
				country: ["US", "unknown"],
				freeCredits: ["consumed"],
				creditsUsedMin: 100,
			},
			fetchPage,
		);

		expect(users).toHaveLength(USERS_EXPORT_PAGE_SIZE + 1);
		expect(fetchPage).toHaveBeenCalledTimes(2);
		expect(fetchPage).toHaveBeenNthCalledWith(1, {
			sort: "newest",
			country: ["US", "unknown"],
			freeCredits: ["consumed"],
			creditsUsedMin: 100,
			page: 1,
			pageSize: USERS_EXPORT_PAGE_SIZE,
		});
		expect(fetchPage).toHaveBeenNthCalledWith(2, {
			sort: "newest",
			country: ["US", "unknown"],
			freeCredits: ["consumed"],
			creditsUsedMin: 100,
			page: 2,
			pageSize: USERS_EXPORT_PAGE_SIZE,
		});
	});

	it("stops on an empty page even when total says more rows exist", async () => {
		const fetchPage = vi.fn().mockResolvedValue({
			items: [],
			page: 1,
			pageSize: USERS_EXPORT_PAGE_SIZE,
			total: 50,
		});

		const users = await fetchAllFilteredUsers({ sort: "newest" }, fetchPage);

		expect(users).toEqual([]);
		expect(fetchPage).toHaveBeenCalledTimes(1);
	});
});

describe("usersExportFileName", () => {
	it("names the file wandit-users-<YYYY-MM-DD>.xlsx", () => {
		expect(usersExportFileName(new Date("2026-08-16T12:34:56Z"))).toBe(
			"wandit-users-2026-08-16.xlsx",
		);
	});
});
