import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminListPublicationsQuery,
	type AdminListUsersQuery,
	type AdminUserPagesQuery,
	adminPublicationStatuses,
	adminUserPlans,
	adminUserPublicationStates,
	adminUserRoles,
	adminUserStatuses,
	adminUserVerificationStatuses,
	creditsToCentiCredits,
	dialCountries,
	dialCountryIsoCodes,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type PaginatedResult,
	preferredCountryIsoByDial,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	notInArray,
	or,
	type SQL,
	sql,
} from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { session, user } from "@wandit/db/schema/auth";
import { subscriptions } from "@wandit/db/schema/billing";
import { aiUsageEvents, creditLedger } from "@wandit/db/schema/credits";
import { deployments } from "@wandit/db/schema/deployments";
import { domains } from "@wandit/db/schema/domains";
import { pageGenerationAttempts } from "@wandit/db/schema/page-attempts";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	AI_SPEND_STATUSES,
	aiUsageEventCostProvenance,
	aiUsageEventCostUsdMicros,
} from "./ai-usage-cost.sql";

export type AdminUserSummaryRow = {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	countryCode: string | null;
	emailVerified: boolean;
	image: string | null;
	role: string;
	banned: boolean | null;
	createdAt: Date;
	lastSeenAt: Date | null;
	plan: string | null;
	// UNIT: integer centi-credits (ledger sums); mappers divide by 100.
	creditsBalance: number;
	creditsConsumed: number;
	projectsCount: number;
};

export type AdminUserDetailRow = AdminUserSummaryRow & {
	updatedAt: Date;
	banReason: string | null;
};

export type AdminSubscriptionRow = {
	id: string;
	provider: string;
	plan: (typeof subscriptions.plan)["_"]["data"];
	status: string;
	interval: (typeof subscriptions.interval)["_"]["data"];
	tierCredits: number;
	pendingTierCredits: number | null;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
};

export type AdminProjectRow = {
	id: string;
	name: string;
	createdAt: Date;
};

export type AdminUserProjectsListOptions = {
	limit: number;
	offset: number;
	order: "asc" | "desc";
};

export type AdminUserPageRow = {
	projectId: string;
	projectName: string;
	organizationId: string | null;
	previewImageUrl: string | null;
	projectCreatedAt: Date;
	projectUpdatedAt: Date | string;
	activeVersionId: string | null;
	activeVersionNumber: number | null;
	activeVersionCreatedAt: Date | null;
	latestGenerationStatus:
		| (typeof pageGenerationAttempts.status)["_"]["data"]
		| null;
	latestGenerationCreatedAt: Date | null;
	latestGenerationCompletedAt: Date | null;
	activeDeploymentSlug: string | null;
	activeDeploymentUpdatedAt: Date | null;
	latestDeploymentStatus: (typeof deployments.status)["_"]["data"] | null;
	primaryDomainName: string | null;
	primaryDomainStatus: (typeof domains.status)["_"]["data"] | null;
};

export type AdminPublicationRow = {
	deploymentId: string;
	// WHERE-restricted to the publication statuses; the wider column type keeps
	// the drizzle select assignable.
	status: (typeof deployments.status)["_"]["data"];
	slug: string;
	deploymentCreatedAt: Date;
	projectId: string;
	projectName: string;
	organizationId: string | null;
	userId: string;
	userName: string;
	userEmail: string;
	userImage: string | null;
	// Lateral already restricts to the primary ACTIVE domain, so the name alone
	// tells the mapper whether a live custom-domain URL exists.
	primaryDomainName: string | null;
};

export type AdminProjectDetailRow = {
	id: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
	organizationId: string | null;
	ownerId: string;
	ownerName: string;
	ownerEmail: string;
};

export type AdminCreditLedgerRow = {
	id: string;
	// UNIT: integer centi-credits; mappers divide by 100.
	delta: number;
	kind: (typeof creditLedger.kind)["_"]["data"];
	bucket: (typeof creditLedger.bucket)["_"]["data"];
	meta: unknown;
	createdAt: Date;
	aiModel: string | null;
	aiProvider: string | null;
	aiCostUsdMicros: number | null;
	aiCostProvenance: string | null;
};

export type AdminAiSpendRow = {
	totalCostUsdMicros: number;
	meteredOperations: number;
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

const dialCountryCodeListSql = sql.raw(
	dialCountryIsoCodes.map(sqlStringLiteral).join(", "),
);

const countryDialValuesSql = sql.raw(
	dialCountries
		.map(
			({ iso, dial }) =>
				`(${sqlStringLiteral(iso)}, ${sqlStringLiteral(dial)})`,
		)
		.join(", "),
);

const countryByDial = new Map<string, string>();
for (const country of dialCountries) {
	countryByDial.set(
		country.dial,
		preferredCountryIsoByDial[
			country.dial as keyof typeof preferredCountryIsoByDial
		] ?? country.iso,
	);
}

const dialCountryValuesSql = sql.raw(
	[...countryByDial]
		.sort(
			([dialA], [dialB]) =>
				dialB.length - dialA.length || dialA.localeCompare(dialB),
		)
		.map(
			([dial, countryCode]) =>
				`(${sqlStringLiteral(dial)}, ${sqlStringLiteral(countryCode)})`,
		)
		.join(", "),
);

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

	/**
	 * One repeatable-read read-only snapshot for multi-query admin reads. A
	 * (rare) serialization failure is retried once; read-only transactions
	 * never leave partial writes behind.
	 */
	async readTransaction<T>(
		fn: (tx: AdminTransaction) => Promise<T>,
	): Promise<T> {
		try {
			return await this.db.transaction(fn, {
				accessMode: "read only",
				isolationLevel: "repeatable read",
			});
		} catch (error) {
			if (!isSerializationFailure(error)) {
				throw error;
			}

			return this.db.transaction(fn, {
				accessMode: "read only",
				isolationLevel: "repeatable read",
			});
		}
	}

	async listUsers(
		query: AdminListUsersQuery,
	): Promise<PaginatedResult<AdminUserSummaryRow>> {
		const { countQuery, listQuery } = this.buildListUsersQueries(query);
		const [totalRow] = await countQuery;
		const items: AdminUserSummaryRow[] = await listQuery;

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	private buildListUsersQueries(query: AdminListUsersQuery) {
		const where = this.buildUsersFilter(query);
		const offset = (query.page - 1) * query.pageSize;

		const countQuery = this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(user)
			.where(where);

		const listQuery = this.db
			.select(this.summaryColumns())
			.from(user)
			.where(where)
			.orderBy(...this.buildOrderBy(query.sort))
			.limit(query.pageSize)
			.offset(offset);

		return { countQuery, listQuery };
	}

	async listUserPages(
		userId: string,
		query: AdminUserPagesQuery,
	): Promise<PaginatedResult<AdminUserPageRow>> {
		const { countQuery, listQuery } = this.buildUserPagesQueries(userId, query);
		const [totalRow] = await countQuery;
		const items: AdminUserPageRow[] = await listQuery;

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	private buildUserPagesQueries(userId: string, query: AdminUserPagesQuery) {
		const where = and(
			eq(projects.userId, userId),
			isNull(projects.deletedAt),
			eq(artifacts.kind, "landing_page"),
		);
		const offset = (query.page - 1) * query.pageSize;

		const countQuery = this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(projects)
			.innerJoin(artifacts, eq(artifacts.projectId, projects.id))
			.where(where);

		const activeVersion = this.db
			.select({
				id: versions.id,
				number: versions.number,
				createdAt: versions.createdAt,
			})
			.from(versions)
			.where(
				and(
					eq(versions.id, artifacts.activeVersionId),
					eq(versions.artifactId, artifacts.id),
					eq(versions.projectId, projects.id),
				),
			)
			.limit(1)
			.as("active_version");

		// TODO(perf): add (project_id, created_at desc) indexes to page_generation_attempts and deployments.
		const latestGeneration = this.db
			.select({
				status: pageGenerationAttempts.status,
				createdAt: pageGenerationAttempts.createdAt,
				completedAt: pageGenerationAttempts.completedAt,
			})
			.from(pageGenerationAttempts)
			.where(
				and(
					eq(pageGenerationAttempts.projectId, projects.id),
					eq(pageGenerationAttempts.artifactId, artifacts.id),
				),
			)
			.orderBy(
				desc(pageGenerationAttempts.createdAt),
				desc(pageGenerationAttempts.id),
			)
			.limit(1)
			.as("latest_generation");

		const activeDeployment = this.db
			.select({
				slug: deployments.slug,
				updatedAt: deployments.updatedAt,
			})
			.from(deployments)
			.where(
				and(
					eq(deployments.projectId, projects.id),
					eq(deployments.status, "active"),
				),
			)
			.limit(1)
			.as("active_deployment");

		const latestDeployment = this.db
			.select({ status: deployments.status })
			.from(deployments)
			.where(eq(deployments.projectId, projects.id))
			.orderBy(desc(deployments.createdAt), desc(deployments.id))
			.limit(1)
			.as("latest_deployment");

		const primaryDomain = this.db
			.select({ name: domains.name, status: domains.status })
			.from(domains)
			.where(
				and(
					eq(domains.projectId, projects.id),
					eq(domains.isPrimary, true),
					eq(domains.status, "active"),
				),
			)
			.limit(1)
			.as("primary_domain");

		const listQuery = this.db
			.select({
				projectId: projects.id,
				projectName: projects.name,
				organizationId: projects.organizationId,
				previewImageUrl: projects.previewImageUrl,
				projectCreatedAt: projects.createdAt,
				projectUpdatedAt: userPageActivityTimestamp(),
				activeVersionId: activeVersion.id,
				activeVersionNumber: activeVersion.number,
				activeVersionCreatedAt: activeVersion.createdAt,
				latestGenerationStatus: latestGeneration.status,
				latestGenerationCreatedAt: latestGeneration.createdAt,
				latestGenerationCompletedAt: latestGeneration.completedAt,
				activeDeploymentSlug: activeDeployment.slug,
				activeDeploymentUpdatedAt: activeDeployment.updatedAt,
				latestDeploymentStatus: latestDeployment.status,
				primaryDomainName: primaryDomain.name,
				primaryDomainStatus: primaryDomain.status,
			})
			.from(projects)
			.innerJoin(artifacts, eq(artifacts.projectId, projects.id))
			.leftJoinLateral(activeVersion, sql`true`)
			.leftJoinLateral(latestGeneration, sql`true`)
			.leftJoinLateral(activeDeployment, sql`true`)
			.leftJoinLateral(latestDeployment, sql`true`)
			.leftJoinLateral(primaryDomain, sql`true`)
			.where(where)
			.orderBy(...this.buildUserPagesOrderBy(query.sort))
			.limit(query.pageSize)
			.offset(offset);

		return { countQuery, listQuery };
	}

	async listPublications(
		query: AdminListPublicationsQuery,
	): Promise<PaginatedResult<AdminPublicationRow>> {
		const { countQuery, listQuery } = this.buildListPublicationsQueries(query);
		const [totalRow] = await countQuery;
		const items: AdminPublicationRow[] = await listQuery;

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	// Platform-wide publish log: every deployment that went live at some point
	// (active/superseded/unpublished) — pending and failed attempts never did.
	// Soft-deleted projects stay IN the log: deleting a project does not
	// unpublish its site, so the log must keep naming the owner of a slug that
	// is still serving.
	private buildListPublicationsQueries(query: AdminListPublicationsQuery) {
		const where = inArray(deployments.status, [...adminPublicationStatuses]);
		const offset = (query.page - 1) * query.pageSize;

		// No projects join needed for counting: deployments.project_id and
		// projects.user_id are NOT NULL FKs, so the list query's inner joins
		// can never drop a row and both queries agree on the total.
		const countQuery = this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(deployments)
			.where(where);

		const primaryDomain = this.db
			.select({ name: domains.name })
			.from(domains)
			.where(
				and(
					eq(domains.projectId, projects.id),
					eq(domains.isPrimary, true),
					eq(domains.status, "active"),
				),
			)
			.limit(1)
			.as("primary_domain");

		const listQuery = this.db
			.select({
				deploymentId: deployments.id,
				status: deployments.status,
				slug: deployments.slug,
				deploymentCreatedAt: deployments.createdAt,
				projectId: projects.id,
				projectName: projects.name,
				organizationId: projects.organizationId,
				userId: user.id,
				userName: user.name,
				userEmail: user.email,
				userImage: user.image,
				primaryDomainName: primaryDomain.name,
			})
			.from(deployments)
			.innerJoin(projects, eq(projects.id, deployments.projectId))
			.innerJoin(user, eq(user.id, projects.userId))
			.leftJoinLateral(primaryDomain, sql`true`)
			.where(where)
			.orderBy(desc(deployments.createdAt), desc(deployments.id))
			.limit(query.pageSize)
			.offset(offset);

		return { countQuery, listQuery };
	}

	async findUserDetail(
		userId: string,
		client: AdminDbClient = this.db,
	): Promise<AdminUserDetailRow | null> {
		const [row] = await client
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
		client: AdminDbClient = this.db,
	): Promise<AdminSubscriptionRow | null> {
		const [row] = await client
			.select({
				id: subscriptions.id,
				provider: subscriptions.provider,
				plan: subscriptions.plan,
				status: subscriptions.status,
				interval: subscriptions.interval,
				tierCredits: subscriptions.tierCredits,
				pendingTierCredits: subscriptions.pendingTierCredits,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
				cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
			})
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.userId, userId),
					// Personal rows only: org subscriptions carry the purchasing
					// admin's userId as provenance and belong to the org pages.
					isNull(subscriptions.organizationId),
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
		client: AdminDbClient = this.db,
	): Promise<AdminProjectRow[]> {
		return this.listUserProjects(
			userId,
			{
				limit,
				offset: 0,
				order: "desc",
			},
			client,
		);
	}

	listUserProjects(
		userId: string,
		options: AdminUserProjectsListOptions,
		client: AdminDbClient = this.db,
	): Promise<AdminProjectRow[]> {
		return this.buildUserProjectsListQuery(userId, options, client);
	}

	async countUserProjects(userId: string): Promise<number> {
		const [row] = await this.buildUserProjectsCountQuery(userId);

		return row?.total ?? 0;
	}

	private buildUserProjectsCountQuery(userId: string) {
		return this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(projects)
			.where(userProjectsFilter(sql`${userId}`));
	}

	private buildUserProjectsListQuery(
		userId: string,
		options: AdminUserProjectsListOptions,
		client: AdminDbClient = this.db,
	) {
		const direction = options.order === "asc" ? asc : desc;

		return client
			.select({
				id: projects.id,
				name: projects.name,
				createdAt: projects.createdAt,
			})
			.from(projects)
			.where(userProjectsFilter(sql`${userId}`))
			.orderBy(direction(projects.createdAt), direction(projects.id))
			.limit(options.limit)
			.offset(options.offset);
	}

	async findProjectDetail(
		projectId: string,
	): Promise<AdminProjectDetailRow | null> {
		const [row] = await this.db
			.select({
				createdAt: projects.createdAt,
				id: projects.id,
				name: projects.name,
				organizationId: projects.organizationId,
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
		client: AdminDbClient = this.db,
	): Promise<AdminCreditLedgerRow[]> {
		return (
			client
				.select({
					id: creditLedger.id,
					delta: creditLedger.delta,
					kind: creditLedger.kind,
					bucket: creditLedger.bucket,
					meta: creditLedger.meta,
					createdAt: creditLedger.createdAt,
					aiModel: aiUsageEvents.model,
					aiProvider: aiUsageEvents.provider,
					// Cost only on consume rows: metering refund grants link to the
					// same operation but are credit compensation, not new spend.
					aiCostUsdMicros: sql<
						number | null
					>`case when ${creditLedger.kind} = 'consume' then ${aiUsageEventCostUsdMicros} end`.mapWith(
						aiUsageEvents.reconciledCostUsdMicros,
					),
					aiCostProvenance: sql<
						string | null
					>`case when ${creditLedger.kind} = 'consume' and ${aiUsageEventCostUsdMicros} is not null then ${aiUsageEventCostProvenance} end`,
				})
				.from(creditLedger)
				// Metering rows (reserve/settle consumes and refund grants) carry the
				// operation id in meta.usageEventId; every other kind joins to
				// nothing. Text comparison: a malformed historical id must not fail
				// the whole query with a cast error.
				.leftJoin(
					aiUsageEvents,
					sql`${creditLedger.meta} ->> 'usageEventId' = ${aiUsageEvents.id}::text`,
				)
				// Personal rows only: org consume rows record the acting member in
				// userId but the ORG pool paid — mixing them corrupts the money view.
				.where(
					and(
						eq(creditLedger.userId, userId),
						isNull(creditLedger.organizationId),
					),
				)
				.orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
				.limit(limit)
		);
	}

	// Actual AI-provider spend for the PERSONAL pool (org-workspace events are
	// the org page's money view). Completed operations only; ops without any
	// recorded provider cost count 0. Bigint: lifetime micros can pass 2^31.
	async sumAiSpendForUser(
		userId: string,
		client: AdminDbClient = this.db,
	): Promise<AdminAiSpendRow> {
		const [row] = await client
			.select({
				totalCostUsdMicros:
					sql<number>`coalesce(sum(coalesce(${aiUsageEventCostUsdMicros}, 0)), 0)::bigint`.mapWith(
						aiUsageEvents.reconciledCostUsdMicros,
					),
				meteredOperations: sql<number>`count(*)::int`,
			})
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.userId, userId),
					isNull(aiUsageEvents.organizationId),
					inArray(aiUsageEvents.status, [...AI_SPEND_STATUSES]),
				),
			);

		return row ?? { meteredOperations: 0, totalCostUsdMicros: 0 };
	}

	async updateUserRole(
		userId: string,
		role: string,
		client: AdminDbClient = this.db,
	): Promise<void> {
		await client.update(user).set({ role }).where(eq(user.id, userId));
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
		const userId = sql.raw('"user"."id"');

		return {
			id: user.id,
			name: user.name,
			email: user.email,
			phone: sql<string | null>`(
				select "user_onboarding"."answers" ->> 'phone'
				from "user_onboarding"
				where "user_onboarding"."user_id" = ${userId}
				limit 1
			)`,
			countryCode: userCountryCode(userId),
			emailVerified: user.emailVerified,
			image: user.image,
			role: user.role,
			banned: user.banned,
			createdAt: user.createdAt,
			lastSeenAt: user.lastSeenAt,
			plan: sql<string | null>`(
				select "subscriptions"."plan"
				from "subscriptions"
				where ${personalEntitledSubscriptionFilter(userId)}
				order by "subscriptions"."created_at" desc
				limit 1
			)`,
			creditsBalance: userCreditsBalance(userId),
			creditsConsumed: userCreditsConsumed(userId),
			projectsCount: userProjectsCount(userId),
		};
	}

	private buildUsersFilter(query: AdminListUsersQuery) {
		const filters: (SQL | undefined)[] = [];

		if (query.q) {
			const pattern = `%${escapeLikePattern(query.q)}%`;
			const searchFilters = [
				ilike(user.name, pattern),
				ilike(user.email, pattern),
			];

			// Phones are stored as E.164 (no separators), so strip the separators
			// a pasted number typically carries before matching.
			const phoneQuery = query.q.replace(/[\s\-().]/g, "");
			if (phoneQuery.length > 0) {
				const phonePattern = `%${escapeLikePattern(phoneQuery)}%`;
				const userId = sql.raw('"user"."id"');
				searchFilters.push(
					sql`exists (select 1
						from "user_onboarding"
						where "user_onboarding"."user_id" = ${userId}
							and "user_onboarding"."answers" ->> 'phone' ilike ${phonePattern})`,
				);
			}

			filters.push(or(...searchFilters));
		}

		if (query.plan && query.plan.length < adminUserPlans.length) {
			const userId = sql.raw('"user"."id"');
			const planFilters: SQL[] = [];

			if (query.plan.includes("free")) {
				planFilters.push(freePlanUserFilter(userId));
			}

			const paidPlans = query.plan.filter((plan) => plan !== "free");
			if (paidPlans.length > 0) {
				planFilters.push(personalEntitledSubscriptionExists(userId, paidPlans));
			}

			filters.push(or(...planFilters));
		}

		if (query.freeCredits) {
			const userId = sql.raw('"user"."id"');
			const creditsBalance = userCreditsBalance(userId);
			const balanceFilters = query.freeCredits.map((state) =>
				state === "consumed"
					? sql`${creditsBalance} <= 0`
					: sql`${creditsBalance} > 0`,
			);

			filters.push(
				and(
					freePlanUserFilter(userId),
					signupFreeCreditsGrantExists(userId),
					or(...balanceFilters),
				),
			);
		}

		if (query.country) {
			const countryCode = userCountryCode(sql.raw('"user"."id"'));
			const selectedCountryCodes = query.country.filter(
				(value) => value !== "unknown",
			);
			const countryFilters: SQL[] = [];

			if (selectedCountryCodes.length > 0) {
				countryFilters.push(
					sql`${countryCode} in (${sql.join(
						selectedCountryCodes.map((value) => sql`${value}`),
						sql`, `,
					)})`,
				);
			}

			if (query.country.includes("unknown")) {
				countryFilters.push(sql`${countryCode} is null`);
			}

			filters.push(or(...countryFilters));
		}

		if (query.role && query.role.length < adminUserRoles.length) {
			const adminRole = storedRoleIncludesAdmin(user.role);
			const supportRole = storedRoleIncludesSupport(user.role);
			const roleFilters: SQL[] = [];

			if (query.role.includes("admin")) {
				roleFilters.push(adminRole);
			}

			if (query.role.includes("support")) {
				roleFilters.push(sql`(${supportRole} and not ${adminRole})`);
			}

			if (query.role.includes("user")) {
				roleFilters.push(sql`(not ${adminRole} and not ${supportRole})`);
			}

			filters.push(or(...roleFilters));
		}

		if (query.status && query.status.length < adminUserStatuses.length) {
			filters.push(
				query.status.includes("banned")
					? sql`${user.banned} is true`
					: sql`${user.banned} is not true`,
			);
		}

		if (
			query.verified &&
			query.verified.length < adminUserVerificationStatuses.length
		) {
			filters.push(
				query.verified.includes("verified")
					? sql`${user.emailVerified} is true`
					: sql`${user.emailVerified} is not true`,
			);
		}

		if (
			query.published &&
			query.published.length < adminUserPublicationStates.length
		) {
			// A user is "published" when a non-deleted owned project has the live
			// deployment; the custom-domain tier additionally needs an active
			// domain attached to such a project. The domain can sit on an org
			// project created by a teammate (domains.user_id is the attacher, not
			// the project creator), so "unpublished" must exclude BOTH fragments
			// to keep the three states mutually exclusive.
			const liveDeployment = sql`select 1
				from "projects"
				inner join "deployments" on "deployments"."project_id" = "projects"."id"
				where "projects"."user_id" = ${sql.raw('"user"."id"')}
					and "projects"."deleted_at" is null
					and "deployments"."status" = 'active'`;
			const liveCustomDomain = sql`select 1
				from "domains"
				inner join "projects" on "projects"."id" = "domains"."project_id"
				inner join "deployments" on "deployments"."project_id" = "projects"."id"
				where "domains"."user_id" = ${sql.raw('"user"."id"')}
					and "domains"."status" = 'active'
					and "projects"."deleted_at" is null
					and "deployments"."status" = 'active'`;
			const publishedFilters: SQL[] = [];

			if (query.published.includes("unpublished")) {
				publishedFilters.push(
					sql`(not exists (${liveDeployment}) and not exists (${liveCustomDomain}))`,
				);
			}

			if (query.published.includes("subdomain")) {
				publishedFilters.push(
					sql`(exists (${liveDeployment}) and not exists (${liveCustomDomain}))`,
				);
			}

			if (query.published.includes("custom_domain")) {
				publishedFilters.push(sql`exists (${liveCustomDomain})`);
			}

			filters.push(or(...publishedFilters));
		}

		// Query bounds arrive in decimal credits; the ledger sums are integer
		// centi-credits, so scale the bounds x100 before comparing.
		const min =
			query.creditsUsedMin === undefined
				? undefined
				: creditsToCentiCredits(query.creditsUsedMin);
		const max =
			query.creditsUsedMax === undefined
				? undefined
				: creditsToCentiCredits(query.creditsUsedMax);
		if (min !== undefined || max !== undefined) {
			const creditsConsumed = userCreditsConsumed(sql.raw('"user"."id"'));

			filters.push(
				min !== undefined && max !== undefined
					? sql`${creditsConsumed} between ${min} and ${max}`
					: min !== undefined
						? sql`${creditsConsumed} >= ${min}`
						: sql`${creditsConsumed} <= ${max}`,
			);
		}

		return and(...filters);
	}

	private buildOrderBy(sort: AdminListUsersQuery["sort"]) {
		const userId = sql.raw('"user"."id"');

		switch (sort) {
			case "oldest":
				return [asc(user.createdAt), asc(user.id)];
			case "name":
				return [asc(user.name), asc(user.id)];
			case "email":
				return [asc(user.email)];
			case "most_projects":
				return [desc(userProjectsCount(userId)), desc(user.id)];
			case "most_credits":
				return [desc(userCreditsBalance(userId)), desc(user.id)];
			case "most_consumed":
				return [desc(userCreditsConsumed(userId)), desc(user.id)];
			case "recently_seen":
				return [sql`${user.lastSeenAt} desc nulls last`, desc(user.id)];
			default:
				return [desc(user.createdAt), desc(user.id)];
		}
	}

	private buildUserPagesOrderBy(sort: AdminUserPagesQuery["sort"]) {
		switch (sort) {
			case "oldest":
				return [asc(projects.createdAt), asc(projects.id)];
			case "newest":
				return [desc(projects.createdAt), desc(projects.id)];
			default:
				return [desc(userPageActivityTimestamp()), desc(projects.id)];
		}
	}
}

/**
 * Best available country for an admin user. The picker ISO is authoritative
 * when its shared dial code matches the stored phone; older or inconsistent
 * rows fall back to longest-prefix E.164 inference, then the signup-IP
 * attribution when that country is also in the dial-list vocabulary.
 *
 * Both related tables stay in correlated scalar subqueries so list pagination
 * remains one outer row per user.
 */
function userCountryCode(userId: SQL) {
	return sql<string | null>`coalesce(
		(
			select coalesce(
				case
					when upper(btrim("user_onboarding"."answers" ->> 'phone_country'))
						in (${dialCountryCodeListSql})
						and exists (
							select 1
							from (values ${countryDialValuesSql})
								as "picker_country"("country_code", "dial_code")
							where "picker_country"."country_code" =
								upper(btrim("user_onboarding"."answers" ->> 'phone_country'))
								and "user_onboarding"."answers" ->> 'phone'
									like '+' || "picker_country"."dial_code" || '%'
						)
					then upper(btrim("user_onboarding"."answers" ->> 'phone_country'))
				end,
				(
					select "dial_country"."country_code"
					from (values ${dialCountryValuesSql})
						as "dial_country"("dial_code", "country_code")
					where "user_onboarding"."answers" ->> 'phone'
						~ '^\\+[1-9][0-9]{7,14}$'
						and "user_onboarding"."answers" ->> 'phone'
						like '+' || "dial_country"."dial_code" || '%'
					order by length("dial_country"."dial_code") desc
					limit 1
				)
			)
			from "user_onboarding"
			where "user_onboarding"."user_id" = ${userId}
			limit 1
		),
		(
			select upper(btrim("user_attributions"."country"))
			from "user_attributions"
			where "user_attributions"."user_id" = ${userId}
				and upper(btrim("user_attributions"."country"))
					in (${dialCountryCodeListSql})
			limit 1
		)
	)`;
}

function userPageActivityTimestamp() {
	return sql<
		Date | string
	>`greatest(${projects.updatedAt}, ${artifacts.updatedAt})`;
}

// Raw qualified identifiers are deliberate: Drizzle strips table prefixes
// from embedded column references inside a join-less scalar subquery.
function userProjectsFilter(userId: SQL) {
	return sql`"projects"."user_id" = ${userId}
		and "projects"."deleted_at" is null`;
}

function userProjectsCount(userId: SQL) {
	return sql<number>`(
		select count(*)
		from "projects"
		where ${userProjectsFilter(userId)}
	)::int`;
}

function userCreditsBalance(userId: SQL) {
	return sql<number>`coalesce((
		select sum("credit_ledger"."delta")
		from "credit_ledger"
		where "credit_ledger"."user_id" = ${userId}
			and "credit_ledger"."organization_id" is null
	), 0)::int`;
}

// Net lifetime consumption. Metering reserves credits up front ('consume' rows)
// and reverses over-reserves and failed generations as positive 'grant' rows
// keyed 'settle-refund:%' / 'reconcile-refund:%' / 'refund:%' — counting those
// reversals as negative consumption is what keeps a refunded failure from
// reading as credits "used".
function userCreditsConsumed(userId: SQL) {
	return sql<number>`coalesce((
		select -sum("credit_ledger"."delta")
		from "credit_ledger"
		where "credit_ledger"."user_id" = ${userId}
			and "credit_ledger"."organization_id" is null
			and ("credit_ledger"."kind" = 'consume'
				or ("credit_ledger"."kind" = 'grant'
					and ("credit_ledger"."idempotency_key" like 'settle-refund:%'
						or "credit_ledger"."idempotency_key" like 'reconcile-refund:%'
						or "credit_ledger"."idempotency_key" like 'refund:%')))
	), 0)::int`;
}

function personalEntitledSubscriptionFilter(userId: SQL) {
	return sql`"subscriptions"."user_id" = ${userId}
		and "subscriptions"."organization_id" is null
		and "subscriptions"."status" in (${sql.join(
			entitledStatuses.map((status) => sql`${status}`),
			sql`, `,
		)})`;
}

function personalEntitledSubscriptionExists(
	userId: SQL,
	plans?: readonly string[],
) {
	if (!plans || plans.length === 0) {
		return sql`exists (select 1
			from "subscriptions"
			where ${personalEntitledSubscriptionFilter(userId)})`;
	}

	return sql`exists (select 1
		from "subscriptions"
		where ${personalEntitledSubscriptionFilter(userId)}
			and "subscriptions"."plan" in (${sql.join(
				plans.map((plan) => sql`${plan}`),
				sql`, `,
			)}))`;
}

function freePlanUserFilter(userId: SQL) {
	return sql`not ${personalEntitledSubscriptionExists(userId)}`;
}

function signupFreeCreditsGrantExists(userId: SQL) {
	return sql`exists (select 1
		from "credit_ledger"
		where "credit_ledger"."user_id" = ${userId}
			and "credit_ledger"."organization_id" is null
			and "credit_ledger"."kind" = 'grant'
			and "credit_ledger"."bucket" = 'promo'
			and "credit_ledger"."idempotency_key" = 'signup:' || ${userId})`;
}

function storedRoleIncludesAdmin(role: typeof user.role) {
	return sql`exists (
		select 1
		from unnest(string_to_array(coalesce(${role}, ''), ',')) as role_part(value)
		where lower(trim(role_part.value)) = 'admin'
	)`;
}

function storedRoleIncludesSupport(role: typeof user.role) {
	return sql`exists (
		select 1
		from unnest(string_to_array(coalesce(${role}, ''), ',')) as role_part(value)
		where lower(trim(role_part.value)) = 'support'
	)`;
}

// Escape LIKE wildcards so a search for "100%" matches literally.
function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function sqlStringLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

// Postgres 40001 serialization_failure — the only error readTransaction retries.
function isSerializationFailure(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "40001"
	);
}
