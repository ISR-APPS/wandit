import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AffiliateAdminRepository } from "./affiliate-admin.repository";
import { AffiliatesRepository } from "./affiliates.repository";

const RAW_TIMESTAMP = "2026-08-11 14:19:56.267+00";
const TIMESTAMP = new Date("2026-08-11T14:19:56.267Z");

type TimestampExpression = {
	decoder: { mapFromDriverValue(value: unknown): unknown };
};

type AggregateFactories = {
	affiliateAggregateColumns(): { lastConversionAt: TimestampExpression };
	linkAggregateColumns(): { lastConversionAt: TimestampExpression };
};

function expectTimestampDecoder(expression: TimestampExpression): void {
	expect(expression.decoder.mapFromDriverValue(RAW_TIMESTAMP)).toEqual(
		TIMESTAMP,
	);
}

function selectBuilder(
	rows: unknown[],
	terminal: "limit" | "offset" | "where",
) {
	const builder = {
		from: vi.fn(),
		groupBy: vi.fn(),
		innerJoin: vi.fn(),
		leftJoin: vi.fn(),
		limit: vi.fn(),
		offset: vi.fn(),
		orderBy: vi.fn(),
		where: vi.fn(),
	};

	builder.from.mockReturnValue(builder);
	builder.groupBy.mockReturnValue(builder);
	builder.innerJoin.mockReturnValue(builder);
	builder.leftJoin.mockReturnValue(builder);
	builder.limit.mockReturnValue(builder);
	builder.offset.mockReturnValue(builder);
	builder.orderBy.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);
	builder[terminal].mockResolvedValue(rows);

	return builder;
}

describe("affiliate timestamp aggregate decoders", () => {
	it("decodes affiliate and link conversion aggregates", () => {
		const repository = new AffiliateAdminRepository({} as Database);
		const factories = repository as unknown as AggregateFactories;

		expectTimestampDecoder(
			factories.affiliateAggregateColumns().lastConversionAt,
		);
		expectTimestampDecoder(factories.linkAggregateColumns().lastConversionAt);
	});

	it("decodes attribution first and last paid aggregates", async () => {
		const selections: Array<Record<string, unknown>> = [];
		const select = vi.fn((selection: Record<string, unknown>) => {
			selections.push(selection);

			return "total" in selection
				? selectBuilder([{ total: 0 }], "where")
				: selectBuilder([], "offset");
		});
		const repository = new AffiliateAdminRepository({
			select,
		} as unknown as Database);

		await repository.listAttributions("affiliate_1", {
			fraud: "all",
			page: 1,
			pageSize: 20,
		});

		const selection = selections.find(
			(candidate) => "firstPaidAt" in candidate,
		);
		expect(selection).toBeDefined();
		expectTimestampDecoder(selection?.firstPaidAt as TimestampExpression);
		expectTimestampDecoder(selection?.lastPaidAt as TimestampExpression);
	});

	it("decodes the oldest paid candidate aggregate", async () => {
		let selection: Record<string, unknown> | undefined;
		const select = vi.fn((fields: Record<string, unknown>) => {
			selection = fields;

			return selectBuilder([], "limit");
		});
		const repository = new AffiliatesRepository({
			select,
		} as unknown as Database);

		await repository.listPendingAttributedCandidateUserIds();

		expect(selection).toBeDefined();
		expectTimestampDecoder(selection?.oldestPaidAt as TimestampExpression);
	});
});
