import { storyLinks } from "@wandit/db/schema/story-links";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { StoryLinkAdminRepository } from "./story-link-admin.repository";

const STORY_LINK_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-15T10:20:30.000Z");
const RANGE_BOUNDS = {
	rangeEnd: new Date("2026-06-04T00:00:00.000Z"),
	rangeStart: new Date("2026-06-01T00:00:00.000Z"),
	seriesEnd: new Date("2026-06-03T00:00:00.000Z"),
	snapshotEnd: NOW,
};

type SqlQuery = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

function compileQuery(query: unknown) {
	if (
		typeof query !== "object" ||
		query === null ||
		!("toQuery" in query) ||
		typeof query.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL query");
	}

	const { params, sql } = (query as SqlQuery).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
}

function setupList(rows: unknown[][] = [[], []]) {
	let call = 0;
	const execute = vi.fn(async (_query: unknown) => ({
		rows: rows[call++] ?? [],
	}));
	const transaction = vi.fn(
		(
			callback: (client: { execute: typeof execute }) => Promise<unknown>,
			_options: unknown,
		) => callback({ execute }),
	);
	const repository = new StoryLinkAdminRepository({
		transaction,
	} as unknown as Database);

	return { execute, repository, transaction };
}

describe("StoryLinkAdminRepository list SQL", () => {
	it("reads one consistent snapshot in a read-only repeatable-read transaction", async () => {
		const { execute, repository, transaction } = setupList();

		await repository.list(RANGE_BOUNDS);

		expect(transaction).toHaveBeenCalledOnce();
		expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
			accessMode: "read only",
			isolationLevel: "repeatable read",
		});
		expect(execute).toHaveBeenCalledTimes(2);
	});

	it("bounds per-link stats and all-time counts on indexed click columns", async () => {
		const { execute, repository } = setupList();

		await repository.list(RANGE_BOUNDS);
		const query = compileQuery(execute.mock.calls[0]?.[0]);

		expect(query.params.slice(0, 4)).toEqual([
			RANGE_BOUNDS.rangeStart,
			RANGE_BOUNDS.rangeEnd,
			RANGE_BOUNDS.seriesEnd,
			RANGE_BOUNDS.snapshotEnd,
		]);
		expect(query.sql).toContain("from story_links l");
		expect(query.sql).not.toContain("l.archived_at is null");
		expect(query.sql).toContain("c.story_link_id = l.id");
		expect(query.sql).toContain("c.created_at >= b.range_start");
		expect(query.sql).toContain("c.created_at < b.range_end");
		expect(query.sql).toContain("count(distinct c.ip_hash)");
		expect(query.sql).toContain("c.created_at < b.snapshot_end");
		expect(query.sql).toContain("order by l.created_at desc, l.id desc");
	});

	it("zero-fills the combined daily series through the selected end date", async () => {
		const { execute, repository } = setupList();

		await repository.list(RANGE_BOUNDS);
		const query = compileQuery(execute.mock.calls[1]?.[0]);

		expect(query.sql).toContain(
			"generate_series( b.range_start, b.series_end, interval '1 day' )",
		);
		expect(query.sql).toContain("from story_link_clicks c");
		expect(query.sql).toContain("c.created_at >= b.range_start");
		expect(query.sql).toContain("c.created_at < b.range_end");
		expect(query.sql).toContain("coalesce(c.clicks, 0)");
		expect(query.sql).toContain("order by d.day asc");
	});

	it("normalizes string timestamps from raw execute rows into Dates", async () => {
		// Production regression: the driver there returns timestamptz columns as
		// ISO strings, and the service's .toISOString() crashed on the first
		// real link (TypeError: createdAt.toISOString is not a function).
		const { repository } = setupList([
			[
				{
					all_time_clicks: 0,
					archived_at: "2026-08-03T09:00:00.000Z",
					clicks_in_range: 0,
					created_at: "2026-08-01T12:00:00.000Z",
					destination_path: "/",
					id: STORY_LINK_ID,
					name: "Wandit intro",
					slug: "wandit-intro",
					unique_visitors_in_range: 0,
					updated_at: "2026-08-02T12:00:00.000Z",
					utm_campaign: "wandit-intro",
					utm_content: null,
					utm_medium: "video",
					utm_source: "youtube",
				},
			],
			[],
		]);

		const snapshot = await repository.list(RANGE_BOUNDS);
		const link = snapshot.links[0]?.link;

		expect(link?.createdAt).toBeInstanceOf(Date);
		expect(link?.createdAt.toISOString()).toBe("2026-08-01T12:00:00.000Z");
		expect(link?.updatedAt.toISOString()).toBe("2026-08-02T12:00:00.000Z");
		expect(link?.archivedAt?.toISOString()).toBe("2026-08-03T09:00:00.000Z");
	});

	it("maps PostgreSQL counts and timestamps into repository records", async () => {
		const createdAt = new Date("2026-08-01T12:00:00.000Z");
		const updatedAt = new Date("2026-08-02T12:00:00.000Z");
		const { repository } = setupList([
			[
				{
					all_time_clicks: "14",
					archived_at: null,
					clicks_in_range: 4n,
					created_at: createdAt,
					destination_path: "/pricing",
					id: STORY_LINK_ID,
					name: "August launch",
					slug: "august-launch",
					unique_visitors_in_range: 3,
					updated_at: updatedAt,
					utm_campaign: "august-launch",
					utm_content: null,
					utm_medium: "story",
					utm_source: "instagram",
				},
			],
			[{ clicks: "4", date: "2026-06-01" }],
		]);

		const snapshot = await repository.list(RANGE_BOUNDS);

		expect(snapshot).toEqual({
			clicksByDay: [{ clicks: 4, date: "2026-06-01" }],
			links: [
				{
					allTimeClicks: 14,
					clicksInRange: 4,
					link: {
						archivedAt: null,
						createdAt,
						destinationPath: "/pricing",
						id: STORY_LINK_ID,
						name: "August launch",
						slug: "august-launch",
						updatedAt,
						utmCampaign: "august-launch",
						utmContent: null,
						utmMedium: "story",
						utmSource: "instagram",
					},
					uniqueVisitorsInRange: 3,
				},
			],
		});
	});
});

describe("StoryLinkAdminRepository writes", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("applies create defaults before inserting", async () => {
		const row = {
			archivedAt: null,
			createdAt: NOW,
			destinationPath: "/",
			id: STORY_LINK_ID,
			name: "August launch",
			slug: "august-launch",
			updatedAt: NOW,
			utmCampaign: "august-launch",
			utmContent: null,
			utmMedium: "story",
			utmSource: "instagram",
		};
		const returning = vi.fn().mockResolvedValue([row]);
		const values = vi.fn(() => ({ returning }));
		const insert = vi.fn(() => ({ values }));
		const repository = new StoryLinkAdminRepository({
			insert,
		} as unknown as Database);

		await expect(
			repository.create({
				name: "August launch",
				slug: "august-launch",
				utmCampaign: "august-launch",
				utmMedium: "story",
				utmSource: "instagram",
			}),
		).resolves.toEqual(row);
		expect(insert).toHaveBeenCalledWith(storyLinks);
		expect(values).toHaveBeenCalledWith({
			destinationPath: "/",
			name: "August launch",
			slug: "august-launch",
			utmCampaign: "august-launch",
			utmContent: null,
			utmMedium: "story",
			utmSource: "instagram",
		});
	});

	it("sets update time and returns null when an id is missing", async () => {
		const returning = vi.fn().mockResolvedValue([]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const repository = new StoryLinkAdminRepository({
			update,
		} as unknown as Database);

		await expect(
			repository.update(STORY_LINK_ID, { archivedAt: NOW }),
		).resolves.toBeNull();
		expect(update).toHaveBeenCalledWith(storyLinks);
		expect(set).toHaveBeenCalledWith({ archivedAt: NOW, updatedAt: NOW });
		expect(where).toHaveBeenCalledOnce();
	});
});
