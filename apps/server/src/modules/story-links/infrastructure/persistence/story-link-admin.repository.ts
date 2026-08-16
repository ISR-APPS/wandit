import { Inject, Injectable } from "@nestjs/common";
import type { CreateStoryLinkInput } from "@wandit/contracts";
import { eq, sql } from "@wandit/db";
import { storyLinks } from "@wandit/db/schema/story-links";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { AdminDashboardRangeBounds } from "../../../admin/application/services/admin-dashboard-range";

type NumericValue = bigint | number | string | null;

type StoryLinkAdminDbClient = Pick<Database, "execute">;

type StoryLinkStatsRow = {
	id: string;
	slug: string;
	name: string;
	utm_source: string;
	utm_medium: string;
	utm_campaign: string;
	utm_content: string | null;
	destination_path: string;
	archived_at: Date | null;
	created_at: Date;
	updated_at: Date;
	clicks_in_range: NumericValue;
	unique_visitors_in_range: NumericValue;
	all_time_clicks: NumericValue;
};

type StoryLinkClicksByDayRow = {
	date: string;
	clicks: NumericValue;
};

export type StoryLinkAdminRow = typeof storyLinks.$inferSelect;

export type StoryLinkAdminListRecord = {
	link: StoryLinkAdminRow;
	clicksInRange: number;
	uniqueVisitorsInRange: number;
	allTimeClicks: number;
};

export type StoryLinkAdminSnapshot = {
	links: StoryLinkAdminListRecord[];
	clicksByDay: Array<{ date: string; clicks: number }>;
};

export type StoryLinkAdminUpdate = {
	name?: string;
	archivedAt?: Date | null;
};

@Injectable()
export class StoryLinkAdminRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async list(
		input: AdminDashboardRangeBounds,
	): Promise<StoryLinkAdminSnapshot> {
		return this.db.transaction(async (transaction) => {
			const links = await this.listLinks(transaction, input);
			const clicksByDay = await this.listClicksByDay(transaction, input);

			return { links, clicksByDay };
		}, READ_ONLY_TRANSACTION);
	}

	async create(input: CreateStoryLinkInput): Promise<StoryLinkAdminRow> {
		const [row] = await this.db
			.insert(storyLinks)
			.values({
				destinationPath: input.destinationPath ?? "/",
				name: input.name,
				slug: input.slug,
				utmCampaign: input.utmCampaign,
				utmContent: input.utmContent ?? null,
				utmMedium: input.utmMedium,
				utmSource: input.utmSource,
			})
			.returning();

		if (!row) {
			throw new Error("Story link insert did not return a row");
		}

		return row;
	}

	async update(
		id: string,
		input: StoryLinkAdminUpdate,
	): Promise<StoryLinkAdminRow | null> {
		const [row] = await this.db
			.update(storyLinks)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(storyLinks.id, id))
			.returning();

		return row ?? null;
	}

	private async listLinks(
		client: StoryLinkAdminDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<StoryLinkAdminListRecord[]> {
		const result = await client.execute<StoryLinkStatsRow>(sql`
			with bounds as (${storyLinkBounds(input)})
			select
				l.id,
				l.slug,
				l.name,
				l.utm_source,
				l.utm_medium,
				l.utm_campaign,
				l.utm_content,
				l.destination_path,
				l.archived_at,
				l.created_at,
				l.updated_at,
				coalesce(r.clicks_in_range, 0)::bigint as clicks_in_range,
				coalesce(r.unique_visitors_in_range, 0)::bigint as unique_visitors_in_range,
				coalesce(a.all_time_clicks, 0)::bigint as all_time_clicks
			from story_links l
			cross join bounds b
			left join lateral (
				select
					count(*)::bigint as clicks_in_range,
					count(distinct c.ip_hash)::bigint as unique_visitors_in_range
				from story_link_clicks c
				where c.story_link_id = l.id
					and c.created_at >= b.range_start
					and c.created_at < b.range_end
			) r on true
			left join lateral (
				select count(*)::bigint as all_time_clicks
				from story_link_clicks c
				where c.story_link_id = l.id
					and c.created_at < b.snapshot_end
			) a on true
			where l.created_at < b.snapshot_end
			order by l.created_at desc, l.id desc
		`);

		return result.rows.map((row) => ({
			link: {
				archivedAt: row.archived_at,
				createdAt: row.created_at,
				destinationPath: row.destination_path,
				id: row.id,
				name: row.name,
				slug: row.slug,
				updatedAt: row.updated_at,
				utmCampaign: row.utm_campaign,
				utmContent: row.utm_content,
				utmMedium: row.utm_medium,
				utmSource: row.utm_source,
			},
			allTimeClicks: toNumber(row.all_time_clicks),
			clicksInRange: toNumber(row.clicks_in_range),
			uniqueVisitorsInRange: toNumber(row.unique_visitors_in_range),
		}));
	}

	private async listClicksByDay(
		client: StoryLinkAdminDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<Array<{ date: string; clicks: number }>> {
		const result = await client.execute<StoryLinkClicksByDayRow>(sql`
			with bounds as (${storyLinkBounds(input)}),
			days as (
				select generate_series(
					b.range_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			daily as (
				select
					(c.created_at at time zone 'UTC')::date as day,
					count(*)::bigint as clicks
				from story_link_clicks c
				cross join bounds b
				where c.created_at >= b.range_start
					and c.created_at < b.range_end
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(c.clicks, 0)::bigint as clicks
			from days d
			left join daily c on c.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		return result.rows.map((row) => ({
			clicks: toNumber(row.clicks),
			date: String(row.date),
		}));
	}
}

const READ_ONLY_TRANSACTION = {
	accessMode: "read only" as const,
	isolationLevel: "repeatable read" as const,
};

function storyLinkBounds(input: AdminDashboardRangeBounds) {
	return sql`
		select
			${input.rangeStart}::timestamptz as range_start,
			${input.rangeEnd}::timestamptz as range_end,
			${input.seriesEnd}::timestamptz as series_end,
			${input.snapshotEnd}::timestamptz as snapshot_end
	`;
}

function toNumber(value: NumericValue | undefined): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}
