import { Inject, Injectable } from "@nestjs/common";
import type { CreateStoryLinkInput } from "@wandit/contracts";
import { eq, type SQL, sql } from "@wandit/db";
import { storyLinks } from "@wandit/db/schema/story-links";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { LIVE_SUBSCRIPTION_STATUSES } from "../../../admin/application/services/admin-analytics.metrics";
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
	// Raw `execute` rows: the production driver returns timestamptz as ISO
	// strings (node-postgres parses them to Date); normalize before mapping.
	archived_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
	clicks_in_range: NumericValue;
	unique_visitors_in_range: NumericValue;
	all_time_clicks: NumericValue;
};

type StoryLinkClicksByDayRow = {
	date: string;
	clicks: NumericValue;
};

type StoryLinkSignupStatsRow = {
	all_time: NumericValue;
	in_range: NumericValue;
};

type StoryLinkConversionStatsRow = {
	activated_users: NumericValue;
	converted_to_paid: NumericValue;
	live_subscriptions: NumericValue;
	revenue_usd_cents: NumericValue;
};

type StoryLinkSignupPageRow = {
	converted_to_paid: boolean;
	email: string | null;
	image: string | null;
	name: string | null;
	signed_up_at: Date | string | null;
	total: NumericValue;
	user_id: string | null;
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

export type StoryLinkAdminStatsSnapshot = {
	link: StoryLinkAdminRow | null;
	clicks: {
		inRange: number;
		uniqueInRange: number;
		allTime: number;
	};
	clicksByDay: Array<{ date: string; clicks: number }>;
	signups: {
		inRange: number;
		allTime: number;
	};
	conversion: {
		activatedUsers: number;
		convertedToPaid: number;
		liveSubscriptions: number;
		revenueUsdCents: number;
	};
};

export type StoryLinkAdminSignupsPage = {
	items: Array<{
		userId: string;
		name: string;
		email: string;
		image: string | null;
		signedUpAt: Date;
		convertedToPaid: boolean;
	}>;
	page: number;
	pageSize: number;
	total: number;
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

	async getStats(
		storyLinkId: string,
		input: AdminDashboardRangeBounds,
	): Promise<StoryLinkAdminStatsSnapshot> {
		return this.db.transaction(async (transaction) => {
			const linkAndClicks = await this.getStatsLinkAndClicks(
				transaction,
				storyLinkId,
				input,
			);

			if (!linkAndClicks.link) {
				return {
					clicks: linkAndClicks.clicks,
					clicksByDay: [],
					conversion: {
						activatedUsers: 0,
						convertedToPaid: 0,
						liveSubscriptions: 0,
						revenueUsdCents: 0,
					},
					link: null,
					signups: { allTime: 0, inRange: 0 },
				};
			}

			const clicksByDay = await this.listStatsClicksByDay(
				transaction,
				storyLinkId,
				input,
			);
			const signups = await this.getStatsSignups(
				transaction,
				storyLinkId,
				input,
			);
			const conversion = await this.getStatsConversion(
				transaction,
				storyLinkId,
				input,
			);
			return {
				clicks: linkAndClicks.clicks,
				clicksByDay,
				conversion,
				link: linkAndClicks.link,
				signups,
			};
		}, READ_ONLY_TRANSACTION);
	}

	async listSignups(
		storyLinkId: string,
		input: AdminDashboardRangeBounds,
		pagination: { page: number; pageSize: number },
	): Promise<StoryLinkAdminSignupsPage> {
		return this.db.transaction(async (transaction) => {
			const result = await transaction.execute<StoryLinkSignupPageRow>(sql`
				with bounds as (${storyLinkBounds(input)}),
				cohort as (${storyLinkSignupCohort(storyLinkId)}),
				bounded_cohort as (
					select c.*
					from cohort c
					cross join bounds b
					where c.created_at < b.snapshot_end
				),
				cohort_count as (
					select count(*)::bigint as total
					from bounded_cohort
				),
				paged_cohort as (
					select c.*
					from bounded_cohort c
					order by c.created_at desc, c.user_id desc
					limit ${pagination.pageSize}
					offset ${(pagination.page - 1) * pagination.pageSize}
				),
				attributed_subscriptions as (
					select
						c.user_id,
						s.id as subscription_id
					from subscriptions s
					cross join bounds b
					left join organization_billing_customers obc
						on obc.organization_id = s.organization_id
					inner join paged_cohort c on c.user_id = case
						when s.organization_id is null then s.user_id
						else obc.attribution_user_id
					end
					where s.created_at < b.snapshot_end
				),
				paid_users as (
					select distinct s.user_id
					from attributed_subscriptions s
					cross join bounds b
					where ${positiveSubscriptionPaymentPredicate(
						sql`s.subscription_id`,
						sql`b.snapshot_end`,
					)}
				)
				select
					c.user_id,
					c.name,
					c.email,
					c.image,
					c.created_at as signed_up_at,
					(p.user_id is not null) as converted_to_paid,
					n.total
				from cohort_count n
				left join paged_cohort c on true
				left join paid_users p on p.user_id = c.user_id
				order by c.created_at desc, c.user_id desc
			`);
			const metadata = result.rows[0];

			return {
				items: result.rows.flatMap((row) =>
					row.user_id === null ||
					row.name === null ||
					row.email === null ||
					row.signed_up_at === null
						? []
						: [
								{
									convertedToPaid: row.converted_to_paid,
									email: row.email,
									image: row.image,
									name: row.name,
									signedUpAt: toDate(row.signed_up_at),
									userId: row.user_id,
								},
							],
				),
				page: pagination.page,
				pageSize: pagination.pageSize,
				total: toNumber(metadata?.total),
			};
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
				archivedAt: toNullableDate(row.archived_at),
				createdAt: toDate(row.created_at),
				destinationPath: row.destination_path,
				id: row.id,
				name: row.name,
				slug: row.slug,
				updatedAt: toDate(row.updated_at),
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

	private async getStatsLinkAndClicks(
		client: StoryLinkAdminDbClient,
		storyLinkId: string,
		input: AdminDashboardRangeBounds,
	): Promise<Pick<StoryLinkAdminStatsSnapshot, "link" | "clicks">> {
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
				coalesce(r.unique_visitors_in_range, 0)::bigint
					as unique_visitors_in_range,
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
			where l.id = ${storyLinkId}
			limit 1
		`);

		const row = result.rows[0];
		if (!row) {
			return {
				clicks: { allTime: 0, inRange: 0, uniqueInRange: 0 },
				link: null,
			};
		}

		return {
			clicks: {
				allTime: toNumber(row.all_time_clicks),
				inRange: toNumber(row.clicks_in_range),
				uniqueInRange: toNumber(row.unique_visitors_in_range),
			},
			link: mapStoryLinkRow(row),
		};
	}

	private async listStatsClicksByDay(
		client: StoryLinkAdminDbClient,
		storyLinkId: string,
		input: AdminDashboardRangeBounds,
	): Promise<StoryLinkAdminStatsSnapshot["clicksByDay"]> {
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
				where c.story_link_id = ${storyLinkId}
					and c.created_at >= b.range_start
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

	private async getStatsSignups(
		client: StoryLinkAdminDbClient,
		storyLinkId: string,
		input: AdminDashboardRangeBounds,
	): Promise<StoryLinkAdminStatsSnapshot["signups"]> {
		const result = await client.execute<StoryLinkSignupStatsRow>(sql`
			with bounds as (${storyLinkBounds(input)}),
			cohort as (${storyLinkSignupCohort(storyLinkId)})
			select
				count(distinct c.user_id) filter (
					where c.created_at >= b.range_start
						and c.created_at < b.range_end
				)::bigint as in_range,
				count(distinct c.user_id) filter (
					where c.created_at < b.snapshot_end
				)::bigint as all_time
			from cohort c
			cross join bounds b
		`);

		const row = result.rows[0];
		return {
			allTime: toNumber(row?.all_time),
			inRange: toNumber(row?.in_range),
		};
	}

	private async getStatsConversion(
		client: StoryLinkAdminDbClient,
		storyLinkId: string,
		input: AdminDashboardRangeBounds,
	): Promise<StoryLinkAdminStatsSnapshot["conversion"]> {
		const result = await client.execute<StoryLinkConversionStatsRow>(sql`
			with bounds as (${storyLinkBounds(input)}),
			cohort as (${storyLinkSignupCohort(storyLinkId)}),
			all_time_cohort as (
				select c.*
				from cohort c
				cross join bounds b
				where c.created_at < b.snapshot_end
			),
			activated_attempt_users as (
				select c.user_id
				from page_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join all_time_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from image_generation_attempts a
				inner join projects p on p.id = a.project_id
				inner join all_time_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from marketing_assets a
				inner join projects p on p.id = a.project_id
				inner join all_time_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from lead_scrape_attempts a
				inner join projects p on p.id = a.project_id
				inner join all_time_cohort c on c.user_id = p.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
				union all
				select c.user_id
				from connector_generation_attempts a
				inner join all_time_cohort c on c.user_id = a.user_id
				cross join bounds b
				where a.status = 'succeeded'
					and a.created_at < b.snapshot_end
			),
			activated_users as (
				select distinct a.user_id
				from activated_attempt_users a
			),
			attributed_subscriptions as (
				select
					c.user_id,
					s.id as subscription_id,
					s.status
				from subscriptions s
				cross join bounds b
				left join organization_billing_customers obc
					on obc.organization_id = s.organization_id
				inner join all_time_cohort c on c.user_id = case
					when s.organization_id is null then s.user_id
					else obc.attribution_user_id
				end
				where s.created_at < b.snapshot_end
			),
			paid_users as (
				select distinct s.user_id
				from attributed_subscriptions s
				cross join bounds b
				where ${positiveSubscriptionPaymentPredicate(
					sql`s.subscription_id`,
					sql`b.snapshot_end`,
				)}
			),
			live_subscription_users as (
				select distinct s.user_id
				from attributed_subscriptions s
				where s.status in (${liveSubscriptionStatusList()})
			),
			revenue as (
				select a.amount_paid_minor::bigint as amount_minor
				from attributed_subscriptions s
				inner join billing_invoice_applications a
					on a.subscription_id = s.subscription_id
				cross join bounds b
				where a.paid_at is not null
					and a.amount_paid_minor > 0
					and a.paid_at < b.snapshot_end
					and lower(a.currency) = 'usd'
				union all
				select m.amount_minor::bigint as amount_minor
				from attributed_subscriptions s
				inner join manual_subscription_payments m
					on m.subscription_id = s.subscription_id
				cross join bounds b
				where m.amount_minor > 0
					and m.created_at < b.snapshot_end
					and lower(m.currency) = 'usd'
			)
			select
				(select count(*) from activated_users)::bigint as activated_users,
				(select count(*) from paid_users)::bigint as converted_to_paid,
				(select count(*) from live_subscription_users)::bigint
					as live_subscriptions,
				coalesce((select sum(r.amount_minor) from revenue r), 0)::bigint
					as revenue_usd_cents
		`);

		const row = result.rows[0];
		return {
			activatedUsers: toNumber(row?.activated_users),
			convertedToPaid: toNumber(row?.converted_to_paid),
			liveSubscriptions: toNumber(row?.live_subscriptions),
			revenueUsdCents: toNumber(row?.revenue_usd_cents),
		};
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

function storyLinkSignupCohort(storyLinkId: string): SQL {
	return sql`
		select
			u.id as user_id,
			u.name,
			u.email,
			u.image,
			u.created_at
		from story_links l
		inner join user_attributions ua on (
			ua.story_link_slug = l.slug
			or (
				-- Landing-page UTM recapture historically dropped the story-link
				-- slug. Recover exact NULL-slug tuples, but let the earliest-created
				-- identical link win so a signup is never counted for two links.
				ua.story_link_slug is null
				and ua.utm_source = l.utm_source
				and ua.utm_medium = l.utm_medium
				and ua.utm_campaign = l.utm_campaign
				and ua.utm_content is not distinct from l.utm_content
				and l.id = (
					select l2.id
					from story_links l2
					where l2.utm_source = l.utm_source
						and l2.utm_medium = l.utm_medium
						and l2.utm_campaign = l.utm_campaign
						and l2.utm_content is not distinct from l.utm_content
					order by l2.created_at asc, l2.id asc
					limit 1
				)
			)
		)
		inner join "user" u on u.id = ua.user_id
		where l.id = ${storyLinkId}
	`;
}

function positiveSubscriptionPaymentPredicate(
	subscriptionId: SQL,
	snapshotEnd: SQL,
): SQL {
	return sql`(
		exists (
			select 1
			from billing_invoice_applications a
			where a.subscription_id = ${subscriptionId}
				and a.paid_at is not null
				and a.amount_paid_minor > 0
				and a.paid_at < ${snapshotEnd}
		)
		or exists (
			select 1
			from manual_subscription_payments m
			where m.subscription_id = ${subscriptionId}
				and m.amount_minor > 0
				and m.created_at < ${snapshotEnd}
		)
	)`;
}

function liveSubscriptionStatusList() {
	return sql.join(
		LIVE_SUBSCRIPTION_STATUSES.map((status) => sql`${status}`),
		sql`, `,
	);
}

function mapStoryLinkRow(row: StoryLinkStatsRow): StoryLinkAdminRow {
	return {
		archivedAt: toNullableDate(row.archived_at),
		createdAt: toDate(row.created_at),
		destinationPath: row.destination_path,
		id: row.id,
		name: row.name,
		slug: row.slug,
		updatedAt: toDate(row.updated_at),
		utmCampaign: row.utm_campaign,
		utmContent: row.utm_content,
		utmMedium: row.utm_medium,
		utmSource: row.utm_source,
	};
}

function toDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
	return value === null ? null : toDate(value);
}

function toNumber(value: NumericValue | undefined): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}
