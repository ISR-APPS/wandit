import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminListUsersQuery,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type PaginatedResult,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	ilike,
	isNull,
	notInArray,
	or,
	sql,
} from "@wandit/db";
import { session, user } from "@wandit/db/schema/auth";
import { betaAccessEvents, subscriptions } from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type AdminUserSummaryRow = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: string;
	earlyAccess: boolean;
	banned: boolean | null;
	createdAt: Date;
	lastSeenAt: Date | null;
	plan: string | null;
	creditsBalance: number;
	projectsCount: number;
};

export type AdminUserDetailRow = AdminUserSummaryRow & {
	updatedAt: Date;
	banReason: string | null;
};

export type AdminSubscriptionRow = {
	plan: (typeof subscriptions.plan)["_"]["data"];
	status: string;
	interval: (typeof subscriptions.interval)["_"]["data"];
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
};

export type AdminProjectRow = {
	id: string;
	name: string;
	createdAt: Date;
};

export type AdminProjectDetailRow = {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	ownerId: string;
	ownerName: string;
	ownerEmail: string;
};

export type AdminCreditLedgerRow = {
	id: string;
	delta: number;
	kind: (typeof creditLedger.kind)["_"]["data"];
	bucket: (typeof creditLedger.bucket)["_"]["data"];
	meta: unknown;
	createdAt: Date;
};

export type AdminSignupPointRow = {
	date: string;
	count: number;
};

export type AdminTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type AdminDbClient = Pick<Database, "insert" | "select" | "update">;

const entitledStatuses = [...ENTITLED_SUBSCRIPTION_STATUSES];

// Same terminal set as the subscriptions_userId_nonTerminal_uq partial index
// (packages/db/src/schema/billing.ts) and SubscriptionsRepository
// .findActiveByUserId — there is no shared constant to import.
const TERMINAL_SUBSCRIPTION_STATUSES = ["canceled", "incomplete_expired"];

@Injectable()
export class AdminRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	withUserTransaction<T>(
		userId: string,
		fn: (tx: AdminTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

			return fn(tx);
		});
	}

	async listUsers(
		query: AdminListUsersQuery,
	): Promise<PaginatedResult<AdminUserSummaryRow>> {
		const where = this.buildSearchFilter(query.q);
		const offset = (query.page - 1) * query.pageSize;

		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(user)
			.where(where);

		const items: AdminUserSummaryRow[] = await this.db
			.select(this.summaryColumns())
			.from(user)
			.where(where)
			.orderBy(...this.buildOrderBy(query.sort))
			.limit(query.pageSize)
			.offset(offset);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async findUserDetail(userId: string): Promise<AdminUserDetailRow | null> {
		const [row] = await this.db
			.select({
				...this.summaryColumns(),
				updatedAt: user.updatedAt,
				banReason: user.banReason,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	async findUserAccess(
		userId: string,
		client: AdminDbClient = this.db,
	): Promise<{ id: string; role: string } | null> {
		const [row] = await client
			.select({ id: user.id, role: user.role })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * The subscription the detail card shows.
	 *
	 * Deliberately NOT filtered on the entitled statuses: past_due / unpaid /
	 * incomplete are paying-but-broken customers, and hiding those rows makes
	 * them indistinguishable from free users. Uses the non-terminal predicate
	 * instead, so the real status surfaces and the SPA can render it.
	 */
	async findLatestSubscription(
		userId: string,
	): Promise<AdminSubscriptionRow | null> {
		const [row] = await this.db
			.select({
				plan: subscriptions.plan,
				status: subscriptions.status,
				interval: subscriptions.interval,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
				cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
			})
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.userId, userId),
					notInArray(subscriptions.status, TERMINAL_SUBSCRIPTION_STATUSES),
				),
			)
			.orderBy(desc(subscriptions.createdAt))
			.limit(1);

		return row ?? null;
	}

	listRecentProjects(
		userId: string,
		limit: number,
	): Promise<AdminProjectRow[]> {
		return this.db
			.select({
				id: projects.id,
				name: projects.name,
				createdAt: projects.createdAt,
			})
			.from(projects)
			.where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
			.orderBy(desc(projects.createdAt), desc(projects.id))
			.limit(limit);
	}

	async findProjectDetail(
		projectId: string,
	): Promise<AdminProjectDetailRow | null> {
		const [row] = await this.db
			.select({
				createdAt: projects.createdAt,
				id: projects.id,
				name: projects.name,
				ownerEmail: user.email,
				ownerId: user.id,
				ownerName: user.name,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.innerJoin(user, eq(user.id, projects.userId))
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);

		return row ?? null;
	}

	listRecentCreditLedger(
		userId: string,
		limit: number,
	): Promise<AdminCreditLedgerRow[]> {
		return this.db
			.select({
				id: creditLedger.id,
				delta: creditLedger.delta,
				kind: creditLedger.kind,
				bucket: creditLedger.bucket,
				meta: creditLedger.meta,
				createdAt: creditLedger.createdAt,
			})
			.from(creditLedger)
			.where(eq(creditLedger.userId, userId))
			.orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
			.limit(limit);
	}

	async updateUserRole(userId: string, role: string): Promise<void> {
		await this.db.update(user).set({ role }).where(eq(user.id, userId));
	}

	async setUserEarlyAccess(
		userId: string,
		earlyAccess: boolean,
		client: AdminDbClient = this.db,
	): Promise<void> {
		await client.update(user).set({ earlyAccess }).where(eq(user.id, userId));
	}

	async insertBetaAccessEvent(
		input: {
			action: "granted" | "revoked";
			actorUserId: string;
			reason: string | null;
			userId: string;
		},
		client: AdminDbClient = this.db,
	): Promise<void> {
		await client.insert(betaAccessEvents).values(input);
	}

	async setUserBanned(
		userId: string,
		banned: boolean,
		reason: string | null,
	): Promise<void> {
		await this.db
			.update(user)
			.set({
				banned,
				banReason: banned ? reason : null,
			})
			.where(eq(user.id, userId));
	}

	async deleteUserSessions(userId: string): Promise<void> {
		await this.db.delete(session).where(eq(session.userId, userId));
	}

	/** Zero-filled per-UTC-day signup counts for the last `days` days. */
	async getSignupSeries(days: number): Promise<AdminSignupPointRow[]> {
		const result = await this.db.execute<{ date: string; count: number }>(sql`
			select
				to_char(d.day, 'YYYY-MM-DD') as date,
				coalesce(s.signups, 0)::int as count
			from generate_series(
				(now() at time zone 'utc')::date - (${days}::int - 1),
				(now() at time zone 'utc')::date,
				interval '1 day'
			) as d(day)
			left join (
				select
					("user"."created_at" at time zone 'utc')::date as day,
					count(*)::int as signups
				from "user"
				where ("user"."created_at" at time zone 'utc')::date
					>= (now() at time zone 'utc')::date - (${days}::int - 1)
				group by 1
			) s on s.day = d.day::date
			order by d.day asc
		`);

		return result.rows.map((row) => ({
			date: String(row.date),
			count: Number(row.count),
		}));
	}

	async countUsers(): Promise<number> {
		const [row] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(user);

		return row?.total ?? 0;
	}

	/**
	 * Per-user aggregates as correlated scalar subqueries — one row per user,
	 * so LIMIT/OFFSET pagination and the total count stay correct (no
	 * row-multiplying joins).
	 *
	 * Identifiers inside the subqueries are written out fully qualified: in a
	 * join-less select, drizzle strips table prefixes from embedded column
	 * refs, which would break the correlation with the outer "user" row.
	 */
	private summaryColumns() {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
			role: user.role,
			earlyAccess: user.earlyAccess,
			banned: user.banned,
			createdAt: user.createdAt,
			lastSeenAt: user.lastSeenAt,
			plan: sql<string | null>`(
				select "subscriptions"."plan"
				from "subscriptions"
				where "subscriptions"."user_id" = "user"."id"
					and "subscriptions"."status" in (${sql.join(
						entitledStatuses.map((status) => sql`${status}`),
						sql`, `,
					)})
				order by "subscriptions"."created_at" desc
				limit 1
			)`,
			creditsBalance: sql<number>`coalesce((
				select sum("credit_ledger"."delta")
				from "credit_ledger"
				where "credit_ledger"."user_id" = "user"."id"
			), 0)::int`,
			projectsCount: sql<number>`(
				select count(*)
				from "projects"
				where "projects"."user_id" = "user"."id"
					and "projects"."deleted_at" is null
			)::int`,
		};
	}

	private buildSearchFilter(q: string | undefined) {
		if (!q) {
			return undefined;
		}

		const pattern = `%${escapeLikePattern(q)}%`;

		return or(ilike(user.name, pattern), ilike(user.email, pattern));
	}

	private buildOrderBy(sort: AdminListUsersQuery["sort"]) {
		switch (sort) {
			case "oldest":
				return [asc(user.createdAt), asc(user.id)];
			case "name":
				return [asc(user.name), asc(user.id)];
			case "email":
				return [asc(user.email)];
			default:
				return [desc(user.createdAt), desc(user.id)];
		}
	}
}

// Escape LIKE wildcards so a search for "100%" matches literally.
function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
