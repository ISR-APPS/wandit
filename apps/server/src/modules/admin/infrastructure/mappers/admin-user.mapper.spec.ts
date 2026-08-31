import { describe, expect, it } from "vitest";
import type { AdminUserSummaryRow } from "../persistence/admin.repository";
import { mapAdminUserSummary } from "./admin-user.mapper";

const SUMMARY_ROW = {
	banned: false,
	createdAt: new Date("2026-08-01T10:00:00.000Z"),
	creditsBalance: 1_000,
	creditsConsumed: 500,
	countryCode: "DZ",
	email: "user@example.com",
	emailVerified: true,
	id: "user-1",
	image: null,
	lastSeenAt: null,
	name: "Example User",
	phone: "+213555123456",
	plan: null,
	projectsCount: 1,
	role: "user",
} satisfies AdminUserSummaryRow;

describe("mapAdminUserSummary", () => {
	it("maps a non-empty phone number", () => {
		expect(mapAdminUserSummary(SUMMARY_ROW).phone).toBe("+213555123456");
	});

	it.each([
		null,
		"",
		" \t\n ",
	])("normalizes an absent or blank phone value (%j) to null", (phone) => {
		expect(mapAdminUserSummary({ ...SUMMARY_ROW, phone }).phone).toBeNull();
	});

	it.each([
		["DZ", "DZ"],
		[" fr ", "FR"],
		["AQ", "AQ"],
	] as const)("normalizes a valid country code %j to %s", (countryCode, expected) => {
		expect(
			mapAdminUserSummary({ ...SUMMARY_ROW, countryCode }).countryCode,
		).toBe(expected);
	});

	it("preserves the SQL-resolved picker country over ambiguous phone inference", () => {
		expect(
			mapAdminUserSummary({
				...SUMMARY_ROW,
				countryCode: "CA",
				phone: "+12025550123",
			}).countryCode,
		).toBe("CA");
	});

	it.each([
		null,
		"",
		"DZA",
		"D1",
	])("maps an absent or invalid country code (%j) to null", (countryCode) => {
		expect(
			mapAdminUserSummary({ ...SUMMARY_ROW, countryCode }).countryCode,
		).toBeNull();
	});
});
