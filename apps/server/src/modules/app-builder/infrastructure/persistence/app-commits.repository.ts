/**
 * Repository for the `app_commits` and `app_branches` tables (WANDIT-163).
 * `commitTurn` writes commit rows and moves the `main` head; the versions
 * routes list rows, load one commit, and gate on the project's scope.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, lt, or, type SQL, sql } from "@wandit/db";
import { appBranches, appCommits } from "@wandit/db/schema/app-versions";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";
import type { GitNumstatEntry } from "../../domain/git-numstat";

/** One `app_commits` row as Drizzle returns it. */
export type AppCommitRow = typeof appCommits.$inferSelect;

/** Columns a new `app_commits` row needs; `id`/`createdAt` are DB defaults. */
export type NewAppCommit = {
	projectId: string;
	/** The user whose action made the commit (turn author or restorer). */
	userId: string;
	/** Org workspace of the project, or null on a personal project. */
	organizationId: string | null;
	/** The `chats` row whose turn produced the commit; null on a restore. */
	chatId: string | null;
	/** The `builder_turns` row; null on a restore, which is not a turn. */
	turnId: string | null;
	/** The `messages` row of the assistant message; `restore-<uuid>` on a restore. */
	messageId: string | null;
	sha: string;
	parentSha: string | null;
	message: string;
	source: "agent" | "restore" | "wip" | "merge";
	restoredFromSha: string | null;
	numstat: GitNumstatEntry[];
	/** R2 object key of the stored patch, under `git/<projectId>/patches/`. */
	patchKey: string | null;
};

/** Columns the versions flow needs from the owning `projects` row. */
export type ScopedAppProject = {
	id: string;
	engine: string;
	framework: string | null;
	templateVersion: string | null;
	userId: string;
	organizationId: string | null;
};

/** The head state of one `app_branches` row. */
export type AppBranchHead = {
	headSha: string | null;
};

/**
 * Thrown by `commitTurn` when the `main` head moved between the read that
 * produced `expectedHeadSha` and the write (optimistic concurrency). The
 * service answers 409 VERSION_CONFLICT.
 */
export class VersionConflictError extends Error {
	constructor() {
		super("The project head changed during the version write");
		this.name = "VersionConflictError";
	}
}

/**
 * The `versions` cursor could not be parsed into a `createdAt` + row id
 * pair. A repository stays HTTP-free; the service turns it into a 400.
 */
export class MalformedVersionCursorError extends Error {
	constructor() {
		super("Malformed versions cursor");
		this.name = "MalformedVersionCursorError";
	}
}

const MAIN_BRANCH = "main";
// The versions API pages at most 50 rows per call.
export const VERSIONS_PAGE_MAX = 50;

/** Drizzle persistence for `app_commits` and `app_branches`. */
@Injectable()
export class AppCommitsRepository {
	constructor(
		@Inject(DATABASE)
		private readonly db: Database,
	) {}

	/**
	 * Inserts one commit row and returns it. `(projectId, sha)` is unique,
	 * so a retried turn insert conflicts and the existing row comes back.
	 */
	async insert(row: NewAppCommit): Promise<AppCommitRow> {
		const inserted = await this.db
			.insert(appCommits)
			.values(row)
			// A retried turn must not duplicate the commit row.
			.onConflictDoNothing({
				target: [appCommits.projectId, appCommits.sha],
			})
			.returning();
		if (inserted.length > 0) {
			// SAFETY: length check above proves the row exists.
			return inserted[0] as AppCommitRow;
		}
		const existing = await this.findBySha(row.projectId, row.sha);
		if (!existing) {
			throw new Error(
				`app_commits insert conflicted for sha ${row.sha} but no row exists`,
			);
		}
		return existing;
	}

	/**
	 * Pages the versions of one project, newest first. `cursor` is the
	 * `<createdAt ISO>_<id>` of the last row of the previous page.
	 */
	async listByProject(
		projectId: string,
		options: { cursor?: string; limit: number },
	): Promise<{ items: AppCommitRow[]; nextCursor: string | null }> {
		const limit = Math.min(options.limit, VERSIONS_PAGE_MAX);
		const predicates = [eq(appCommits.projectId, projectId)];
		if (options.cursor !== undefined) {
			predicates.push(versionCursorPredicate(options.cursor));
		}
		const rows = await this.db
			.select()
			.from(appCommits)
			.where(and(...predicates))
			.orderBy(desc(appCommits.createdAt), desc(appCommits.id))
			// One extra row tells whether a next page exists.
			.limit(limit + 1);

		const items = rows.slice(0, limit);
		const last = items.at(-1);
		return {
			items,
			nextCursor:
				rows.length > limit && last
					? `${last.createdAt.toISOString()}_${last.id}`
					: null,
		};
	}

	/** One commit of a project by sha, or null. */
	async findBySha(
		projectId: string,
		sha: string,
	): Promise<AppCommitRow | null> {
		const rows = await this.db
			.select()
			.from(appCommits)
			.where(and(eq(appCommits.projectId, projectId), eq(appCommits.sha, sha)))
			.limit(1);
		return rows[0] ?? null;
	}

	/**
	 * True when one commit of the project changed a file. A turn that only
	 * answers in text commits with numstat `[]`, and the template commit has
	 * no row. `AppProjectsService.get` reads it for `hasCodeChanges`.
	 */
	async hasFileChanges(projectId: string): Promise<boolean> {
		const rows = await this.db
			.select({ id: appCommits.id })
			.from(appCommits)
			.where(
				and(
					eq(appCommits.projectId, projectId),
					// A null numstat counts as a change: the preview then shows the app.
					sql`${appCommits.numstat} IS DISTINCT FROM '[]'::jsonb`,
				),
			)
			.limit(1);
		return rows.length > 0;
	}

	/** The `main` branch head row of a project, or null when no row exists. */
	async findBranch(
		projectId: string,
		name: string = MAIN_BRANCH,
	): Promise<AppBranchHead | null> {
		const rows = await this.db
			.select({ headSha: appBranches.headSha })
			.from(appBranches)
			.where(
				and(eq(appBranches.projectId, projectId), eq(appBranches.name, name)),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	/**
	 * Compare-and-swap on the branch head: the update runs only when the
	 * stored head equals `expectedHeadSha` (null-tolerant compare), or when
	 * the head already holds `headSha` (a retried call is a no-op). When no
	 * row exists, inserts the `main` row for any `expectedHeadSha`. The
	 * template init commits outside `commitTurn`, so the first turn has a
	 * parent sha but no row. Returns false when a row with another head
	 * exists — the caller turns it into a 409.
	 */
	async upsertBranchHead(
		projectId: string,
		name: string,
		head: {
			headSha: string;
			expectedHeadSha: string | null;
			/** Owner columns for the insert path; required by the schema. */
			userId: string;
			organizationId: string | null;
		},
	): Promise<boolean> {
		const updated = await this.db
			.update(appBranches)
			.set({ headSha: head.headSha })
			.where(
				and(
					eq(appBranches.projectId, projectId),
					eq(appBranches.name, name),
					or(
						// IS NOT DISTINCT FROM compares null to null correctly.
						sql`${appBranches.headSha} IS NOT DISTINCT FROM ${head.expectedHeadSha}`,
						// A retried commit sees its own head already stored.
						eq(appBranches.headSha, head.headSha),
					),
				),
			)
			.returning({ id: appBranches.id });
		if (updated.length > 0) {
			return true;
		}
		// No row matched: insert `main`. A row with another head, or a
		// concurrent insert, already holds the unique (projectId, name) key.
		// Then the insert returns no row and the call answers false.
		const inserted = await this.db
			.insert(appBranches)
			.values({
				projectId,
				name,
				headSha: head.headSha,
				userId: head.userId,
				organizationId: head.organizationId,
			})
			.onConflictDoNothing({
				target: [appBranches.projectId, appBranches.name],
			})
			.returning({ id: appBranches.id });
		return inserted.length > 0;
	}

	/**
	 * The `projects` row behind one scoped project id, or null when the
	 * project is missing, deleted, or outside the caller's scope.
	 */
	async findScopedProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<ScopedAppProject | null> {
		const rows = await this.db
			.select({
				id: projects.id,
				engine: projects.engine,
				framework: projects.framework,
				templateVersion: projects.templateVersion,
				userId: projects.userId,
				organizationId: projects.organizationId,
			})
			.from(projects)
			.where(
				and(
					projectScopePredicate(scope),
					eq(projects.id, projectId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}
}

// The cursor carries `createdAt` plus the row id so equal timestamps keep
// a stable order. `<` on the pair gives the next older page.
function versionCursorPredicate(cursor: string): SQL {
	const separator = cursor.indexOf("_");
	if (separator < 1) {
		throw new MalformedVersionCursorError();
	}
	const createdAt = new Date(cursor.slice(0, separator));
	const id = cursor.slice(separator + 1);
	if (id === "" || Number.isNaN(createdAt.getTime())) {
		throw new MalformedVersionCursorError();
	}
	const predicate = or(
		lt(appCommits.createdAt, createdAt),
		and(eq(appCommits.createdAt, createdAt), lt(appCommits.id, id)),
	);
	if (!predicate) {
		throw new Error("Version cursor predicate could not be constructed");
	}
	return predicate;
}
