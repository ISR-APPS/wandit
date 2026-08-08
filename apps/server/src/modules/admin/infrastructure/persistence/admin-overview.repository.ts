import { Inject, Injectable } from "@nestjs/common";
import { sql } from "@wandit/db";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

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
	stripe_usd_minor: NumericValue;
	chargily_dzd_minor: NumericValue;
	chargily_usd_minor: NumericValue;
	total_usd_minor: NumericValue;
	current_stripe_usd_minor: NumericValue;
	current_chargily_dzd_minor: NumericValue;
	current_chargily_usd_minor: NumericValue;
	current_total_usd_minor: NumericValue;
	stripe_change_percent: NumericValue;
	chargily_change_percent: NumericValue;
	total_change_percent: NumericValue;
};

type UsageTotalsRow = {
	tokens_used: NumericValue;
	tokens_change_percent: NumericValue;
	cost_usd_minor: NumericValue;
};

type ModelUsageRow = {
	model_id: string;
	raw_model: string;
	provider: string;
	tokens_used: NumericValue;
	usage_share_percent: NumericValue;
	cost_usd_minor: NumericValue;
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
	provider: string | null;
	amountMinor: number | null;
	currency: string | null;
	durationMs: number | null;
};

export type AdminOverviewRepositorySnapshot = {
	periodStart: string;
	periodEnd: string;
	revenue: {
		totalReportingUsdMinor: number;
		changePercent: number;
		stripe: {
			nativeTotalMinor: number;
			reportingUsdTotalMinor: number;
			changePercent: number;
		};
		chargily: {
			nativeTotalMinor: number;
			reportingUsdTotalMinor: number;
			changePercent: number;
		};
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
		stripeUsdMinor: number;
		chargilyUsdEquivalentMinor: number;
		totalUsdEquivalentMinor: number;
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
};

@Injectable()
export class AdminOverviewRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async getOverview(input: {
		days: number;
		generatedAt: Date;
		dzdPerUsd: number;
	}): Promise<AdminOverviewRepositorySnapshot> {
		return this.db.transaction(
			async (transaction) => {
				const [growth, revenue, usage, assets, generation, recentSignals] =
					await Promise.all([
						this.getGrowth(transaction, input.days, input.generatedAt),
						this.getRevenue(
							transaction,
							input.days,
							input.generatedAt,
							input.dzdPerUsd,
						),
						this.getUsage(transaction, input.days, input.generatedAt),
						this.getAssetTotals(transaction, input.days, input.generatedAt),
						this.getGenerationHealth(
							transaction,
							input.days,
							input.generatedAt,
						),
						this.getRecentSignals(transaction, input.generatedAt),
					]);

				const firstGrowthPoint = growth.points[0];
				const lastGrowthPoint = growth.points.at(-1);

				return {
					periodStart: firstGrowthPoint?.date ?? utcDate(input.generatedAt),
					periodEnd: lastGrowthPoint?.date ?? utcDate(input.generatedAt),
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
				};
			},
			{
				accessMode: "read only",
				isolationLevel: "repeatable read",
			},
		);
	}

	private async getGrowth(
		client: AdminOverviewDbClient,
		days: number,
		generatedAt: Date,
	) {
		const result = await client.execute<GrowthRow>(sql`
			with bounds as (${overviewBounds(days, generatedAt)}),
			days as (
				select generate_series(
					b.current_start,
					(b.current_end at time zone 'UTC')::date at time zone 'UTC',
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
		days: number,
		generatedAt: Date,
		dzdPerUsd: number,
	) {
		// MOCK DATA: subscription revenue coverage — canonical Stripe gross invoice
		// amounts have no relational source outside webhook JSONB; affiliate
		// commission bases are not gross revenue and remain excluded.
		const result = await client.execute<RevenueRow>(sql`
			with bounds as (${overviewBounds(days, generatedAt)}),
			days as (
				select generate_series(
					b.current_start,
					(b.current_end at time zone 'UTC')::date at time zone 'UTC',
					interval '1 day'
				) as day
				from bounds b
			),
			eligible_orders as (
				select o.*
				from payment_orders o
				cross join bounds b
				where o.paid_at >= b.previous_start
					and o.paid_at < b.current_end
					and o.status not in ('failed', 'canceled', 'refunded')
					and (
						(lower(o.provider) = 'stripe' and lower(o.currency) = 'usd')
						or (lower(o.provider) = 'chargily' and lower(o.currency) = 'dzd')
					)
			),
			native_totals as (
				select
					coalesce(sum(o.amount_cents) filter (
						where o.paid_at >= b.current_start
							and lower(o.provider) = 'stripe'
					), 0)::bigint as current_stripe,
					coalesce(sum(o.amount_cents) filter (
						where o.paid_at < b.current_start
							and lower(o.provider) = 'stripe'
					), 0)::bigint as previous_stripe,
					coalesce(sum(o.amount_cents) filter (
						where o.paid_at >= b.current_start
							and lower(o.provider) = 'chargily'
					), 0)::bigint as current_chargily,
					coalesce(sum(o.amount_cents) filter (
						where o.paid_at < b.current_start
							and lower(o.provider) = 'chargily'
					), 0)::bigint as previous_chargily
				from eligible_orders o
				cross join bounds b
			),
			reporting_totals as (
				select
					n.*,
					round(n.current_chargily::numeric / ${dzdPerUsd}::numeric)::bigint as current_chargily_usd,
					round(n.previous_chargily::numeric / ${dzdPerUsd}::numeric)::bigint as previous_chargily_usd
				from native_totals n
			),
			metrics as (
				select
					r.*,
					(r.current_stripe + r.current_chargily_usd)::bigint as current_total_usd,
					(r.previous_stripe + r.previous_chargily_usd)::bigint as previous_total_usd,
					${percentChangeSql(sql`r.current_stripe`, sql`r.previous_stripe`)} as stripe_change_percent,
					${percentChangeSql(sql`r.current_chargily_usd`, sql`r.previous_chargily_usd`)} as chargily_change_percent,
					${percentChangeSql(
						sql`(r.current_stripe + r.current_chargily_usd)`,
						sql`(r.previous_stripe + r.previous_chargily_usd)`,
					)} as total_change_percent
				from reporting_totals r
			),
			daily_native as (
				select
					(o.paid_at at time zone 'UTC')::date as day,
					coalesce(sum(o.amount_cents) filter (
						where lower(o.provider) = 'stripe'
					), 0)::bigint as stripe,
					coalesce(sum(o.amount_cents) filter (
						where lower(o.provider) = 'chargily'
					), 0)::bigint as chargily
				from eligible_orders o
				cross join bounds b
				where o.paid_at >= b.current_start
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(n.stripe, 0)::bigint as stripe_usd_minor,
				coalesce(n.chargily, 0)::bigint as chargily_dzd_minor,
				round(coalesce(n.chargily, 0)::numeric / ${dzdPerUsd}::numeric)::bigint as chargily_usd_minor,
				(
					coalesce(n.stripe, 0) +
					round(coalesce(n.chargily, 0)::numeric / ${dzdPerUsd}::numeric)
				)::bigint as total_usd_minor,
				m.current_stripe as current_stripe_usd_minor,
				m.current_chargily as current_chargily_dzd_minor,
				m.current_chargily_usd as current_chargily_usd_minor,
				m.current_total_usd as current_total_usd_minor,
				m.stripe_change_percent,
				m.chargily_change_percent,
				m.total_change_percent
			from days d
			cross join metrics m
			left join daily_native n
				on n.day = (d.day at time zone 'UTC')::date
			order by d.day asc
		`);

		const first = result.rows[0];

		return {
			points: result.rows.map((row) => ({
				date: String(row.date),
				stripeUsdMinor: toNumber(row.stripe_usd_minor),
				chargilyUsdEquivalentMinor: toNumber(row.chargily_usd_minor),
				totalUsdEquivalentMinor: toNumber(row.total_usd_minor),
			})),
			summary: {
				totalReportingUsdMinor: toNumber(first?.current_total_usd_minor),
				changePercent: toNumber(first?.total_change_percent),
				stripe: {
					nativeTotalMinor: toNumber(first?.current_stripe_usd_minor),
					reportingUsdTotalMinor: toNumber(first?.current_stripe_usd_minor),
					changePercent: toNumber(first?.stripe_change_percent),
				},
				chargily: {
					nativeTotalMinor: toNumber(first?.current_chargily_dzd_minor),
					reportingUsdTotalMinor: toNumber(first?.current_chargily_usd_minor),
					changePercent: toNumber(first?.chargily_change_percent),
				},
			},
		};
	}

	private async getUsage(
		client: AdminOverviewDbClient,
		days: number,
		generatedAt: Date,
	) {
		// TODO(perf): add an ai_usage_events index leading with created_at for these platform-wide range scans.
		const [totalsResult, modelsResult] = await Promise.all([
			client.execute<UsageTotalsRow>(sql`
				with bounds as (${overviewBounds(days, generatedAt)}),
				usage_totals as (
					select
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
						coalesce(sum(
							coalesce(
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
							)
						) filter (
							where e.created_at >= b.current_start
						), 0)::bigint as current_cost_micros
					from ai_usage_events e
					cross join bounds b
					where e.created_at >= b.previous_start
						and e.created_at < b.current_end
						and e.status in ('settled', 'reconciled', 'reconcile_failed')
				)
				select
					u.current_tokens as tokens_used,
					${percentChangeSql(sql`u.current_tokens`, sql`u.previous_tokens`)} as tokens_change_percent,
					round(u.current_cost_micros::numeric / 10000)::bigint as cost_usd_minor
				from usage_totals u
			`),
			client.execute<ModelUsageRow>(sql`
				with bounds as (${overviewBounds(days, generatedAt)}),
				grouped as (
					select
						coalesce(nullif(lower(trim(e.provider)), ''), 'unknown') as provider,
						coalesce(nullif(trim(e.model), ''), 'unknown') as raw_model,
						sum(
							coalesce(e.input_tokens, 0) + coalesce(e.output_tokens, 0)
						)::bigint as tokens,
						sum(coalesce(
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
						))::bigint as cost_micros
					from ai_usage_events e
					cross join bounds b
					where e.created_at >= b.current_start
						and e.created_at < b.current_end
						and e.status in ('settled', 'reconciled', 'reconcile_failed')
					group by 1, 2
				),
				with_shares as (
					select
						g.*,
						sum(g.tokens) over () as total_tokens
					from grouped g
				)
				select
					w.raw_model as model_id,
					w.raw_model,
					w.provider,
					w.tokens as tokens_used,
					case
						when w.total_tokens = 0 then 0
						else round(w.tokens::numeric / w.total_tokens * 100, 1)
					end::double precision as usage_share_percent,
					round(w.cost_micros::numeric / 10000)::bigint as cost_usd_minor
				from with_shares w
				where w.tokens > 0 or w.cost_micros > 0
				order by w.tokens desc, w.cost_micros desc, w.provider, w.raw_model
			`),
		]);

		const totals = totalsResult.rows[0];

		return {
			summary: {
				tokensUsed: toNumber(totals?.tokens_used),
				tokensChangePercent: toNumber(totals?.tokens_change_percent),
				tokenCostUsdMinor: toNumber(totals?.cost_usd_minor),
			},
			models: modelsResult.rows.map((row) => ({
				modelId: String(row.model_id),
				rawModel: String(row.raw_model),
				provider: String(row.provider),
				tokensUsed: toNumber(row.tokens_used),
				usageSharePercent: toNumber(row.usage_share_percent),
				costUsdMinor: toNumber(row.cost_usd_minor),
			})),
		};
	}

	private async getAssetTotals(
		client: AdminOverviewDbClient,
		days: number,
		generatedAt: Date,
	) {
		// MOCK DATA: Page-build images live only in R2; metering cannot distinguish
		// successful asset writes from billed upload failures, so these totals omit them.
		const result = await client.execute<AssetTotalsRow>(sql`
			with bounds as (${overviewBounds(days, generatedAt)}),
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
		days: number,
		generatedAt: Date,
	) {
		const result = await client.execute<GenerationRow>(sql`
			with bounds as (${overviewBounds(days, generatedAt)}),
			days as (
				select generate_series(
					b.current_start,
					(b.current_end at time zone 'UTC')::date at time zone 'UTC',
					interval '1 day'
				) as day
				from bounds b
			),
			-- Request-level terminal attempts across all persisted generation types.
			-- The shared latency is end-to-end completed_at - created_at because
			-- page and connector attempts do not expose a started_at timestamp.
			terminal_attempts as (
				select status::text as status, created_at, completed_at
				from page_generation_attempts
				where status in ('succeeded', 'failed')
				union all
				select status::text, created_at, completed_at
				from image_generation_attempts
				where status in ('succeeded', 'failed')
				union all
				select status::text, created_at, completed_at
				from media_generation_attempts
				where status in ('succeeded', 'failed')
				union all
				select status::text, created_at, completed_at
				from marketing_assets
				where status in ('succeeded', 'failed')
				union all
				select status::text, created_at, completed_at
				from connector_generation_attempts
				where status in ('succeeded', 'failed')
			),
			relevant_attempts as (
				select t.*
				from terminal_attempts t
				cross join bounds b
				where t.completed_at >= b.previous_start
					and t.completed_at < b.current_end
			),
			raw_metrics as (
				select
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
					coalesce(round(avg(
						extract(epoch from (t.completed_at - t.created_at)) * 1000
					) filter (
						where t.completed_at >= b.current_start
							and t.completed_at >= t.created_at
					)), 0)::bigint as current_latency_ms,
					coalesce(round(avg(
						extract(epoch from (t.completed_at - t.created_at)) * 1000
					) filter (
						where t.completed_at < b.current_start
							and t.completed_at >= t.created_at
					)), 0)::bigint as previous_latency_ms
				from relevant_attempts t
				cross join bounds b
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
			),
			daily as (
				select
					(t.completed_at at time zone 'UTC')::date as day,
					count(*) filter (where t.status = 'succeeded')::bigint as successful,
					count(*) filter (where t.status = 'failed')::bigint as failed
				from relevant_attempts t
				cross join bounds b
				where t.completed_at >= b.current_start
				group by 1
			)
			select
				to_char(d.day at time zone 'UTC', 'YYYY-MM-DD') as date,
				coalesce(a.successful, 0)::bigint as successful,
				coalesce(a.failed, 0)::bigint as failed,
				m.current_attempts as attempts,
				m.current_successful as total_successful,
				m.current_failed as total_failed,
				m.current_success_rate as success_rate_percent,
				m.success_rate_change_points,
				m.current_latency_ms as average_latency_ms,
				m.latency_change_percent
			from days d
			cross join metrics m
			left join daily a
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
		generatedAt: Date,
	): Promise<AdminOverviewSignalRow[]> {
		const result = await client.execute<{
			id: string;
			kind: AdminOverviewSignalRow["kind"];
			occurred_at: Date | string;
			user_name: string;
			project_name: string | null;
			lead_name: string | null;
			provider: string | null;
			amount_minor: NumericValue;
			currency: string | null;
			duration_ms: NumericValue;
		}>(sql`
			select *
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
						lower(o.provider) as provider,
						o.amount_cents::bigint as amount_minor,
						upper(o.currency) as currency,
						null::bigint as duration_ms
					from payment_orders o
					inner join "user" u on u.id = o.user_id
					where o.paid_at is not null
						and o.status not in ('failed', 'canceled', 'refunded')
						and o.paid_at < ${generatedAt}
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
					where p.status in ('succeeded', 'failed')
						and p.completed_at is not null
						and pr.deleted_at is null
						and p.completed_at < ${generatedAt}
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
						null::text,
						null::bigint,
						null::text,
						null::bigint
					from leads l
					inner join projects pr on pr.id = l.project_id
					inner join "user" u on u.id = pr.user_id
					where pr.deleted_at is null
						and l.created_at is not null
						and l.created_at < ${generatedAt}
					order by
						l.created_at desc,
						('lead:' || l.id::text) desc
					limit 5
				) lead_signals
			) signals
			where signals.occurred_at is not null
				and signals.occurred_at < ${generatedAt}
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
			provider: row.provider,
			amountMinor:
				row.amount_minor === null ? null : toNumber(row.amount_minor),
			currency: row.currency,
			durationMs: row.duration_ms === null ? null : toNumber(row.duration_ms),
		}));
	}
}

function overviewBounds(days: number, generatedAt: Date) {
	// The current window covers the selected UTC dates only up to the snapshot
	// time. Subtracting that exact duration makes the previous window equal in
	// elapsed length while the chart can still zero-fill one point per UTC date.
	return sql`
		select
			w.current_start,
			w.current_end,
			w.current_start - (w.current_end - w.current_start) as previous_start
		from (
			select
				(
					(${generatedAt}::timestamptz at time zone 'UTC')::date -
					(${days}::int - 1)
				) at time zone 'UTC' as current_start,
				${generatedAt}::timestamptz as current_end
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
