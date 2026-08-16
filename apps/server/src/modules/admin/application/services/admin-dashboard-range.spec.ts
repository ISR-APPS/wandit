import { BadRequestException } from "@nestjs/common";
import {
	adminAnalyticsQuerySchema,
	adminOverviewQuerySchema,
	adminSignupStatsRanges,
} from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../infrastructure/http/zod-validation.pipe";
import { resolveAdminDashboardRange } from "./admin-dashboard-range";

const NOW = new Date("2026-08-15T10:20:30.000Z");

function issuePaths(
	result: ReturnType<typeof adminOverviewQuerySchema.safeParse>,
) {
	return result.success
		? []
		: result.error.issues.map((issue) => issue.path.join("."));
}

describe("admin dashboard range query validation", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps the overview query date-only and gives analytics extended defaults", () => {
		expect(adminAnalyticsQuerySchema).not.toBe(adminOverviewQuerySchema);
		expect(adminOverviewQuerySchema.parse({})).toEqual({ range: "30d" });
		expect(adminAnalyticsQuerySchema.parse({})).toEqual({
			range: "30d",
			cohortOnly: false,
		});
		expect(adminSignupStatsRanges).toEqual(["7d", "30d", "90d"]);
	});

	it("accepts all presets and ignores valid stale custom dates", () => {
		for (const range of ["7d", "30d", "90d", "180d", "365d"] as const) {
			expect(
				adminOverviewQuerySchema.parse({
					range,
					from: "2099-01-01",
					to: "2000-01-01",
				}),
			).toEqual({ range, from: "2099-01-01", to: "2000-01-01" });
		}
	});

	it("requires both custom date fields with field-specific issues", () => {
		const missingBoth = adminOverviewQuerySchema.safeParse({ range: "custom" });
		const missingFrom = adminOverviewQuerySchema.safeParse({
			range: "custom",
			to: "2026-08-15",
		});
		const missingTo = adminOverviewQuerySchema.safeParse({
			range: "custom",
			from: "2026-08-01",
		});

		expect(issuePaths(missingBoth)).toEqual(["from", "to"]);
		expect(issuePaths(missingFrom)).toEqual(["from"]);
		expect(issuePaths(missingTo)).toEqual(["to"]);
	});

	it("rejects reversed, future, malformed, and more-than-731-date custom ranges", () => {
		const cases = [
			{ range: "custom", from: "2026-08-10", to: "2026-08-09" },
			{ range: "custom", from: "2026-08-10", to: "2026-08-16" },
			{ range: "custom", from: "2026/08/10", to: "2026-08-15" },
			{ range: "custom", from: "2023-12-31", to: "2025-12-31" },
		] as const;

		for (const query of cases) {
			const result = adminOverviewQuerySchema.safeParse(query);
			expect(result.success).toBe(false);
			expect(issuePaths(result)).toContain(
				query.from.includes("/") ? "from" : "to",
			);
		}
	});

	it("accepts exactly 731 inclusive dates", () => {
		expect(
			adminOverviewQuerySchema.safeParse({
				range: "custom",
				from: "2024-01-01",
				to: "2025-12-31",
			}).success,
		).toBe(true);
	});

	it("keeps invalid custom queries on the current HTTP 400 path", () => {
		const pipe = new ZodValidationPipe(adminOverviewQuerySchema);

		try {
			pipe.transform(
				{ range: "custom", from: "2026-08-10", to: "2026-08-16" },
				{ type: "query" },
			);
			throw new Error("Expected custom query validation to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(BadRequestException);
			const badRequest = error as BadRequestException;
			expect(badRequest.getStatus()).toBe(400);
			expect(badRequest.getResponse()).toMatchObject({
				issues: [expect.objectContaining({ path: ["to"] })],
				message: "Validation failed",
			});
		}
	});
});

describe("resolveAdminDashboardRange", () => {
	it.each([
		["7d", "2026-08-09T00:00:00.000Z", "Last 7 days"],
		["30d", "2026-07-17T00:00:00.000Z", "Last 30 days"],
		["90d", "2026-05-18T00:00:00.000Z", "Last 90 days"],
		["180d", "2026-02-17T00:00:00.000Z", "Last 6 months"],
		["365d", "2025-08-16T00:00:00.000Z", "Last year"],
	] as const)("resolves %s to exact preset bounds", (range, rangeStart, rangeLabel) => {
		const resolved = resolveAdminDashboardRange({ range }, NOW);

		expect(resolved.rangeLabel).toBe(rangeLabel);
		expect(resolved.bounds).toEqual({
			rangeStart: new Date(rangeStart),
			rangeEnd: NOW,
			seriesEnd: new Date("2026-08-15T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
	});

	it("uses an exclusive midnight end for a past custom range", () => {
		const resolved = resolveAdminDashboardRange(
			{ range: "custom", from: "2026-06-01", to: "2026-06-03" },
			NOW,
		);

		expect(resolved.rangeLabel).toBe("Jun 1, 2026 – Jun 3, 2026");
		expect(resolved.bounds).toEqual({
			rangeStart: new Date("2026-06-01T00:00:00.000Z"),
			rangeEnd: new Date("2026-06-04T00:00:00.000Z"),
			seriesEnd: new Date("2026-06-03T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
	});

	it("caps a custom range ending today at the snapshot time", () => {
		const resolved = resolveAdminDashboardRange(
			{ range: "custom", from: "2026-08-10", to: "2026-08-15" },
			NOW,
		);

		expect(resolved.bounds).toEqual({
			rangeStart: new Date("2026-08-10T00:00:00.000Z"),
			rangeEnd: NOW,
			seriesEnd: new Date("2026-08-15T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
	});
});
