/**
 * Repository for `project_github_links`: the GitHub repo link of one V2 project and its sync state.
 * The project GitHub routes, the GitHub webhook route, `VersionsService.pullFromGithub`, the GitHub sync
 * scheduler, and the `github-sync` Trigger task call it. Ownership checks stay in the services; queries
 * filter by project, link, or repo id.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	type GithubSyncErrorCode,
	githubSyncErrorCodeSchema,
} from "@wandit/contracts";
import { and, eq, isNull, lt, or } from "@wandit/db";
import { projectGithubLinks } from "@wandit/db/schema/github";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

// An unknown stored code (for example after a rollback to code without it)
// reads as the generic failure. Then the status route and the worker still run.
const storedErrorSchema = githubSyncErrorCodeSchema
	.nullable()
	.catch("GITHUB_SYNC_FAILED");

/** One link row of a project that is not deleted. */
export type ProjectGithubLinkRow = {
	/** Link row id. Every sync write after a read filters by it. */
	id: string;
	projectId: string;
	/** The Wandit user who linked the repo. The sync and the pull check that this user can still open the project. */
	userId: string;
	/** GitHub App installation id that reaches the repo. */
	installationId: number;
	/** GitHub repo id; installation tokens are limited to it. */
	repoId: number;
	repoOwner: string;
	repoName: string;
	/** Numeric GitHub user id of the linker. The worker reads its current login and checks its write access. */
	githubUserId: number;
	/** GitHub head that the project last pushed or pulled. */
	lastSyncedSha: string | null;
	/** GitHub head that the worker last saw. */
	remoteHeadSha: string | null;
	/** GitHub head that the worker copied to the code.storage branch `github/main`. */
	mirroredSha: string | null;
	lastError: GithubSyncErrorCode | null;
	createdAt: Date;
	updatedAt: Date;
};

/** Columns of a new link. The sync columns start null. */
export type NewProjectGithubLink = {
	projectId: string;
	/** The Wandit user who links the repo. */
	userId: string;
	/** Org workspace of the project, or null on a personal project. */
	organizationId: string | null;
	installationId: number;
	repoId: number;
	repoOwner: string;
	repoName: string;
	/** Numeric GitHub user id of the connected user who links the repo, from the callback `GET /user`. */
	githubUserId: number;
};

/** Drizzle persistence for `project_github_links`. */
@Injectable()
export class ProjectGithubLinksRepository {
	constructor(
		@Inject(DATABASE)
		private readonly db: Database,
	) {}

	/**
	 * The link of a project, or null when the project has none or is
	 * soft-deleted. Projects are soft-deleted, so the FK cascade never runs and
	 * the join must filter `deleted_at`.
	 */
	async findByProject(projectId: string): Promise<ProjectGithubLinkRow | null> {
		const [row] = await this.db
			.select({ link: projectGithubLinks })
			.from(projectGithubLinks)
			.innerJoin(
				projects,
				and(
					eq(projects.id, projectGithubLinks.projectId),
					isNull(projects.deletedAt),
				),
			)
			.where(eq(projectGithubLinks.projectId, projectId))
			.limit(1);
		if (row === undefined) {
			return null;
		}
		const { link } = row;
		return {
			createdAt: link.createdAt,
			githubUserId: link.githubUserId,
			id: link.id,
			installationId: link.installationId,
			lastError: storedErrorSchema.parse(link.lastError),
			lastSyncedSha: link.lastSyncedSha,
			mirroredSha: link.mirroredSha,
			projectId: link.projectId,
			remoteHeadSha: link.remoteHeadSha,
			repoId: link.repoId,
			repoName: link.repoName,
			repoOwner: link.repoOwner,
			updatedAt: link.updatedAt,
			userId: link.userId,
		};
	}

	/**
	 * Ids of the projects, not deleted, that link the GitHub repo `repoId`. The webhook
	 * route calls it. Normally one id: each link creates a new repo.
	 */
	async findProjectIdsByRepoId(repoId: number): Promise<string[]> {
		const rows = await this.db
			.select({ projectId: projectGithubLinks.projectId })
			.from(projectGithubLinks)
			.innerJoin(
				projects,
				and(
					eq(projects.id, projectGithubLinks.projectId),
					isNull(projects.deletedAt),
				),
			)
			.where(eq(projectGithubLinks.repoId, repoId));
		return rows.map((row) => row.projectId);
	}

	/**
	 * Claims the GitHub head check of the status route. True when no check ran
	 * after `checkedBefore`; the row then holds the current time. It is one
	 * conditional UPDATE, so two tabs or two API processes never both win.
	 */
	async claimGithubCheck(
		linkId: string,
		checkedBefore: Date,
	): Promise<boolean> {
		const [row] = await this.db
			.update(projectGithubLinks)
			.set({ githubCheckedAt: new Date() })
			.where(
				and(
					eq(projectGithubLinks.id, linkId),
					or(
						isNull(projectGithubLinks.githubCheckedAt),
						lt(projectGithubLinks.githubCheckedAt, checkedBefore),
					),
				),
			)
			.returning({ id: projectGithubLinks.id });
		return row !== undefined;
	}

	/** Inserts the link and returns its id, or null when the project already has a link (unique project id). */
	async insert(input: NewProjectGithubLink): Promise<string | null> {
		const [row] = await this.db
			.insert(projectGithubLinks)
			.values(input)
			.onConflictDoNothing({ target: projectGithubLinks.projectId })
			.returning({ id: projectGithubLinks.id });
		return row?.id ?? null;
	}

	/** Removes the link of a project. False when it had none. The GitHub repo stays. */
	async deleteByProject(projectId: string): Promise<boolean> {
		const [row] = await this.db
			.delete(projectGithubLinks)
			.where(eq(projectGithubLinks.projectId, projectId))
			.returning({ id: projectGithubLinks.id });
		return row !== undefined;
	}

	/** GitHub `main` now equals `sha` after a push or an equal-heads run. Clears the error. */
	async markSynced(linkId: string, sha: string): Promise<void> {
		await this.db
			.update(projectGithubLinks)
			.set({
				lastError: null,
				lastSyncedSha: sha,
				remoteHeadSha: sha,
				updatedAt: new Date(),
			})
			.where(eq(projectGithubLinks.id, linkId));
	}

	/** The worker mirrored GitHub head `sha` to `github/main`, so the banner can offer an Update. Clears the error. */
	async markRemoteAhead(linkId: string, sha: string): Promise<void> {
		await this.db
			.update(projectGithubLinks)
			.set({
				lastError: null,
				mirroredSha: sha,
				remoteHeadSha: sha,
				updatedAt: new Date(),
			})
			.where(eq(projectGithubLinks.id, linkId));
	}

	/**
	 * The project merged GitHub head `targetSha`. The write runs only while
	 * `remote_head_sha` is still `targetSha`: a sync run that wrote a newer
	 * GitHub head during the install keeps its value.
	 */
	async markPulled(linkId: string, targetSha: string): Promise<void> {
		await this.db
			.update(projectGithubLinks)
			.set({ lastSyncedSha: targetSha, updatedAt: new Date() })
			.where(
				and(
					eq(projectGithubLinks.id, linkId),
					eq(projectGithubLinks.remoteHeadSha, targetSha),
				),
			);
	}

	/**
	 * Why the last sync stopped. The panel shows the code through `t()`.
	 * `githubHead` is the GitHub head that the stopped run fetched. It replaces
	 * an older seen head, so the banner never offers a head that GitHub dropped.
	 * Null keeps the stored head.
	 */
	async recordError(
		linkId: string,
		code: GithubSyncErrorCode,
		githubHead: string | null = null,
	): Promise<void> {
		await this.db
			.update(projectGithubLinks)
			.set({
				lastError: code,
				...(githubHead === null ? {} : { remoteHeadSha: githubHead }),
				updatedAt: new Date(),
			})
			.where(eq(projectGithubLinks.id, linkId));
	}
}
