/**
 * Drizzle queries of the trophies module. TrophiesService calls it.
 * It READS tables of other modules: `projects`, `ai_usage_events`, `builder_turns`, `deployments`, `domains`,
 * `app_commits`, `project_github_links`, `leads`, `user_referrals`, `project_members`, `feedback`,
 * `billing_topup_receipts`, and `user`. It writes only `user_trophies`.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	TROPHY_EARLY_ADOPTER_BEFORE,
	type TrophyFacts,
	type TrophyId,
	trophyMaxTargetFor,
} from "@wandit/contracts";
import { and, eq, inArray, isNull, sql } from "@wandit/db";
import { appCommits } from "@wandit/db/schema/app-versions";
import { user } from "@wandit/db/schema/auth";
import { billingTopupReceipts } from "@wandit/db/schema/billing";
import { builderTurns } from "@wandit/db/schema/builder-turns";
import { aiUsageEvents } from "@wandit/db/schema/credits";
import { deployments } from "@wandit/db/schema/deployments";
import { domains } from "@wandit/db/schema/domains";
import { feedback } from "@wandit/db/schema/feedback";
import { projectGithubLinks } from "@wandit/db/schema/github";
import { leads } from "@wandit/db/schema/leads";
import { projectMembers } from "@wandit/db/schema/project-sharing";
import { projects } from "@wandit/db/schema/projects";
import { userTrophies } from "@wandit/db/schema/trophies";
import { userReferrals } from "@wandit/db/schema/user-referrals";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** The facts that the database gives. The service adds the build-week streak and the spend. */
export type TrophyCountFacts = Omit<
	TrophyFacts,
	"bestBuildWeekStreak" | "spentCredits"
>;

/** One stored unlock. `trophyId` is text, so it can hold an id that the catalog dropped. */
export type TrophyUnlockRow = Pick<
	typeof userTrophies.$inferSelect,
	"trophyId" | "unlockedAt" | "seenAt"
>;

// A build is one V2 builder turn or one V1 page build. The facts query and the build weeks share this list.
const buildOperations = sql`('agent_session', 'page_build')`;

@Injectable()
export class TrophiesRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Reads every count fact of one user in ONE statement. Each count stops at the largest target of its fact.
	 * Deleted projects count: a trophy rewards past work.
	 */
	async readFacts(userId: string): Promise<TrophyCountFacts> {
		// LIMIT: the facts query runs on each read that the web cache does not serve, and it scans all usage rows of the user. Upgrade: one counters row per user, written by a sweep.
		// Each column is cast to int and named like its fact, so node-postgres gives a JS number per key.
		const result = await this.db.execute<TrophyCountFacts>(sql`
			with user_projects as (
				select id from ${projects} where user_id = ${userId}
			),
			usage as (
				select
					count(*) filter (where operation in ${buildOperations}) as builds,
					count(*) filter (where operation = 'mobile_build') as mobile_builds,
					count(*) filter (where operation = 'desktop_build') as desktop_builds,
					count(*) filter (where operation = 'theme_design') as theme_designs,
					count(*) filter (where operation = 'image') as images,
					count(*) filter (where operation = 'web_search') as web_searches
				from ${aiUsageEvents}
				where user_id = ${userId}
					-- Only settled usage counts, so a failed build is not a build.
					and status in ('settled', 'reconciled')
			)
			select
				(select count(*) from (
					select 1 from ${projects} where user_id = ${userId} limit ${trophyMaxTargetFor("projects")}
				) s)::int as "projects",
				(select count(*) from (
					select 1 from ${projects}
					where user_id = ${userId} and engine = 'v2_app'
					limit ${trophyMaxTargetFor("appProjects")}
				) s)::int as "appProjects",
				(select count(*) from (
					select distinct target_platform from ${projects}
					where user_id = ${userId} and target_platform is not null
					limit ${trophyMaxTargetFor("targetPlatforms")}
				) s)::int as "targetPlatforms",
				(select count(*) from (
					select distinct starter_template_id from ${projects}
					where user_id = ${userId} and starter_template_id is not null
					limit ${trophyMaxTargetFor("starterTemplates")}
				) s)::int as "starterTemplates",
				least(usage.builds, ${trophyMaxTargetFor("builds")})::int as "builds",
				least(
					coalesce((
						select max(turn_number) from ${builderTurns}
						where project_id in (select id from user_projects)
					), 0),
					${trophyMaxTargetFor("maxProjectTurns")}
				)::int as "maxProjectTurns",
				(select count(*) from (
					select 1 from ${deployments}
					where project_id in (select id from user_projects)
						and status in ('active', 'superseded', 'unpublished')
					limit ${trophyMaxTargetFor("publishes")}
				) s)::int as "publishes",
				-- A unique index allows one active deployment per project, so each row is one live project.
				(select count(*) from (
					select 1 from ${deployments}
					where project_id in (select id from user_projects) and status = 'active'
					limit ${trophyMaxTargetFor("liveProjects")}
				) s)::int as "liveProjects",
				(select count(*) from (
					select 1 from ${domains}
					where user_id = ${userId} and status = 'active'
					limit ${trophyMaxTargetFor("activeDomains")}
				) s)::int as "activeDomains",
				least(usage.mobile_builds, ${trophyMaxTargetFor("mobileBuilds")})::int as "mobileBuilds",
				least(usage.desktop_builds, ${trophyMaxTargetFor("desktopBuilds")})::int as "desktopBuilds",
				least(usage.theme_designs, ${trophyMaxTargetFor("themeDesigns")})::int as "themeDesigns",
				least(usage.images, ${trophyMaxTargetFor("images")})::int as "images",
				least(usage.web_searches, ${trophyMaxTargetFor("webSearches")})::int as "webSearches",
				(select count(*) from (
					select 1 from ${appCommits}
					where project_id in (select id from user_projects) and source = 'restore'
					limit ${trophyMaxTargetFor("restores")}
				) s)::int as "restores",
				(select count(*) from (
					select 1 from ${projectGithubLinks}
					where user_id = ${userId}
					limit ${trophyMaxTargetFor("githubLinks")}
				) s)::int as "githubLinks",
				(select count(*) from (
					select 1 from ${leads}
					where project_id in (select id from user_projects)
					limit ${trophyMaxTargetFor("leads")}
				) s)::int as "leads",
				(select count(*) from (
					select 1 from ${userReferrals}
					where referrer_user_id = ${userId}
					limit ${trophyMaxTargetFor("friendsJoined")}
				) s)::int as "friendsJoined",
				(select count(*) from (
					select 1 from ${userReferrals}
					where referrer_user_id = ${userId} and activated_at is not null
					limit ${trophyMaxTargetFor("friendsActivated")}
				) s)::int as "friendsActivated",
				(select count(*) from (
					select 1 from ${userReferrals}
					where referrer_user_id = ${userId} and first_paid_at is not null
					limit ${trophyMaxTargetFor("friendsPaid")}
				) s)::int as "friendsPaid",
				(select count(*) from (
					select 1 from ${projectMembers}
					where project_id in (select id from user_projects) and user_id <> ${userId}
					limit ${trophyMaxTargetFor("collaborators")}
				) s)::int as "collaborators",
				(select count(*) from (
					select 1 from ${feedback} where user_id = ${userId}
					limit ${trophyMaxTargetFor("feedbackSent")}
				) s)::int as "feedbackSent",
				(select count(*) from (
					select 1 from ${feedback}
					where user_id = ${userId} and status in ('planned', 'resolved')
					limit ${trophyMaxTargetFor("feedbackAdopted")}
				) s)::int as "feedbackAdopted",
				-- Personal top-ups only. An admin reversal takes the receipt out.
				(select count(*) from (
					select 1 from ${billingTopupReceipts}
					where user_id = ${userId} and organization_id is null and reversed_at is null
					limit ${trophyMaxTargetFor("topups")}
				) s)::int as "topups",
				(select count(*) from ${user}
					where id = ${userId} and created_at < ${TROPHY_EARLY_ADOPTER_BEFORE}::timestamptz
				)::int as "earlyAdopter"
			from usage
		`);
		const [row] = result.rows;
		// The `usage` CTE is an aggregate without group by, so the statement always gives one row.
		if (row === undefined) {
			throw new Error(`Trophy facts query returned no row for user ${userId}`);
		}
		return row;
	}

	/**
	 * The Mondays (`YYYY-MM-DD`, UTC) of the weeks since `since` with one settled build or more.
	 * Text, not a SQL date: node-postgres turns a date into a local-time JS Date.
	 */
	async readBuildWeekStarts(userId: string, since: Date): Promise<string[]> {
		// LIMIT: a streak older than 53 weeks that was never read is lost. Upgrade: store the best streak.
		const result = await this.db.execute<{ week_start: string }>(sql`
			select distinct to_char(
				date_trunc('week', ${aiUsageEvents.createdAt} at time zone 'UTC'),
				'YYYY-MM-DD'
			) as week_start
			from ${aiUsageEvents}
			where ${aiUsageEvents.userId} = ${userId}
				and status in ('settled', 'reconciled')
				and operation in ${buildOperations}
				and ${aiUsageEvents.createdAt} >= ${since}
		`);
		return result.rows.map((row) => row.week_start);
	}

	/** Every stored unlock of the user, ids outside the catalog included. */
	listUnlocks(userId: string): Promise<TrophyUnlockRow[]> {
		return this.db
			.select({
				seenAt: userTrophies.seenAt,
				trophyId: userTrophies.trophyId,
				unlockedAt: userTrophies.unlockedAt,
			})
			.from(userTrophies)
			.where(eq(userTrophies.userId, userId));
	}

	/**
	 * Stores the first unlock of each id. Returns only the rows that this call wrote.
	 * The primary key makes a repeated insert a no-op, so a parallel read cannot store a trophy twice.
	 */
	insertUnlocks(
		userId: string,
		trophyIds: readonly TrophyId[],
	): Promise<TrophyUnlockRow[]> {
		return this.db
			.insert(userTrophies)
			.values(trophyIds.map((trophyId) => ({ trophyId, userId })))
			.onConflictDoNothing({
				target: [userTrophies.userId, userTrophies.trophyId],
			})
			.returning({
				seenAt: userTrophies.seenAt,
				trophyId: userTrophies.trophyId,
				unlockedAt: userTrophies.unlockedAt,
			});
	}

	/** Sets `seen_at` on the new trophies of the user in `trophyIds`. A trophy seen before keeps its first time. */
	async markSeen(
		userId: string,
		trophyIds: readonly TrophyId[],
	): Promise<void> {
		await this.db
			.update(userTrophies)
			.set({ seenAt: sql`now()` })
			.where(
				and(
					eq(userTrophies.userId, userId),
					inArray(userTrophies.trophyId, [...trophyIds]),
					isNull(userTrophies.seenAt),
				),
			);
	}
}
