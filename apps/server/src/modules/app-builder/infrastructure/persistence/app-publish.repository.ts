/**
 * Repository of the V2 web app publish (WANDIT-178): the `app_builds` rows
 * and the `deployments` rows of kind `app`. `PublishService` calls it in the
 * API process; the `publish-app` runtime calls it inside a run. The V1
 * `DeploymentsRepository` keeps the promote, fail, and unpublish writes,
 * which are the same for both kinds.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
	type AppBuildErrorCode,
	liveAppBuildStatuses,
	type PublishGateFinding,
	type SuspendedReasonCode,
} from "@wandit/contracts";
import { and, desc, eq, inArray, lt } from "@wandit/db";
import { appBuilds } from "@wandit/db/schema/app-builds";
import { deployments } from "@wandit/db/schema/deployments";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { appBuildStatusesThatMayMoveTo } from "../../domain/app-build";
import { isUniqueViolation } from "./builder-turns.repository";

/** One `app_builds` row as Drizzle returns it. */
export type AppBuildRow = typeof appBuilds.$inferSelect;

/** One `deployments` row as Drizzle returns it. */
export type AppDeploymentRow = typeof deployments.$inferSelect;

/** Columns of a new `queued` row. `createdAt` and `updatedAt` are DB defaults. */
export type NewAppBuild = {
	/** The user who asked for the publish. */
	userId: string;
	/** Org workspace of the project, or null on a personal project. */
	organizationId: string | null;
	projectId: string;
	/** Head of `main` at request time, or the commit of the rollback source. */
	commitSha: string;
	/** Set on a rollback: the build whose stored output goes up again. */
	sourceBuildId: string | null;
	/** Client uuid of the request. Unique per project. */
	requestKey: string;
	/** True on an owner "Publish anyway" attempt: overridable findings do not block it. */
	gateOverride: boolean;
};

/** Result of `insertQueued`; the cases match `MobileBuildsRepository.insertQueued`. */
export type InsertAppBuildResult =
	| { kind: "created"; row: AppBuildRow }
	| { kind: "request_exists"; row: AppBuildRow }
	| { kind: "live_exists" };

/**
 * One status change and the columns it writes. `transition` applies it
 * only when the row holds a status from `appBuildStatusesThatMayMoveTo(to)`.
 */
export type AppBuildTransition =
	| {
			to: "building";
			/** Id of the Trigger.dev run that claims the queued row. */
			triggerRunId: string;
	  }
	| {
			to: "uploading";
			/** Files in the build output: Worker modules plus assets. */
			fileCount: number;
			/** Total bytes of the build output. */
			bytes: number;
			/** The findings that did not block: `warn` findings and overridden ones. */
			gateFindings: PublishGateFinding[];
	  }
	| { to: "published" }
	| {
			to: "blocked";
			/** Every finding of the gates; at least one of them blocks. */
			gateFindings: PublishGateFinding[];
			/** A short English summary of the findings, for support. */
			errorMessage: string;
	  }
	| {
			to: "failed";
			errorCode: AppBuildErrorCode;
			/** Failure text for support. The write keeps its first 500 characters. */
			errorMessage: string;
	  };

/** The `projects` columns the publish task reads. */
export type PublishProjectRow = {
	/** The project name. A first publish derives the slug from it. */
	name: string;
	/** `v1_page` or `v2_app`; only `v2_app` publishes here. */
	engine: "v1_page" | "v2_app";
	/** Sandbox template family; null means a broken V2 row. */
	framework: string | null;
	/** Template release tag; null means a broken V2 row. */
	templateVersion: string | null;
	/** Project creator; the sandbox owner. */
	userId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
	/** Set when the user deleted the project. A deleted project never publishes. */
	deletedAt: Date | null;
	/** Set while staff suspend the app (WANDIT-181). A suspended project never publishes. */
	suspendedReasonCode: SuspendedReasonCode | null;
	/** When staff suspended the app; set together with `suspendedReasonCode`. */
	suspendedAt: Date | null;
};

// A stored failure text stays short. This write is the one place that
// stores it, so every caller gets the same cap.
const ERROR_MESSAGE_MAX_LENGTH = 500;

/** Drizzle persistence for the V2 publish. Every build status change is a compare-and-set. */
@Injectable()
export class AppPublishRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts a `queued` row. A unique violation comes from the request key
	 * index or from the live index. The request key lookup tells them apart.
	 */
	async insertQueued(input: NewAppBuild): Promise<InsertAppBuildResult> {
		try {
			const [row] = await this.db
				.insert(appBuilds)
				.values({ ...input, status: "queued" })
				.returning();
			if (!row) {
				throw new Error("app_builds insert did not return a row");
			}
			return { kind: "created", row };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}
			const existing = await this.findByRequestKey(
				input.projectId,
				input.requestKey,
			);
			return existing
				? { kind: "request_exists", row: existing }
				: { kind: "live_exists" };
		}
	}

	/** The row, or null. Every caller checks `projectId` against its own project. */
	async findById(id: string): Promise<AppBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(appBuilds)
			.where(eq(appBuilds.id, id))
			.limit(1);
		return row ?? null;
	}

	/** The row an earlier request with the same key made, or null. */
	async findByRequestKey(
		projectId: string,
		requestKey: string,
	): Promise<AppBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(appBuilds)
			.where(
				and(
					eq(appBuilds.projectId, projectId),
					eq(appBuilds.requestKey, requestKey),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The `queued`, `building`, or `uploading` row of a project, or null. */
	async findLive(projectId: string): Promise<AppBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(appBuilds)
			.where(
				and(
					eq(appBuilds.projectId, projectId),
					inArray(appBuilds.status, [...liveAppBuildStatuses]),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The newest row of a project, or null before the first publish. */
	async findLatest(projectId: string): Promise<AppBuildRow | null> {
		const [row] = await this.db
			.select()
			.from(appBuilds)
			.where(eq(appBuilds.projectId, projectId))
			.orderBy(desc(appBuilds.createdAt), desc(appBuilds.id))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Stores the run id that `tasks.trigger` answered. No compare-and-set:
	 * the task claims the row with the same id.
	 */
	async setTriggerRunId(id: string, triggerRunId: string): Promise<void> {
		await this.db
			.update(appBuilds)
			.set({ triggerRunId })
			.where(eq(appBuilds.id, id));
	}

	/**
	 * Compare-and-set of one status change. A terminal status also sets
	 * `completedAt`. Answers the updated row, or null when the row holds a
	 * status that may not move to `change.to`.
	 */
	async transition(
		id: string,
		change: AppBuildTransition,
	): Promise<AppBuildRow | null> {
		const [row] = await this.db
			.update(appBuilds)
			.set(transitionColumns(change))
			.where(
				and(
					eq(appBuilds.id, id),
					inArray(appBuilds.status, appBuildStatusesThatMayMoveTo(change.to)),
				),
			)
			.returning();
		return row ?? null;
	}

	/**
	 * Marks the live rows of a project with no change since `olderThan` as
	 * `failed`. A run that Trigger stopped from outside (OOM, `maxDuration`)
	 * never ends its row, and the live index would then block every later
	 * publish. The claim and each step update `updated_at`, so a queue wait
	 * before the claim never ends a running row. Answers the count of rows it ended.
	 */
	async failStaleLive(projectId: string, olderThan: Date): Promise<number> {
		const rows = await this.db
			.update(appBuilds)
			.set({
				completedAt: new Date(),
				errorCode: "internal",
				errorMessage: "The publish run stopped before it ended the attempt",
				status: "failed",
			})
			.where(
				and(
					eq(appBuilds.projectId, projectId),
					inArray(appBuilds.status, [...liveAppBuildStatuses]),
					lt(appBuilds.updatedAt, olderThan),
				),
			)
			.returning({ id: appBuilds.id });
		return rows.length;
	}

	/**
	 * Inserts the `pending` deployment of one app upload. No project lock,
	 * unlike the V1 insert: the live index of `app_builds` already allows one
	 * upload per project.
	 */
	async insertPendingDeployment(input: {
		projectId: string;
		slug: string;
		/** The `app_builds` row that uploads the Worker. */
		buildId: string;
		commitSha: string;
	}): Promise<AppDeploymentRow> {
		const [row] = await this.db
			.insert(deployments)
			.values({ ...input, kind: "app", status: "pending" })
			.returning();
		if (!row) {
			throw new Error("deployments insert did not return a row");
		}
		return row;
	}

	/** The `active` app deployment of a project, or null when nothing is live. */
	async findLiveDeployment(
		projectId: string,
	): Promise<AppDeploymentRow | null> {
		const [row] = await this.db
			.select()
			.from(deployments)
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.kind, "app"),
					eq(deployments.status, "active"),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** One app deployment of the project, or null for a page row or another project. */
	async findDeployment(
		projectId: string,
		deploymentId: string,
	): Promise<AppDeploymentRow | null> {
		const [row] = await this.db
			.select()
			.from(deployments)
			.where(
				and(
					eq(deployments.id, deploymentId),
					eq(deployments.projectId, projectId),
					eq(deployments.kind, "app"),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The newest app deployments of a project, newest first. */
	listDeployments(
		projectId: string,
		limit: number,
	): Promise<AppDeploymentRow[]> {
		return this.db
			.select()
			.from(deployments)
			.where(
				and(eq(deployments.projectId, projectId), eq(deployments.kind, "app")),
			)
			.orderBy(desc(deployments.createdAt), desc(deployments.id))
			.limit(limit);
	}

	/** The project columns of one publish run, or null when no row exists. */
	async findProject(projectId: string): Promise<PublishProjectRow | null> {
		const [row] = await this.db
			.select({
				deletedAt: projects.deletedAt,
				engine: projects.engine,
				framework: projects.framework,
				name: projects.name,
				organizationId: projects.organizationId,
				suspendedAt: projects.suspendedAt,
				suspendedReasonCode: projects.suspendedReasonCode,
				templateVersion: projects.templateVersion,
				userId: projects.userId,
			})
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);
		return row ?? null;
	}
}

// The new status and the other columns that one status change writes.
function transitionColumns(
	change: AppBuildTransition,
): Partial<typeof appBuilds.$inferInsert> {
	switch (change.to) {
		case "building":
			return { status: "building", triggerRunId: change.triggerRunId };
		case "uploading":
			return {
				bytes: change.bytes,
				fileCount: change.fileCount,
				gateFindings: change.gateFindings,
				status: "uploading",
			};
		case "published":
			return { completedAt: new Date(), status: "published" };
		case "blocked":
			return {
				completedAt: new Date(),
				errorCode: "gate_blocked",
				errorMessage: change.errorMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH),
				gateFindings: change.gateFindings,
				status: "blocked",
			};
		case "failed":
			return {
				completedAt: new Date(),
				errorCode: change.errorCode,
				errorMessage: change.errorMessage.slice(0, ERROR_MESSAGE_MAX_LENGTH),
				status: "failed",
			};
	}
}
