import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gte, isNull, lte, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { lifecycleEvents } from "@wandit/db/schema/lifecycle-events";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type EnqueueLifecycleEvent,
	isOncePerUserEvent,
	type LifecycleEventDropReason,
	type LifecycleEventName,
	lifecycleEventCooldownMs,
	lifecycleEventHoldMs,
	lifecycleEventIdempotencyKey,
} from "../../domain/lifecycle-event";

const LIFECYCLE_SELF_HEAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export const LIFECYCLE_SELF_HEAL_SINCE = new Date("2026-08-24T00:00:00Z");

export type LifecycleEventRow = typeof lifecycleEvents.$inferSelect;

export type LifecycleEventsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type LifecycleEventsDbClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

export type LifecycleEntitledSubscription = {
	currentPeriodEnd: Date;
	plan: "pro" | "business";
	provider: string;
	status: string;
};

export type LifecycleDispatchContext = {
	acceptedInvitation: boolean;
	capturedEvents: LifecycleEventName[];
	entitledSubscription: LifecycleEntitledSubscription | null;
	hasFirstPromptEvent: boolean;
	hasOpenPersonalManualRequest: boolean;
	hasPersonalTopupReceipt: boolean;
	user: {
		email: string;
		name: string;
	};
};

type LifecycleDispatchContextDbRow = {
	accepted_invitation: boolean;
	captured_events: LifecycleEventName[] | null;
	email: string;
	entitled_current_period_end: Date | string | null;
	entitled_plan: "pro" | "business" | null;
	entitled_provider: string | null;
	entitled_status: string | null;
	has_first_prompt_event: boolean;
	has_open_personal_manual_request: boolean;
	has_personal_topup_receipt: boolean;
	name: string;
};

@Injectable()
export class LifecycleEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async enqueue(
		input: EnqueueLifecycleEvent,
		transaction?: LifecycleEventsTransaction,
	): Promise<LifecycleEventRow | null> {
		const now = new Date();
		const cooldownMs = lifecycleEventCooldownMs(input.event);

		if (cooldownMs === 0) {
			return this.insert(input, now, transaction ?? this.db);
		}

		if (transaction) {
			return this.enqueueWithCooldown(input, now, cooldownMs, transaction);
		}

		return this.db.transaction((tx) =>
			this.enqueueWithCooldown(input, now, cooldownMs, tx),
		);
	}

	listDue(limit = 100, now = new Date()): Promise<LifecycleEventRow[]> {
		return this.buildListDueQuery(limit, now);
	}

	/**
	 * Repairs signup callbacks that failed after the user row committed. The
	 * feature watermark avoids capturing historical signups, while the rolling
	 * window keeps every scheduled sweep bounded to recent users.
	 */
	async healMissingSignupEvents(now = new Date()): Promise<number> {
		const rollingSince = new Date(
			now.getTime() - LIFECYCLE_SELF_HEAL_WINDOW_MS,
		);
		const createdSince = new Date(
			Math.max(rollingSince.getTime(), LIFECYCLE_SELF_HEAL_SINCE.getTime()),
		);
		const result = await this.db.execute<{ id: string }>(sql`
			insert into ${lifecycleEvents} (
				user_id,
				event,
				payload,
				idempotency_key,
				dispatch_after
			)
			select
				u.id,
				'signup_completed'::lifecycle_event_name,
				'{}'::jsonb,
				'signup_completed:' || u.id,
				${now}
			from ${user} u
			where u.created_at >= ${createdSince}
				and u.created_at <= ${now}
				and not exists (
					select 1
					from ${lifecycleEvents} captured
					where captured.idempotency_key = 'signup_completed:' || u.id
				)
			on conflict (idempotency_key) do nothing
			returning id
		`);

		return result.rows.length;
	}

	async markDispatched(id: string, dispatchedAt = new Date()): Promise<void> {
		await this.db
			.update(lifecycleEvents)
			.set({
				attempts: sql`${lifecycleEvents.attempts} + 1`,
				dispatchedAt,
				lastError: null,
			})
			.where(this.pendingByIdPredicate(id));
	}

	async markDropped(
		id: string,
		reason: LifecycleEventDropReason,
		droppedAt = new Date(),
	): Promise<void> {
		await this.db
			.update(lifecycleEvents)
			.set({
				dropReason: reason,
				droppedAt,
				lastError: null,
			})
			.where(this.pendingByIdPredicate(id));
	}

	async markFailed(id: string, error: string): Promise<void> {
		await this.db
			.update(lifecycleEvents)
			.set({
				attempts: sql`${lifecycleEvents.attempts} + 1`,
				lastError: error,
			})
			.where(this.pendingByIdPredicate(id));
	}

	async listCapturedEvents(
		userId: string,
		client: LifecycleEventsDbClient = this.db,
	): Promise<LifecycleEventName[]> {
		const rows = await client
			.select({ event: lifecycleEvents.event })
			.from(lifecycleEvents)
			.where(eq(lifecycleEvents.userId, userId))
			.orderBy(asc(lifecycleEvents.createdAt));

		return rows.map((row) => row.event);
	}

	async loadDispatchContext(
		userId: string,
		now = new Date(),
	): Promise<LifecycleDispatchContext | null> {
		const result = await this.db.execute<LifecycleDispatchContextDbRow>(sql`
			select
				u.email,
				u.name,
				entitled.plan as entitled_plan,
				entitled.provider as entitled_provider,
				entitled.status as entitled_status,
				entitled.current_period_end as entitled_current_period_end,
				exists (
					select 1
					from billing_topup_receipts receipt
					where receipt.user_id = u.id
						and receipt.organization_id is null
				) as has_personal_topup_receipt,
				exists (
					select 1
					from manual_subscription_requests request
					where request.user_id = u.id
						and request.organization_id is null
						and request.status in ('pending', 'contacted')
				) as has_open_personal_manual_request,
				exists (
					select 1
					from invitation accepted
					where accepted.email = u.email
						and accepted.status = 'accepted'
				) as accepted_invitation,
				exists (
					select 1
					from lifecycle_events prompt
					where prompt.user_id = u.id
						and prompt.event = 'first_prompt_sent'
				) as has_first_prompt_event,
				coalesce((
					select array_agg(distinct captured.event::text)
					from lifecycle_events captured
					where captured.user_id = u.id
				), array[]::text[]) as captured_events
			from "user" u
			left join lateral (
				select
					s.plan,
					s.provider,
					s.status,
					s.current_period_end
				from subscriptions s
				where s.user_id = u.id
					and s.organization_id is null
					and s.status in ('active', 'trialing')
					and (
						s.provider <> 'manual'
						or s.current_period_end + (
							coalesce((
								select settings.manual_grace_days
								from product_settings settings
								where settings.id = 1
							), 0) * interval '1 day'
						) > ${now}
					)
				order by s.updated_at desc
				limit 1
			) entitled on true
			where u.id = ${userId}
			limit 1
		`);
		const row = result.rows[0];

		if (!row) {
			return null;
		}

		const entitledSubscription = this.mapEntitledSubscription(row);

		return {
			acceptedInvitation: row.accepted_invitation,
			capturedEvents: row.captured_events ?? [],
			entitledSubscription,
			hasFirstPromptEvent: row.has_first_prompt_event,
			hasOpenPersonalManualRequest: row.has_open_personal_manual_request,
			hasPersonalTopupReceipt: row.has_personal_topup_receipt,
			user: {
				email: row.email,
				name: row.name,
			},
		};
	}

	private async enqueueWithCooldown(
		input: EnqueueLifecycleEvent,
		now: Date,
		cooldownMs: number,
		transaction: LifecycleEventsTransaction,
	): Promise<LifecycleEventRow | null> {
		await transaction.execute(
			sql`select pg_advisory_xact_lock(hashtext(${this.cooldownLockValue(input)}))`,
		);

		const cutoff = new Date(now.getTime() - cooldownMs);
		const [recent] = await this.buildRecentEventQuery(
			input.userId,
			input.event,
			cutoff,
			transaction,
		);

		if (recent) {
			return null;
		}

		return this.insert(input, now, transaction);
	}

	private async insert(
		input: EnqueueLifecycleEvent,
		now: Date,
		client: LifecycleEventsDbClient,
	): Promise<LifecycleEventRow | null> {
		const [inserted] = await client
			.insert(lifecycleEvents)
			.values({
				dispatchAfter:
					input.dispatchAfter ??
					new Date(now.getTime() + lifecycleEventHoldMs(input.event)),
				event: input.event,
				idempotencyKey: isOncePerUserEvent(input.event)
					? lifecycleEventIdempotencyKey(input.event, input.userId)
					: input.idempotencyKey,
				payload: input.payload ?? {},
				userId: input.userId,
			})
			.onConflictDoNothing({ target: lifecycleEvents.idempotencyKey })
			.returning();

		return inserted ?? null;
	}

	private buildRecentEventQuery(
		userId: string,
		event: LifecycleEventName,
		cutoff: Date,
		client: LifecycleEventsDbClient = this.db,
	) {
		return client
			.select({ id: lifecycleEvents.id })
			.from(lifecycleEvents)
			.where(
				and(
					eq(lifecycleEvents.userId, userId),
					eq(lifecycleEvents.event, event),
					gte(lifecycleEvents.createdAt, cutoff),
				),
			)
			.limit(1);
	}

	private buildListDueQuery(limit: number, now: Date) {
		return this.db
			.select()
			.from(lifecycleEvents)
			.where(
				and(
					isNull(lifecycleEvents.dispatchedAt),
					isNull(lifecycleEvents.droppedAt),
					lte(lifecycleEvents.dispatchAfter, now),
				),
			)
			.orderBy(
				asc(lifecycleEvents.dispatchAfter),
				asc(lifecycleEvents.createdAt),
			)
			.limit(limit);
	}

	private pendingByIdPredicate(id: string) {
		return and(
			eq(lifecycleEvents.id, id),
			isNull(lifecycleEvents.dispatchedAt),
			isNull(lifecycleEvents.droppedAt),
		);
	}

	private cooldownLockValue(input: EnqueueLifecycleEvent): string {
		return `lifecycle-event:${input.event}:${input.userId}`;
	}

	private mapEntitledSubscription(
		row: LifecycleDispatchContextDbRow,
	): LifecycleEntitledSubscription | null {
		if (
			!row.entitled_plan ||
			!row.entitled_provider ||
			!row.entitled_status ||
			!row.entitled_current_period_end
		) {
			return null;
		}

		return {
			currentPeriodEnd:
				row.entitled_current_period_end instanceof Date
					? row.entitled_current_period_end
					: new Date(row.entitled_current_period_end),
			plan: row.entitled_plan,
			provider: row.entitled_provider,
			status: row.entitled_status,
		};
	}
}
