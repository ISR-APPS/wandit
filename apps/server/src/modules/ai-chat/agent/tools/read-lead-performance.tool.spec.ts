import {
	type ReadLeadPerformanceOutput,
	readLeadPerformanceOutputSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type {
	LeadFunnelCountRow,
	LeadsRepository,
} from "../../../leads/infrastructure/persistence/leads.repository";
import {
	algiersDayStart,
	algiersOffsetMs,
	computeLeadFunnelRates,
	createReadLeadPerformanceTool,
	NO_UTM_CAMPAIGN_KEY,
	READ_LEAD_PERFORMANCE_GROUP_LIMIT,
} from "./read-lead-performance.tool";

const NOW = new Date("2026-08-19T10:30:00.000Z");

function row(
	key: string | null,
	counts: Partial<Omit<LeadFunnelCountRow, "key">> = {},
): LeadFunnelCountRow {
	const filled = {
		cancelled: 0,
		confirmed: 0,
		delivered: 0,
		returned: 0,
		shipped: 0,
		to_confirm: 0,
		...counts,
	};
	const total =
		counts.total ??
		filled.cancelled +
			filled.confirmed +
			filled.delivered +
			filled.returned +
			filled.shipped +
			filled.to_confirm;

	return { key, ...filled, total };
}

// Mirrors the repository's sanity cap so the spec cannot pass with a probe
// the real query would clamp away.
const REPOSITORY_FUNNEL_GROUP_LIMIT_MAX = 200;

/**
 * Fake repository: the ungrouped read answers `totals` (one row, key null;
 * computed from the grouped rows unless given), the grouped read answers
 * `grouped` cut to the requested limit, clamped like the real repository.
 */
function setup(grouped: LeadFunnelCountRow[], totals?: LeadFunnelCountRow) {
	const totalsRow =
		totals ??
		row(
			null,
			grouped.reduce(
				(acc, current) => ({
					cancelled: acc.cancelled + current.cancelled,
					confirmed: acc.confirmed + current.confirmed,
					delivered: acc.delivered + current.delivered,
					returned: acc.returned + current.returned,
					shipped: acc.shipped + current.shipped,
					to_confirm: acc.to_confirm + current.to_confirm,
				}),
				{
					cancelled: 0,
					confirmed: 0,
					delivered: 0,
					returned: 0,
					shipped: 0,
					to_confirm: 0,
				},
			),
		);
	const getFunnelCountsForProject = vi.fn(
		async (
			_projectId: string,
			options: Parameters<LeadsRepository["getFunnelCountsForProject"]>[1],
		): Promise<LeadFunnelCountRow[]> => {
			if (options.groupBy === "none") {
				return [totalsRow];
			}
			const limit = Math.min(
				REPOSITORY_FUNNEL_GROUP_LIMIT_MAX,
				Math.max(1, options.limit ?? REPOSITORY_FUNNEL_GROUP_LIMIT_MAX),
			);

			return grouped.slice(0, limit);
		},
	);
	const run = createReadLeadPerformanceTool({
		leadsRepository: { getFunnelCountsForProject },
		now: () => NOW,
		projectId: "project_1",
	}).execute;

	if (!run) {
		throw new Error("read_lead_performance tool must have execute");
	}

	return {
		execute: (input: Parameters<typeof run>[0]) =>
			run(input, {
				messages: [],
				toolCallId: "call_1",
			} as unknown as Parameters<
				typeof run
			>[1]) as Promise<ReadLeadPerformanceOutput>,
		getFunnelCountsForProject,
	};
}

describe("computeLeadFunnelRates", () => {
	it("counts every post-confirmation status as confirmed over all leads", () => {
		const rates = computeLeadFunnelRates({
			cancelled: 2,
			confirmed: 1,
			delivered: 3,
			returned: 1,
			shipped: 1,
			to_confirm: 2,
			total: 10,
		});

		expect(rates.confirmationRate).toBe(0.6);
		expect(rates.deliveryRate).toBe(0.6);
		expect(rates.returnRate).toBe(0.2);
	});

	it("answers null rates when a denominator is zero", () => {
		expect(
			computeLeadFunnelRates({
				cancelled: 0,
				confirmed: 0,
				delivered: 0,
				returned: 0,
				shipped: 0,
				to_confirm: 0,
				total: 0,
			}),
		).toEqual({
			confirmationRate: null,
			deliveryRate: null,
			returnRate: null,
		});
		expect(
			computeLeadFunnelRates({
				cancelled: 1,
				confirmed: 3,
				delivered: 0,
				returned: 0,
				shipped: 0,
				to_confirm: 1,
				total: 5,
			}),
		).toEqual({
			confirmationRate: 0.6,
			deliveryRate: null,
			returnRate: null,
		});
	});
});

describe("algiersDayStart", () => {
	it("reads Africa/Algiers as UTC+1", () => {
		expect(algiersOffsetMs(NOW)).toBe(3_600_000);
	});

	it("starts the window at Algiers midnight N days before today", () => {
		// 2026-08-19 11:30 Algiers → 30 days back = 2026-07-20 00:00 Algiers.
		expect(algiersDayStart(NOW, 30).toISOString()).toBe(
			"2026-07-19T23:00:00.000Z",
		);
		expect(algiersDayStart(NOW, 0).toISOString()).toBe(
			"2026-08-18T23:00:00.000Z",
		);
	});

	it("uses the Algiers calendar day, not the UTC one, near midnight", () => {
		// 23:30 UTC is already 00:30 the next day in Algiers.
		const lateUtc = new Date("2026-08-19T23:30:00.000Z");

		expect(algiersDayStart(lateUtc, 0).toISOString()).toBe(
			"2026-08-19T23:00:00.000Z",
		);
	});
});

describe("read_lead_performance tool", () => {
	it("defaults to 30 days grouped by source and shapes totals + rates", async () => {
		const { execute, getFunnelCountsForProject } = setup([
			row("facebook", {
				cancelled: 1,
				confirmed: 2,
				delivered: 4,
				returned: 1,
				shipped: 1,
				to_confirm: 1,
			}),
			row("direct", { cancelled: 1, confirmed: 1, to_confirm: 2 }),
		]);

		const output = await execute({});

		expect(getFunnelCountsForProject).toHaveBeenCalledTimes(2);
		expect(getFunnelCountsForProject).toHaveBeenCalledWith("project_1", {
			from: new Date("2026-07-19T23:00:00.000Z"),
			groupBy: "none",
			to: NOW,
		});
		expect(getFunnelCountsForProject).toHaveBeenCalledWith("project_1", {
			from: new Date("2026-07-19T23:00:00.000Z"),
			groupBy: "source",
			limit: READ_LEAD_PERFORMANCE_GROUP_LIMIT + 1,
			to: NOW,
		});
		expect(readLeadPerformanceOutputSchema.parse(output)).toEqual(output);
		expect(output.windowDays).toBe(30);
		expect(output.from).toBe("2026-07-19T23:00:00.000Z");
		expect(output.to).toBe(NOW.toISOString());
		expect(output.totals).toEqual({
			cancelled: 2,
			confirmationRate: 9 / 14,
			confirmed: 3,
			deliveryRate: 4 / 6,
			delivered: 4,
			returnRate: 1 / 6,
			returned: 1,
			shipped: 1,
			to_confirm: 3,
			total: 14,
		});
		expect(output.groups).toEqual([
			{
				cancelled: 1,
				confirmed: 2,
				delivered: 4,
				key: "facebook",
				returned: 1,
				shipped: 1,
				to_confirm: 1,
				total: 10,
			},
			{
				cancelled: 1,
				confirmed: 1,
				delivered: 0,
				key: "direct",
				returned: 0,
				shipped: 0,
				to_confirm: 2,
				total: 4,
			},
		]);
		expect(output.note).toContain("archived leads excluded");
		expect(output.note).toContain(
			"30 full Africa/Algiers days before today, plus today so far",
		);
		expect(output.note).not.toContain("biggest groups");
		expect(output.note).toContain("confirmationRate = (confirmed + shipped");
	});

	it("labels leads without a utm_campaign and honors the window", async () => {
		const { execute, getFunnelCountsForProject } = setup([
			row(null, { to_confirm: 3 }),
			row("summer-sale", { confirmed: 1 }),
		]);

		const output = await execute({ days: 7, groupBy: "campaign" });

		expect(getFunnelCountsForProject).toHaveBeenCalledWith(
			"project_1",
			expect.objectContaining({
				from: new Date("2026-08-11T23:00:00.000Z"),
				groupBy: "campaign",
			}),
		);
		expect(output.windowDays).toBe(7);
		expect(output.groups.map((group) => group.key)).toEqual([
			NO_UTM_CAMPAIGN_KEY,
			"summer-sale",
		]);
		expect(output.note).toContain(NO_UTM_CAMPAIGN_KEY);
	});

	it("returns no groups for groupBy none and reads the totals once", async () => {
		const { execute, getFunnelCountsForProject } = setup(
			[],
			row(null, { confirmed: 2, to_confirm: 2 }),
		);

		const output = await execute({ groupBy: "none" });

		expect(getFunnelCountsForProject).toHaveBeenCalledTimes(1);
		expect(getFunnelCountsForProject).toHaveBeenCalledWith("project_1", {
			from: new Date("2026-07-19T23:00:00.000Z"),
			groupBy: "none",
			to: NOW,
		});
		expect(output.groups).toEqual([]);
		expect(output.totals.total).toBe(4);
		expect(output.totals.confirmationRate).toBe(0.5);
		expect(output.note).toContain("Totals only");
	});

	it("answers zero totals and null rates for a project without leads", async () => {
		const { execute } = setup([]);

		const output = await execute({ groupBy: "status" });

		expect(output.totals).toEqual({
			cancelled: 0,
			confirmationRate: null,
			confirmed: 0,
			deliveryRate: null,
			delivered: 0,
			returnRate: null,
			returned: 0,
			shipped: 0,
			to_confirm: 0,
			total: 0,
		});
		expect(output.groups).toEqual([]);
	});

	it("caps groups at 50, flags truncation, and keeps exact totals from the ungrouped read", async () => {
		// 60 campaigns: the probe (limit 51) must come back with 51 rows even
		// though the repository clamps — so the clamp must sit above 51.
		const many = Array.from({ length: 60 }, (_, index) =>
			row(`campaign-${index}`, { to_confirm: 60 - index }),
		);
		const { execute, getFunnelCountsForProject } = setup(many);

		const output = await execute({ groupBy: "campaign" });

		expect(output.groups).toHaveLength(READ_LEAD_PERFORMANCE_GROUP_LIMIT);
		expect(output.groups[0]?.key).toBe("campaign-0");
		expect(output.groups.at(-1)?.key).toBe("campaign-49");
		// 60 + 59 + ... + 1, not the sum of the 50 listed groups.
		expect(output.totals.total).toBe(1_830);
		expect(getFunnelCountsForProject).toHaveBeenCalledTimes(2);
		expect(getFunnelCountsForProject).toHaveBeenCalledWith("project_1", {
			from: new Date("2026-07-19T23:00:00.000Z"),
			groupBy: "campaign",
			limit: READ_LEAD_PERFORMANCE_GROUP_LIMIT + 1,
			to: NOW,
		});
		expect(output.note).toContain("biggest groups");
	});

	it("does not flag truncation at exactly 50 groups", async () => {
		const exact = Array.from({ length: 50 }, (_, index) =>
			row(`campaign-${index}`, { to_confirm: 1 }),
		);
		const { execute } = setup(exact);

		const output = await execute({ groupBy: "campaign" });

		expect(output.groups).toHaveLength(50);
		expect(output.totals.total).toBe(50);
		expect(output.note).not.toContain("biggest groups");
	});

	it("describes the window as N full Algiers days plus today so far", async () => {
		const { execute } = setup([]);

		const output = await execute({ days: 7, groupBy: "status" });

		expect(output.note).toContain(
			"7 full Africa/Algiers days before today, plus today so far",
		);
	});
});
