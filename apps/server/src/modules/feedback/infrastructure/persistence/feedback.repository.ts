import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminFeedbackStats,
	type AdminListFeedbackQuery,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type PaginatedResult,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	or,
	type SQL,
	sql,
} from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { feedback, feedbackActivities } from "@wandit/db/schema/feedback";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type FeedbackRow = typeof feedback.$inferSelect;
export type FeedbackInsert = typeof feedback.$inferInsert;
export type FeedbackActivityRow = typeof feedbackActivities.$inferSelect;
export type FeedbackActivityInsert = typeof feedbackActivities.$inferInsert;

export type AdminFeedbackRow = FeedbackRow & {
	reporterImage: string | null;
	reporterCreatedAt: Date | null;
	reporterPlan: string | null;
	projectName: string | null;
};

export type AdminFeedbackActivityRow = FeedbackActivityRow & {
	actorName: string | null;
};

export type AdminFeedbackStatsRow = AdminFeedbackStats;

export type AdminFeedbackUpdatePatch = {
	status?: FeedbackRow["status"];
	priority?: FeedbackRow["priority"];
	adminNote?: string;
	resolvedAt?: Date | null;
};

type FeedbackTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

const entitledStatuses = [...ENTITLED_SUBSCRIPTION_STATUSES];

const adminFeedbackColumns = {
	id: feedback.id,
	userId: feedback.userId,
	chatId: feedback.chatId,
	authSessionId: feedback.authSessionId,
	reporterName: feedback.reporterName,
	reporterEmail: feedback.reporterEmail,
	projectId: feedback.projectId,
	category: feedback.category,
	message: feedback.message,
	pageUrl: feedback.pageUrl,
	replayUrl: feedback.replayUrl,
	sentryEventId: feedback.sentryEventId,
	sentryEventAt: feedback.sentryEventAt,
	userAgent: feedback.userAgent,
	viewportWidth: feedback.viewportWidth,
	viewportHeight: feedback.viewportHeight,
	locale: feedback.locale,
	screenshotUrl: feedback.screenshotUrl,
	linearIssueId: feedback.linearIssueId,
	linearIssueUrl: feedback.linearIssueUrl,
	status: feedback.status,
	priority: feedback.priority,
	adminNote: feedback.adminNote,
	resolvedAt: feedback.resolvedAt,
	createdAt: feedback.createdAt,
	updatedAt: feedback.updatedAt,
	reporterImage: user.image,
	reporterCreatedAt: user.createdAt,
	reporterPlan: sql<string | null>`(
		select "subscriptions"."plan"
		from "subscriptions"
		where ${personalEntitledSubscriptionFilter(sql.raw('"feedback"."user_id"'))}
		order by "subscriptions"."created_at" desc
		limit 1
	)`,
	projectName: projects.name,
} as const;

const adminFeedbackActivityColumns = {
	id: feedbackActivities.id,
	feedbackId: feedbackActivities.feedbackId,
	kind: feedbackActivities.kind,
	fromValue: feedbackActivities.fromValue,
	toValue: feedbackActivities.toValue,
	actorUserId: feedbackActivities.actorUserId,
	createdAt: feedbackActivities.createdAt,
	actorName: user.name,
} as const;

@Injectable()
export class FeedbackRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(values: FeedbackInsert): Promise<void> {
		await this.db.insert(feedback).values(values);
	}

	async insertActivity(
		values: FeedbackActivityInsert,
		tx?: FeedbackTransaction,
	): Promise<void> {
		await (tx ?? this.db).insert(feedbackActivities).values(values);
	}

	async setLinearIssue(
		id: string,
		issue: { issueId: string; url: string | null },
	): Promise<void> {
		await this.db
			.update(feedback)
			.set({ linearIssueId: issue.issueId, linearIssueUrl: issue.url })
			.where(eq(feedback.id, id));
	}

	async delete(id: string): Promise<boolean> {
		const rows = await this.db
			.delete(feedback)
			.where(eq(feedback.id, id))
			.returning({ id: feedback.id });

		return rows.length > 0;
	}

	async adminList(
		query: AdminListFeedbackQuery,
	): Promise<PaginatedResult<AdminFeedbackRow>> {
		const where = this.buildAdminFilter(query);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow, items] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(feedback)
				.where(where)
				.then((rows) => rows[0]),
			this.db
				.select(adminFeedbackColumns)
				.from(feedback)
				.leftJoin(user, eq(feedback.userId, user.id))
				.leftJoin(projects, eq(feedback.projectId, projects.id))
				.where(where)
				.orderBy(...this.buildAdminOrderBy(query.sort))
				.limit(query.pageSize)
				.offset(offset),
		]);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async adminFindById(id: string): Promise<AdminFeedbackRow | null> {
		const [row] = await this.db
			.select(adminFeedbackColumns)
			.from(feedback)
			.leftJoin(user, eq(feedback.userId, user.id))
			.leftJoin(projects, eq(feedback.projectId, projects.id))
			.where(eq(feedback.id, id))
			.limit(1);

		return row ?? null;
	}

	async listActivity(feedbackId: string): Promise<AdminFeedbackActivityRow[]> {
		return this.db
			.select(adminFeedbackActivityColumns)
			.from(feedbackActivities)
			.leftJoin(user, eq(feedbackActivities.actorUserId, user.id))
			.where(eq(feedbackActivities.feedbackId, feedbackId))
			.orderBy(desc(feedbackActivities.createdAt), desc(feedbackActivities.id));
	}

	async adminStats(): Promise<AdminFeedbackStatsRow> {
		const [row] = await this.db.select(this.adminStatsColumns()).from(feedback);

		return {
			total: countValue(row?.total),
			byStatus: {
				new: countValue(row?.new),
				reviewing: countValue(row?.reviewing),
				planned: countValue(row?.planned),
				resolved: countValue(row?.resolved),
			},
			openBugs: countValue(row?.openBugs),
			highPriorityOpen: countValue(row?.highPriorityOpen),
			resolvedLast7Days: countValue(row?.resolvedLast7Days),
		};
	}

	async adminUpdate(
		id: string,
		patch: AdminFeedbackUpdatePatch,
		activities: FeedbackActivityInsert[],
	): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx.update(feedback).set(patch).where(eq(feedback.id, id));

			for (const activity of activities) {
				await this.insertActivity(activity, tx);
			}
		});
	}

	private buildAdminFilter(query: AdminListFeedbackQuery): SQL | undefined {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;

		return and(
			pattern
				? or(
						ilike(feedback.message, pattern),
						ilike(feedback.reporterName, pattern),
						ilike(feedback.reporterEmail, pattern),
						ilike(feedback.linearIssueId, pattern),
					)
				: undefined,
			query.status ? inArray(feedback.status, query.status) : undefined,
			query.category ? inArray(feedback.category, query.category) : undefined,
			query.priority ? inArray(feedback.priority, query.priority) : undefined,
		);
	}

	private buildAdminOrderBy(sort: AdminListFeedbackQuery["sort"]): SQL[] {
		switch (sort) {
			case "oldest":
				return [asc(feedback.createdAt), asc(feedback.id)];
			case "priority":
				return [
					desc(sql<number>`case
						when ${feedback.priority} = 'urgent' then 4
						when ${feedback.priority} = 'high' then 3
						when ${feedback.priority} = 'medium' then 2
						when ${feedback.priority} = 'low' then 1
						else 0
					end`),
					desc(feedback.createdAt),
				];
			case "newest":
				return [desc(feedback.createdAt), desc(feedback.id)];
		}
	}

	private adminStatsColumns() {
		return {
			total: sql<number>`count(*)::int`,
			new: sql<number>`count(*) filter (where ${feedback.status} = 'new')::int`,
			reviewing: sql<number>`count(*) filter (where ${feedback.status} = 'reviewing')::int`,
			planned: sql<number>`count(*) filter (where ${feedback.status} = 'planned')::int`,
			resolved: sql<number>`count(*) filter (where ${feedback.status} = 'resolved')::int`,
			openBugs: sql<number>`count(*) filter (
				where ${feedback.category} = 'bug'
					and ${feedback.status} != 'resolved'
			)::int`,
			highPriorityOpen: sql<number>`count(*) filter (
				where ${feedback.priority} in ('urgent', 'high')
					and ${feedback.status} != 'resolved'
			)::int`,
			resolvedLast7Days: sql<number>`count(*) filter (
				where ${feedback.resolvedAt} >= now() - interval '7 days'
			)::int`,
		};
	}
}

function personalEntitledSubscriptionFilter(userId: SQL): SQL {
	return sql`"subscriptions"."user_id" = ${userId}
		and "subscriptions"."organization_id" is null
		and "subscriptions"."status" in (${sql.join(
			entitledStatuses.map((status) => sql`${status}`),
			sql`, `,
		)})`;
}

// Escape LIKE wildcards so search treats them as text.
function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function countValue(value: number | undefined): number {
	return value === undefined ? 0 : Number(value);
}
