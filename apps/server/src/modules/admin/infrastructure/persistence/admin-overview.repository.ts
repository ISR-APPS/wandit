import { Inject, Injectable } from "@nestjs/common";
import { sql } from "@wandit/db";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { AdminDashboardRangeBounds } from "../../application/services/admin-dashboard-range";
import {
	type AdminAnalyticsOverviewMetricsRepositorySnapshot,
	AdminAnalyticsRepository,
} from "./admin-analytics.repository";
import { withAdminReadSnapshot } from "./admin-read-snapshot";

type NumericValue = bigint | number | string | null;

type AdminOverviewDbClient = Pick<Database, "execute">;

type GrowthRow = {
	date: string;
	signups: NumericValue;
	websites_generated: NumericValue;
	total_users: NumericValue;
	active_users: NumericValue;
	activation_percent: NumericValue;
	signups_change_percent: NumericValue;
	websites_change_percent: NumericValue;
};

type RevenueRow = {
	date: string;
	total_usd_minor: NumericValue;
	current_total_usd_minor: NumericValue;
	total_change_percent: NumericValue;
};

type UsageRow = {
	tokens_used: NumericValue;
	tokens_change_percent: NumericValue;
	cost_usd_minor: NumericValue;
	model_id: string | null;
	raw_model: string | null;
	provider: string | null;
	model_tokens_used: NumericValue;
	usage_share_percent: NumericValue;
	model_cost_usd_minor: NumericValue;
};

type AssetTotalsRow = {
	images_generated: NumericValue;
	assets_generated: NumericValue;
	images_change_percent: NumericValue;
};

type GenerationRow = {
	date: string;
	successful: NumericValue;
	failed: NumericValue;
	attempts: NumericValue;
	total_successful: NumericValue;
	total_failed: NumericValue;
	success_rate_percent: NumericValue;
	success_rate_change_points: NumericValue;
	average_latency_ms: NumericValue;
	latency_change_percent: NumericValue;
};

export type AdminOverviewSignalRow = {
	id: string;
	kind:
		| "lead"
		| "page_generation_failed"
		| "page_generation_succeeded"
		| "payment";
	occurredAt: string;
	userName: string;
	projectName: string | null;
	leadName: string | null;
	amountMinor: number | null;
	currency: string | null;
	durationMs: number | null;
};

export type AdminOverviewRepositorySnapshot = {
	periodStart: string;
	periodEnd: string;
	revenue: {
		totalUsdMinor: number;
		changePercent: number;
	};
	totals: {
		tokensUsed: number;
		tokensChangePercent: number;
		tokenCostUsdMinor: number;
		websitesGenerated: number;
		websitesChangePercent: number;
		assetsGenerated: number;
		imagesGenerated: number;
		imagesChangePercent: number;
		totalUsers: number;
		signups: number;
		signupsChangePercent: number;
		activeUsers: number;
		activationPercent: number;
	};
	generation: {
		attempts: number;
		successful: number;
		failed: number;
		successRatePercent: number;
		successRateChangePoints: number;
		averageLatencyMs: number;
		latencyChangePercent: number;
	};
	revenueSeries: Array<{
		date: string;
		totalUsdMinor: number;
	}>;
	growthSeries: Array<{
		date: string;
		signups: number;
		websitesGenerated: number;
	}>;
	generationSeries: Array<{
		date: string;
		successful: number;
		failed: number;
	}>;
	modelUsage: Array<{
		modelId: string;
		rawModel: string;
		provider: string;
		tokensUsed: number;
		usageSharePercent: number;
		costUsdMinor: number;
	}>;
	recentSignals: AdminOverviewSignalRow[];
	overviewMetrics: AdminAnalyticsOverviewMetricsRepositorySnapshot;
};

@Injectable()
export class AdminOverviewRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AdminAnalyticsRepository)
		private readonly adminAnalyticsRepository: AdminAnalyticsRepository,
	) {}

	async getOverview(
		input: AdminDashboardRangeBounds,
	): Promise<AdminOverviewRepositorySnapshot> {
		return withAdminReadSnapshot(this.db, async (client) => {
			const [
				growth,
				revenue,
				usage,
				assets,
				generation,
				recentSignals,
				overviewMetrics,
			] = await Promise.all([
				this.getGrowth(client, input),
				this.getRevenue(client, input),
				this.getUsage(client, input),
				this.getAssetTotals(client, input),
				this.getGenerationHealth(client, input),
				this.getRecentSignals(client, input),
				this.adminAnalyticsRepository.getOverviewMetrics(client, input),
			]);

			const firstGrowthPoint = growth.points[0];
			const lastGrowthPoint = growth.points.at(-1);

			return {
				periodStart: firstGrowthPoint?.date ?? utcDate(input.rangeStart),
				periodEnd: lastGrowthPoint?.date ?? utcDate(input.seriesEnd),
				revenue: revenue.summary,
				totals: {
					...growth.summary,
					...usage.summary,
					...assets,
				},
				generation: generation.summary,
				revenueSeries: revenue.points,
				growthSeries: growth.points,
				generationSeries: generation.points,
				modelUsage: usage.models,
				recentSignals,
				overviewMetrics,
			};
		});
	}

	private async getGrowth(
		client: AdminOverviewDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<GrowthRow>(sql`
			with bounds as (${overviewBounds(input)}),
			days as (
				select generate_series(
					b.current_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			user_metrics as (
				select
					count(*) filter (
						where u.created_at < b.current_end
					)::bigint as total_users,
					count(*) filter (
						where u.created_at >= b.current_start
							and u.created_at < b.current_end
					)::bigint as current_signups,
					count(*) filter (
						where u.created_at >= b.previous_start
							and u.created_at < b.current_start
					)::bigint as previous_signups,
					count(*) filter (
						where u.last_seen_at >= b.current_start
							and u.last_seen_at < b.current_end
					)::bigint as active_users
				from "user" u
				cross join bounds b
			),
			website_metrics as (
				-- One successful page attempt is one generated website. Rebuilds count
				-- again because each successful attempt produces a new page version.
				select
					count(*) filter (
						where p.completed_at >= b.current_start
							and p.completed_at < b.current_end
					)::bigint as current_websites,
					count(*) filter (
						where p.completed_at >= b.previous_start
							and p.completed_at < b.current_start
					)::bigint as previous_websites
				from page_generation_attempts p
				cross join bounds b
				where p.status = 'succeeded'
					and p.completed_at >= b.previous_start
					and p.completed_at < b.current_end
			),
			metrics as (
				select
					u.*,
					w.*,
					${percentChangeSql(sql`u.current_signups`, sql`u.previous_signups`)} as signups_change_percent,
					${percentChangeSql(sql`w.current_websites`, sql`w.previous_websites`)} as websites_change_percent,
					case
						when u.total_users = 0 then 0
						else round(u.active_users::numeric / u.total_users * 100, 1)
					end::double precision as activation_percent
				from user_metrics u
				cross join website_metrics w
			),
			daily_signups as (
				select
					(u.created_at at time zone 'UTC')::date as day,
					count(*)::bigint as signups
				from "user" u
				cross join bounds b
				where u.created_at >= b.current_start
					and u.created_at < b.current_end
				group by 1
			),
			daily_websites as (
				select
					(p.completed_at at time zone 'UTC')::date as day,
					count(*)::bigint as websites
				from page_generation_attempts p
				cross join bounds b
				where p.status = 'succeeded'
					and p.completed_at >= b.current_start
					and p.completed_at < b.current_end
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(s.signups, 0)::bigint as signups,
				coalesce(w.websites, 0)::bigint as websites_generated,
				m.total_users,
				m.active_users,
				m.activation_percent,
				m.signups_change_percent,
				m.websites_change_percent
			from days d
			cross join metrics m
			left join daily_signups s
				on s.day = (d.day at time zone 'UTC')::date
			left join daily_websites w
				on w.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		const first = result.rows[0];

		return {
			points: result.rows.map((row) => ({
				date: String(row.date),
				signups: toNumber(row.signups),
				websitesGenerated: toNumber(row.websites_generated),
			})),
			summary: {
				totalUsers: toNumber(first?.total_users),
				signups: result.rows.reduce(
					(sum, row) => sum + toNumber(row.signups),
					0,
				),
				signupsChangePercent: toNumber(first?.signups_change_percent),
				activeUsers: toNumber(first?.active_users),
				activationPercent: toNumber(first?.activation_percent),
				websitesGenerated: result.rows.reduce(
					(sum, row) => sum + toNumber(row.websites_generated),
					0,
				),
				websitesChangePercent: toNumber(first?.websites_change_percent),
			},
		};
	}

	private async getRevenue(
		client: AdminOverviewDbClient,
		input: AdminDashboardRangeBounds,
	) {
		// Stripe gross = one-time payment orders + subscription invoice
		// settlements (billing_invoice_applications amount snapshots; rows
		// predating the snapshot columns carry NULL and drop out). Subscription
		// amounts are gross — refunds are not netted for them. Top-up sessions
		// have no relational amount source yet and stay uncounted; affiliate
		// commission bases are not gross revenue and remain excluded.
		const result = await client.execute<RevenueRow>(sql`
			with bounds as (${overviewBounds(input)}),
			days as (
				select generate_series(
					b.current_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			eligible_payments as (
				select o.paid_at, o.amount_cents
				from payment_orders o
				cross join bounds b
				where o.paid_at >= b.previous_start
					and o.paid_at < b.current_end
					and o.status not in ('failed', 'canceled', 'refunded')
					and lower(o.provider) = 'stripe'
					and lower(o.currency) = 'usd'
				union all
				select a.paid_at, a.amount_paid_minor as amount_cents
				from billing_invoice_applications a
				cross join bounds b
				where a.paid_at is not null
					and a.amount_paid_minor > 0
					and lower(a.currency) = 'usd'
					and a.paid_at >= b.previous_start
					and a.paid_at < b.current_end
			),
			totals as (
				select
					coalesce(sum(o.amount_cents) filter (
						where o.paid_at >= b.current_start
					), 0)::bigint as current_total,
					coalesce(sum(o.amount_cents) filter (
						where o.paid_at < b.current_start
					), 0)::bigint as previous_total
				from eligible_payments o
				cross join bounds b
			),
			metrics as (
				select
					t.current_total as current_total_usd,
					${percentChangeSql(sql`t.current_total`, sql`t.previous_total`)} as total_change_percent
				from totals t
			),
			daily as (
				select
					(o.paid_at at time zone 'UTC')::date as day,
					coalesce(sum(o.amount_cents), 0)::bigint as total
				from eligible_payments o
				cross join bounds b
				where o.paid_at >= b.current_start
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(n.total, 0)::bigint as total_usd_minor,
				m.current_total_usd as current_total_usd_minor,
				m.total_change_percent
			from days d
			cross join metrics m
			left join daily n
				on n.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		const first = result.rows[0];

		return {
			points: result.rows.map((row) => ({
				date: String(row.date),
				totalUsdMinor: toNumber(row.total_usd_minor),
			})),
			summary: {
				totalUsdMinor: toNumber(first?.current_total_usd_minor),
				changePercent: toNumber(first?.total_change_percent),
			},
		};
	}

	private async getUsage(
		client: AdminOverviewDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<UsageRow>(sql`
			with bounds as (${overviewBounds(input)}),
			grouped as (
				select
					coalesce(nullif(lower(trim(e.provider)), ''), 'unknown') as provider,
					coalesce(nullif(trim(e.model), ''), 'unknown') as raw_model,
					coalesce(sum(
						coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
					) filter (
						where e.created_at >= b.current_start
					), 0)::bigint as current_tokens,
					coalesce(sum(
						coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
					) filter (
						where e.created_at < b.current_start
					), 0)::bigint as previous_tokens,
					coalesce(sum(coalesce(
						e.reconciled_cost_usd_micros,
						case
							when jsonb_typeof(
								e.pricing_snapshot -> 'costUsdMicros'
							) = 'number'
								then (
									e.pricing_snapshot ->> 'costUsdMicros'
								)::bigint
						end,
						e.estimated_cost_usd_micros,
						0
					)) filter (
						where e.created_at >= b.current_start
					), 0)::bigint as current_cost_micros
				from ai_usage_events e
				cross join bounds b
				where e.created_at >= b.previous_start
					and e.created_at < b.current_end
					and e.status in ('settled', 'reconciled', 'reconcile_failed')
				group by 1, 2
			),
			with_totals as (
				select
					g.*,
					sum(g.current_tokens) over ()::bigint as total_current_tokens,
					sum(g.previous_tokens) over ()::bigint as total_previous_tokens,
					sum(g.current_cost_micros) over ()::bigint
						as total_current_cost_micros
				from grouped g
			),
			summary as (
				select
					coalesce(max(w.total_current_tokens), 0)::bigint as current_tokens,
					coalesce(max(w.total_previous_tokens), 0)::bigint as previous_tokens,
					coalesce(max(w.total_current_cost_micros), 0)::bigint
						as current_cost_micros
				from with_totals w
			),
			models as (
				select w.*
				from with_totals w
				where w.current_tokens > 0 or w.current_cost_micros > 0
			)
			select
				s.current_tokens as tokens_used,
				${percentChangeSql(sql`s.current_tokens`, sql`s.previous_tokens`)} as tokens_change_percent,
				round(s.current_cost_micros::numeric / 10000)::bigint
					as cost_usd_minor,
				m.raw_model as model_id,
				m.raw_model,
				m.provider,
				m.current_tokens as model_tokens_used,
				case
					when s.current_tokens = 0 then 0
					else round(
						m.current_tokens::numeric / s.current_tokens * 100,
						1
					)
				end::double precision as usage_share_percent,
				round(m.current_cost_micros::numeric / 10000)::bigint
					as model_cost_usd_minor
			from summary s
			left join models m on true
			order by
				m.current_tokens desc,
				m.current_cost_micros desc,
				m.provider,
				m.raw_model
		`);

		const totals = result.rows[0];

		return {
			summary: {
				tokensUsed: toNumber(totals?.tokens_used),
				tokensChangePercent: toNumber(totals?.tokens_change_percent),
				tokenCostUsdMinor: toNumber(totals?.cost_usd_minor),
			},
			models: result.rows.flatMap((row) =>
				row.model_id === null || row.raw_model === null || row.provider === null
					? []
					: [
							{
								modelId: row.model_id,
								rawModel: row.raw_model,
								provider: row.provider,
								tokensUsed: toNumber(row.model_tokens_used),
								usageSharePercent: toNumber(row.usage_share_percent),
								costUsdMinor: toNumber(row.model_cost_usd_minor),
							},
						],
			),
		};
	}

	private async getAssetTotals(
		client: AdminOverviewDbClient,
		input: AdminDashboardRangeBounds,
	) {
		// MOCK DATA: Page-build images live only in R2; metering cannot distinguish
		// successful asset writes from billed upload failures, so these totals omit them.
		const result = await client.execute<AssetTotalsRow>(sql`
			with bounds as (${overviewBounds(input)}),
			image_outputs as (
				-- Count persisted image references because successful attempts can return
				-- fewer outputs than requested. Legacy rows without an array fall back to
				-- the requested count.
				select
					coalesce(i.completed_at, i.created_at) as completed_at,
					case
						when jsonb_typeof(i.images) = 'array'
							then jsonb_array_length(i.images)
						else i.count
					end::bigint as outputs
				from image_generation_attempts i
				cross join bounds b
				where i.status = 'succeeded'
					and coalesce(i.completed_at, i.created_at) >= b.previous_start
					and coalesce(i.completed_at, i.created_at) < b.current_end
			),
			image_totals as (
				select
					coalesce(sum(i.outputs) filter (
						where i.completed_at >= b.current_start
					), 0)::bigint as current_images,
					coalesce(sum(i.outputs) filter (
						where i.completed_at < b.current_start
					), 0)::bigint as previous_images
				from image_outputs i
				cross join bounds b
			),
			media_totals as (
				-- Each successful media attempt persists one generated video asset.
				select
					count(*) filter (
						where coalesce(m.completed_at, m.created_at) >= b.current_start
					)::bigint as current_media
				from media_generation_attempts m
				cross join bounds b
				where m.status = 'succeeded'
					and coalesce(m.completed_at, m.created_at) >= b.previous_start
					and coalesce(m.completed_at, m.created_at) < b.current_end
			)
			select
				i.current_images as images_generated,
				(i.current_images + m.current_media)::bigint as assets_generated,
				${percentChangeSql(sql`i.current_images`, sql`i.previous_images`)} as images_change_percent
			from image_totals i
			cross join media_totals m
		`);

		const totals = result.rows[0];

		return {
			imagesGenerated: toNumber(totals?.images_generated),
			assetsGenerated: toNumber(totals?.assets_generated),
			imagesChangePercent: toNumber(totals?.images_change_percent),
		};
	}

	private async getGenerationHealth(
		client: AdminOverviewDbClient,
		input: AdminDashboardRangeBounds,
	) {
		const result = await client.execute<GenerationRow>(sql`
			with bounds as (${overviewBounds(input)}),
			days as (
				select generate_series(
					b.current_start,
					b.series_end,
					interval '1 day'
				) as day
				from bounds b
			),
			-- Request-level terminal attempts across all persisted generation types.
			-- The shared latency is end-to-end completed_at - created_at because
			-- page and connector attempts do not expose a started_at timestamp.
			terminal_attempts as (
				select p.status::text as status, p.created_at, p.completed_at
				from page_generation_attempts p
				cross join bounds b
				where p.status in ('succeeded', 'failed')
					and p.completed_at >= b.previous_start
					and p.completed_at < b.current_end
				union all
				select i.status::text, i.created_at, i.completed_at
				from image_generation_attempts i
				cross join bounds b
				where i.status in ('succeeded', 'failed')
					and i.completed_at >= b.previous_start
					and i.completed_at < b.current_end
				union all
				select m.status::text, m.created_at, m.completed_at
				from media_generation_attempts m
				cross join bounds b
				where m.status in ('succeeded', 'failed')
					and m.completed_at >= b.previous_start
					and m.completed_at < b.current_end
				union all
				select a.status::text, a.created_at, a.completed_at
				from marketing_assets a
				cross join bounds b
				where a.status in ('succeeded', 'failed')
					and a.completed_at >= b.previous_start
					and a.completed_at < b.current_end
				union all
				select c.status::text, c.created_at, c.completed_at
				from connector_generation_attempts c
				cross join bounds b
				where c.status in ('succeeded', 'failed')
					and c.completed_at >= b.previous_start
					and c.completed_at < b.current_end
			),
			daily_metrics as (
				select
					(t.completed_at at time zone 'UTC')::date as day,
					count(*) filter (
						where t.completed_at >= b.current_start
					)::bigint as current_attempts,
					count(*) filter (
						where t.completed_at >= b.current_start
							and t.status = 'succeeded'
					)::bigint as current_successful,
					count(*) filter (
						where t.completed_at >= b.current_start
							and t.status = 'failed'
					)::bigint as current_failed,
					count(*) filter (
						where t.completed_at < b.current_start
					)::bigint as previous_attempts,
					count(*) filter (
						where t.completed_at < b.current_start
							and t.status = 'succeeded'
					)::bigint as previous_successful,
					coalesce(sum(
						extract(epoch from (t.completed_at - t.created_at)) * 1000
					) filter (
						where t.completed_at >= b.current_start
							and t.completed_at >= t.created_at
					), 0) as current_latency_total,
					count(*) filter (
						where t.completed_at >= b.current_start
							and t.completed_at >= t.created_at
					)::bigint as current_latency_count,
					coalesce(sum(
						extract(epoch from (t.completed_at - t.created_at)) * 1000
					) filter (
						where t.completed_at < b.current_start
							and t.completed_at >= t.created_at
					), 0) as previous_latency_total,
					count(*) filter (
						where t.completed_at < b.current_start
							and t.completed_at >= t.created_at
					)::bigint as previous_latency_count
				from terminal_attempts t
				cross join bounds b
				group by 1
			),
			with_totals as (
				select
					d.*,
					sum(d.current_attempts) over () as total_current_attempts,
					sum(d.current_successful) over () as total_current_successful,
					sum(d.current_failed) over () as total_current_failed,
					sum(d.previous_attempts) over () as total_previous_attempts,
					sum(d.previous_successful) over () as total_previous_successful,
					sum(d.current_latency_total) over () as total_current_latency,
					sum(d.current_latency_count) over () as total_current_latency_count,
					sum(d.previous_latency_total) over () as total_previous_latency,
					sum(d.previous_latency_count) over () as total_previous_latency_count
				from daily_metrics d
			),
			raw_metrics as (
				select
					coalesce(max(w.total_current_attempts), 0)::bigint
						as current_attempts,
					coalesce(max(w.total_current_successful), 0)::bigint
						as current_successful,
					coalesce(max(w.total_current_failed), 0)::bigint as current_failed,
					coalesce(max(w.total_previous_attempts), 0)::bigint
						as previous_attempts,
					coalesce(max(w.total_previous_successful), 0)::bigint
						as previous_successful,
					coalesce(round(
						max(w.total_current_latency) /
							nullif(max(w.total_current_latency_count), 0)
					), 0)::bigint as current_latency_ms,
					coalesce(round(
						max(w.total_previous_latency) /
							nullif(max(w.total_previous_latency_count), 0)
					), 0)::bigint as previous_latency_ms
				from with_totals w
			),
			rates as (
				select
					r.*,
					case
						when r.current_attempts = 0 then 0
						else round(
							r.current_successful::numeric / r.current_attempts * 100,
							1
						)
					end::double precision as current_success_rate,
					case
						when r.previous_attempts = 0 then 0
						else round(
							r.previous_successful::numeric / r.previous_attempts * 100,
							1
						)
					end::double precision as previous_success_rate
				from raw_metrics r
			),
			metrics as (
				select
					r.*,
					r.current_success_rate - r.previous_success_rate as success_rate_change_points,
					${percentChangeSql(sql`r.current_latency_ms`, sql`r.previous_latency_ms`)} as latency_change_percent
				from rates r
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(a.current_successful, 0)::bigint as successful,
				coalesce(a.current_failed, 0)::bigint as failed,
				m.current_attempts as attempts,
				m.current_successful as total_successful,
				m.current_failed as total_failed,
				m.current_success_rate as success_rate_percent,
				m.success_rate_change_points,
				m.current_latency_ms as average_latency_ms,
				m.latency_change_percent
			from days d
			cross join metrics m
			left join with_totals a
				on a.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		const first = result.rows[0];

		return {
			points: result.rows.map((row) => ({
				date: String(row.date),
				successful: toNumber(row.successful),
				failed: toNumber(row.failed),
			})),
			summary: {
				attempts: toNumber(first?.attempts),
				successful: toNumber(first?.total_successful),
				failed: toNumber(first?.total_failed),
				successRatePercent: toNumber(first?.success_rate_percent),
				successRateChangePoints: toNumber(first?.success_rate_change_points),
				averageLatencyMs: toNumber(first?.average_latency_ms),
				latencyChangePercent: toNumber(first?.latency_change_percent),
			},
		};
	}

	private async getRecentSignals(
		client: AdminOverviewDbClient,
		input: AdminDashboardRangeBounds,
	): Promise<AdminOverviewSignalRow[]> {
		const result = await client.execute<{
			id: string;
			kind: AdminOverviewSignalRow["kind"];
			occurred_at: Date | string;
			user_name: string;
			project_name: string | null;
			lead_name: string | null;
			amount_minor: NumericValue;
			currency: string | null;
			duration_ms: NumericValue;
		}>(sql`
			with bounds as (${overviewBounds(input)})
			select signals.*
			from (
				select *
				from (
					select
						('payment:' || o.id::text) as id,
						'payment'::text as kind,
						o.paid_at as occurred_at,
						u.name as user_name,
						null::text as project_name,
						null::text as lead_name,
						o.amount_cents::bigint as amount_minor,
						upper(o.currency) as currency,
						null::bigint as duration_ms
					from payment_orders o
					inner join "user" u on u.id = o.user_id
					cross join bounds b
					where o.paid_at is not null
						and o.status not in ('failed', 'canceled', 'refunded')
						and lower(o.provider) = 'stripe'
						and lower(o.currency) = 'usd'
						and o.paid_at >= b.current_start
						and o.paid_at < b.current_end
					order by
						o.paid_at desc,
						('payment:' || o.id::text) desc
					limit 5
				) payment_signals
				union all
				select *
				from (
					select
						('page:' || p.id::text),
						case
							when p.status = 'succeeded'
								then 'page_generation_succeeded'
							else 'page_generation_failed'
						end,
						p.completed_at,
						u.name,
						pr.name,
						null::text,
						null::bigint,
						null::text,
						case
							when p.completed_at >= p.created_at then round(
								extract(epoch from (p.completed_at - p.created_at)) * 1000
							)::bigint
							else null::bigint
						end
					from page_generation_attempts p
					inner join projects pr on pr.id = p.project_id
					inner join "user" u on u.id = pr.user_id
					cross join bounds b
					where p.status in ('succeeded', 'failed')
						and p.completed_at is not null
						and pr.deleted_at is null
						and p.completed_at >= b.current_start
						and p.completed_at < b.current_end
					order by
						p.completed_at desc,
						('page:' || p.id::text) desc
					limit 5
				) generation_signals
				union all
				select *
				from (
					select
						('lead:' || l.id::text),
						'lead'::text,
						l.created_at,
						u.name,
						pr.name,
						l.name,
						null::bigint,
						null::text,
						null::bigint
					from leads l
					inner join projects pr on pr.id = l.project_id
					inner join "user" u on u.id = pr.user_id
					cross join bounds b
					where pr.deleted_at is null
						and l.created_at is not null
						and l.created_at >= b.current_start
						and l.created_at < b.current_end
					order by
						l.created_at desc,
						('lead:' || l.id::text) desc
					limit 5
				) lead_signals
			) signals
			cross join bounds b
			where signals.occurred_at is not null
				and signals.occurred_at >= b.current_start
				and signals.occurred_at < b.current_end
			order by signals.occurred_at desc, signals.id desc
			limit 5
		`);

		return result.rows.map((row) => ({
			id: String(row.id),
			kind: row.kind,
			occurredAt: new Date(row.occurred_at).toISOString(),
			userName: String(row.user_name),
			projectName: row.project_name,
			leadName: row.lead_name,
			amountMinor:
				row.amount_minor === null ? null : toNumber(row.amount_minor),
			currency: row.currency,
			durationMs: row.duration_ms === null ? null : toNumber(row.duration_ms),
		}));
	}
}

function overviewBounds(input: AdminDashboardRangeBounds) {
	// The current window covers the selected UTC dates only up to the snapshot
	// time. Subtracting that exact duration makes the previous window equal in
	// elapsed length while the chart can still zero-fill one point per UTC date.
	return sql`
		select
			w.current_start,
			w.current_end,
			w.series_end,
			w.snapshot_end,
			w.current_start - (w.current_end - w.current_start) as previous_start
		from (
			select
				${input.rangeStart}::timestamptz as current_start,
				${input.rangeEnd}::timestamptz as current_end,
				${input.seriesEnd}::timestamptz as series_end,
				${input.snapshotEnd}::timestamptz as snapshot_end
		) w
	`;
}

function percentChangeSql(
	current: ReturnType<typeof sql>,
	previous: ReturnType<typeof sql>,
) {
	return sql`
		case
			when ${previous} = 0 then
				case when ${current} = 0 then 0 else 100 end
			else round(((${current} - ${previous})::numeric / ${previous}) * 100, 1)
		end::double precision
	`;
}

function toNumber(value: NumericValue | undefined): number {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function utcDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}
