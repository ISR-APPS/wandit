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

function setupStats(rows: unknown[][] = [[statsLinkExecuteRow()], [], [], []]) {
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

function setupSignups(rows: unknown[] = []) {
	const execute = vi.fn(async (_query: unknown) => ({ rows }));
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

function statsLinkExecuteRow(overrides: Record<string, unknown> = {}) {
	return {
		all_time_clicks: "14",
		archived_at: "2026-08-03T09:00:00.000Z",
		clicks_in_range: 4n,
		created_at: "2026-08-01T12:00:00.000Z",
		destination_path: "/pricing",
		id: STORY_LINK_ID,
		name: "August launch",
		slug: "august-launch",
		unique_visitors_in_range: 3,
		updated_at: "2026-08-02T12:00:00.000Z",
		utm_campaign: "august-launch",
		utm_content: "hero",
		utm_medium: "story",
		utm_source: "instagram",
		...overrides,
	};
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

describe("StoryLinkAdminRepository per-link stats SQL", () => {
	it("reads the complete detail snapshot in a read-only repeatable-read transaction", async () => {
		const { execute, repository, transaction } = setupStats();

		await repository.getStats(STORY_LINK_ID, RANGE_BOUNDS);

		expect(transaction).toHaveBeenCalledOnce();
		expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
			accessMode: "read only",
			isolationLevel: "repeatable read",
		});
		expect(execute).toHaveBeenCalledTimes(4);

		for (const [query] of execute.mock.calls) {
			expect(compileQuery(query).params.slice(0, 5)).toEqual([
				RANGE_BOUNDS.rangeStart,
				RANGE_BOUNDS.rangeEnd,
				RANGE_BOUNDS.seriesEnd,
				RANGE_BOUNDS.snapshotEnd,
				STORY_LINK_ID,
			]);
		}
	});

	it("returns a nullable link and stops the remaining snapshot reads when it is absent", async () => {
		const { execute, repository } = setupStats([[]]);

		await expect(
			repository.getStats(STORY_LINK_ID, RANGE_BOUNDS),
		).resolves.toEqual({
			clicks: { allTime: 0, inRange: 0, uniqueInRange: 0 },
			clicksByDay: [],
			conversion: {
				activatedUsers: 0,
				convertedToPaid: 0,
				liveSubscriptions: 0,
				revenueUsdCents: 0,
			},
			link: null,
			signups: { allTime: 0, inRange: 0 },
		});
		expect(execute).toHaveBeenCalledOnce();
	});

	it("bounds this link's click totals and zero-filled UTC daily series", async () => {
		const { execute, repository } = setupStats();

		await repository.getStats(STORY_LINK_ID, RANGE_BOUNDS);
		const totalsQuery = compileQuery(execute.mock.calls[0]?.[0]);
		const dailyQuery = compileQuery(execute.mock.calls[1]?.[0]);

		expect(totalsQuery.sql).toContain("from story_links l");
		expect(totalsQuery.sql).toContain("where l.id = $5");
		expect(totalsQuery.sql).not.toContain("l.archived_at is null");
		expect(totalsQuery.sql).toContain("c.story_link_id = l.id");
		expect(totalsQuery.sql).toContain("c.created_at >= b.range_start");
		expect(totalsQuery.sql).toContain("c.created_at < b.range_end");
		expect(totalsQuery.sql).toContain("count(distinct c.ip_hash)");
		expect(totalsQuery.sql).toContain("c.created_at < b.snapshot_end");

		expect(dailyQuery.sql).toContain(
			"generate_series( b.range_start, b.series_end, interval '1 day' )",
		);
		expect(dailyQuery.sql).toContain("where c.story_link_id = $5");
		expect(dailyQuery.sql).toContain("coalesce(c.clicks, 0)");
		expect(dailyQuery.sql).toContain("order by d.day asc");
	});

	it("recovers the historical NULL-slug cohort with an exact tuple and deterministic winner", async () => {
		const { execute, repository } = setupStats();

		await repository.getStats(STORY_LINK_ID, RANGE_BOUNDS);
		const signupQuery = compileQuery(execute.mock.calls[2]?.[0]);

		expect(signupQuery.sql).toContain("ua.story_link_slug = l.slug");
		expect(signupQuery.sql).toContain("ua.story_link_slug is null");
		expect(signupQuery.sql).toContain("ua.utm_source = l.utm_source");
		expect(signupQuery.sql).toContain("ua.utm_medium = l.utm_medium");
		expect(signupQuery.sql).toContain("ua.utm_campaign = l.utm_campaign");
		expect(signupQuery.sql).toContain(
			"ua.utm_content is not distinct from l.utm_content",
		);
		expect(signupQuery.sql).toContain(
			"l2.utm_content is not distinct from l.utm_content",
		);
		expect(signupQuery.sql).toContain(
			"order by l2.created_at asc, l2.id asc limit 1",
		);
		expect(signupQuery.sql).toContain("count(distinct c.user_id)");
		expect(signupQuery.sql).toContain("c.created_at >= b.range_start");
		expect(signupQuery.sql).toContain("c.created_at < b.range_end");
		expect(signupQuery.sql).toContain("c.created_at < b.snapshot_end");
	});

	it("mirrors funnel activation, human subscription attribution, and positive cash policies", async () => {
		const { execute, repository } = setupStats();

		await repository.getStats(STORY_LINK_ID, RANGE_BOUNDS);
		const conversionQuery = compileQuery(execute.mock.calls[3]?.[0]);

		for (const source of [
			"page_generation_attempts",
			"image_generation_attempts",
			"marketing_assets",
			"lead_scrape_attempts",
			"connector_generation_attempts",
		]) {
			expect(conversionQuery.sql).toContain(`from ${source} a`);
		}
		expect(conversionQuery.sql).toContain("where a.status = 'succeeded'");
		expect(conversionQuery.sql).toContain("a.created_at < b.snapshot_end");
		expect(conversionQuery.sql).toContain(
			"left join organization_billing_customers obc on obc.organization_id = s.organization_id",
		);
		expect(conversionQuery.sql).toContain(
			"when s.organization_id is null then s.user_id else obc.attribution_user_id",
		);
		expect(conversionQuery.sql).toContain("a.paid_at is not null");
		expect(conversionQuery.sql).toContain("a.amount_paid_minor > 0");
		expect(conversionQuery.sql).toContain("m.amount_minor > 0");
		expect(conversionQuery.sql).toContain("lower(a.currency) = 'usd'");
		expect(conversionQuery.sql).toContain("lower(m.currency) = 'usd'");
	});

	it("normalizes raw timestamps and all PostgreSQL numeric count forms", async () => {
		const { repository } = setupStats([
			[statsLinkExecuteRow()],
			[{ clicks: "4", date: "2026-06-01" }],
			[{ all_time: 7n, in_range: "2" }],
			[
				{
					activated_users: "5",
					converted_to_paid: 3n,
					live_subscriptions: 2,
					revenue_usd_cents: "12900",
				},
			],
		]);

		const snapshot = await repository.getStats(STORY_LINK_ID, RANGE_BOUNDS);

		expect(snapshot).toEqual({
			clicks: { allTime: 14, inRange: 4, uniqueInRange: 3 },
			clicksByDay: [{ clicks: 4, date: "2026-06-01" }],
			conversion: {
				activatedUsers: 5,
				convertedToPaid: 3,
				liveSubscriptions: 2,
				revenueUsdCents: 12900,
			},
			link: {
				archivedAt: new Date("2026-08-03T09:00:00.000Z"),
				createdAt: new Date("2026-08-01T12:00:00.000Z"),
				destinationPath: "/pricing",
				id: STORY_LINK_ID,
				name: "August launch",
				slug: "august-launch",
				updatedAt: new Date("2026-08-02T12:00:00.000Z"),
				utmCampaign: "august-launch",
				utmContent: "hero",
				utmMedium: "story",
				utmSource: "instagram",
			},
			signups: { allTime: 7, inRange: 2 },
		});
		expect(snapshot.link?.createdAt).toBeInstanceOf(Date);
	});
});

describe("StoryLinkAdminRepository paginated signups SQL", () => {
	it("slices page two while counting the whole bounded cohort and paid state only for the page", async () => {
		const { execute, repository, transaction } = setupSignups([
			{
				converted_to_paid: true,
				email: "ada@example.com",
				image: null,
				name: "Ada Lovelace",
				signed_up_at: "2026-08-14T09:30:00.000Z",
				total: "12",
				user_id: "user_ada",
			},
		]);

		const page = await repository.listSignups(STORY_LINK_ID, RANGE_BOUNDS, {
			page: 2,
			pageSize: 10,
		});
		const query = compileQuery(execute.mock.calls[0]?.[0]);

		expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
			accessMode: "read only",
			isolationLevel: "repeatable read",
		});
		expect(execute).toHaveBeenCalledOnce();
		expect(query.params).toEqual([
			RANGE_BOUNDS.rangeStart,
			RANGE_BOUNDS.rangeEnd,
			RANGE_BOUNDS.seriesEnd,
			RANGE_BOUNDS.snapshotEnd,
			STORY_LINK_ID,
			10,
			10,
		]);
		expect(query.sql).toContain("ua.story_link_slug = l.slug");
		expect(query.sql).toContain("ua.story_link_slug is null");
		expect(query.sql).toContain("ua.utm_source = l.utm_source");
		expect(query.sql).toContain("ua.utm_medium = l.utm_medium");
		expect(query.sql).toContain("ua.utm_campaign = l.utm_campaign");
		expect(query.sql).toContain(
			"ua.utm_content is not distinct from l.utm_content",
		);
		expect(query.sql).toContain(
			"order by l2.created_at asc, l2.id asc limit 1",
		);
		expect(query.sql).toContain("where c.created_at < b.snapshot_end");
		expect(query.sql).toContain(
			"cohort_count as ( select count(*)::bigint as total from bounded_cohort )",
		);
		expect(query.sql).toContain(
			"order by c.created_at desc, c.user_id desc limit $6 offset $7",
		);
		expect(query.sql).toContain("inner join paged_cohort c");
		expect(query.sql).toContain("s.created_at < b.snapshot_end");
		expect(query.sql).toContain("from cohort_count n left join paged_cohort c");
		for (const fragment of [
			"from billing_invoice_applications a",
			"a.paid_at is not null",
			"a.amount_paid_minor > 0",
			"a.paid_at < b.snapshot_end",
			"from manual_subscription_payments m",
			"m.amount_minor > 0",
			"m.created_at < b.snapshot_end",
		]) {
			expect(query.sql).toContain(fragment);
		}
		expect(page).toEqual({
			items: [
				{
					convertedToPaid: true,
					email: "ada@example.com",
					image: null,
					name: "Ada Lovelace",
					signedUpAt: new Date("2026-08-14T09:30:00.000Z"),
					userId: "user_ada",
				},
			],
			page: 2,
			pageSize: 10,
			total: 12,
		});
		expect(page.items[0]?.signedUpAt).toBeInstanceOf(Date);
	});

	it("preserves the cohort total on an empty page past the end", async () => {
		const { repository } = setupSignups([
			{
				converted_to_paid: false,
				email: null,
				image: null,
				name: null,
				signed_up_at: null,
				total: 12n,
				user_id: null,
			},
		]);

		await expect(
			repository.listSignups(STORY_LINK_ID, RANGE_BOUNDS, {
				page: 3,
				pageSize: 10,
			}),
		).resolves.toEqual({
			items: [],
			page: 3,
			pageSize: 10,
			total: 12,
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
