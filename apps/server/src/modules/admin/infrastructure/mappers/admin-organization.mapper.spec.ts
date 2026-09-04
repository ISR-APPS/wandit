import { describe, expect, it } from "vitest";

import type { AdminOrganizationSummaryRow } from "../persistence/admin-organizations.repository";
import { mapAdminOrganizationSummary } from "./admin-organization.mapper";

const SUMMARY_ROW = {
	id: "org-1",
	name: "Example Organization",
	slug: "example-organization",
	logo: null,
	createdAt: new Date("2026-08-01T10:00:00.000Z"),
	membersCount: 2,
	projectsCount: 1,
	plan: "starter",
	creditsBalance: 700,
} satisfies AdminOrganizationSummaryRow;

describe("mapAdminOrganizationSummary", () => {
	it("preserves Starter instead of treating it as free", () => {
		expect(mapAdminOrganizationSummary(SUMMARY_ROW)).toMatchObject({
			plan: "starter",
			creditsBalance: 7,
		});
	});
});
