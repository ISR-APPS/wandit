/**
 * Database helper for publishing: the deployments table (one row per publish
 * attempt) plus the project/version lookups the publish pipeline needs.
 *
 * Lifecycle invariants live in the schema (partial unique indexes on
 * status='active'), so every promotion is demote-then-promote inside one
 * transaction — never a bare insert or update.
 */

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ENTITLED_SUBSCRIPTION_STATUSES } from "@wandit/contracts";
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "@wandit/db";
import { artifacts, versions } from "@wandit/db/schema/artifacts";
import { subscriptions } from "@wandit/db/schema/billing";
import { deployments } from "@wandit/db/schema/deployments";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";
import { SlugTakenError } from "../../domain/errors/site.errors";

export type DeploymentRow = typeof deployments.$inferSelect;

export type OwnedProjectRow = {
	id: string;
	// Publishing setting: hide the "Made with Wandit" badge. Honoured at
	// publish time only together with ownerIsEntitled.
	hideWanditBadge: boolean;
	metaPixelId: string | null;
	name: string;
	// True when the project's payer (org first, then user) holds an entitled
	// subscription right now — the badge hide-toggle only counts for them.
	ownerIsEntitled: boolean;
	// Capture key baked into the published page's leads runtime.
	publicFormId: string;
	tiktokPixelId: string | null;
};

export type ProjectVersionRow = {
	id: string;
	r2Key: string;
};

// Everything findCurrent needs to answer "what should the publish UI show".
export type CurrentDeploymentRows = {
	active: DeploymentRow | null;
	newestPending: DeploymentRow | null;
	// Newest row regardless of status — a failed attempt only surfaces as
	// `failed` when nothing newer exists.
	newest: DeploymentRow | null;
	// The draft pointer (artifacts.activeVersionId) — what publish would ship.
	pendingVersionId: string | null;
};

// A pending row older than this is an orphan (crash between insert and
// promote/fail). Must exceed any plausible publish duration by a wide margin.
const STALE_PENDING_MS = 35 * 60 * 1000;

@Injectable()
export class DeploymentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async getAccessibleProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<OwnedProjectRow> {
		// Payer identity = organization first, then user (CreditOwner rule). The
		// org branch needs no IS NOT NULL guard: `subs.org_id = projects.org_id`
		// is never true when the project has no org. The personal branch pins
		// `subs.organization_id IS NULL` because an org creator's userId also
		// appears on the org's subscription row.
		const ownerIsEntitled = sql<boolean>`EXISTS (SELECT 1 FROM ${subscriptions} WHERE ${and(
			inArray(subscriptions.status, [...ENTITLED_SUBSCRIPTION_STATUSES]),
			or(
				eq(subscriptions.organizationId, projects.organizationId),
				and(
					isNull(projects.organizationId),
					eq(subscriptions.userId, projects.userId),
					isNull(subscriptions.organizationId),
				),
			),
		)})`;

		const [project] = await this.db
			.select({
				hideWanditBadge: projects.hideWanditBadge,
				id: projects.id,
				metaPixelId: projects.metaPixelId,
				name: projects.name,
				ownerIsEntitled,
				publicFormId: projects.publicFormId,
				tiktokPixelId: projects.tiktokPixelId,
			})
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					sql`${projects.deletedAt} IS NULL`,
				),
			)
			.limit(1);

		// Missing and not-accessible both become 404 — never reveal which.
		if (!project) {
			throw new NotFoundException("Project not found");
		}

		return project;
	}

	// The project's draft pointer: the version a bare publish would ship.
	async findDraftVersion(projectId: string): Promise<ProjectVersionRow | null> {
		const [row] = await this.db
			.select({ id: versions.id, r2Key: versions.r2Key })
			.from(artifacts)
			.innerJoin(versions, eq(versions.id, artifacts.activeVersionId))
			.where(
				and(
					eq(artifacts.projectId, projectId),
					eq(artifacts.kind, "landing_page"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	// A caller-chosen version, proven to belong to this project.
	async findVersionForProject(
		versionId: string,
		projectId: string,
	): Promise<ProjectVersionRow | null> {
		const [row] = await this.db
			.select({ id: versions.id, r2Key: versions.r2Key })
			.from(versions)
			.where(and(eq(versions.id, versionId), eq(versions.projectId, projectId)))
			.limit(1);

		return row ?? null;
	}

	async insertPending(input: {
		projectId: string;
		slug: string;
		versionId: string;
	}): Promise<DeploymentRow> {
		return this.db.transaction(async (tx) => {
			// Serialize concurrent publishes of one project on the project row.
			await tx
				.select({ id: projects.id })
				.from(projects)
				.where(eq(projects.id, input.projectId))
				.for("update");

			const [row] = await tx
				.insert(deployments)
				.values({
					projectId: input.projectId,
					slug: input.slug,
					status: "pending",
					versionId: input.versionId,
				})
				.returning();

			if (!row) {
				throw new Error("Deployment insert did not return a row");
			}

			return row;
		});
	}

	/**
	 * Make one pending deployment the live one. Demote-before-promote in a
	 * single transaction, or deployments_active_project_uq rejects. A 23505 on
	 * deployments_active_slug_uq means another project went live on this slug
	 * between validation and promotion — surfaced as the same typed conflict
	 * the pre-check uses.
	 */
	async promoteToActive(
		deploymentId: string,
		projectId: string,
	): Promise<DeploymentRow> {
		try {
			return await this.db.transaction(async (tx) => {
				await tx
					.update(deployments)
					.set({ status: "superseded" })
					.where(
						and(
							eq(deployments.projectId, projectId),
							eq(deployments.status, "active"),
						),
					);

				const [row] = await tx
					.update(deployments)
					.set({ error: null, status: "active" })
					.where(
						and(
							eq(deployments.id, deploymentId),
							eq(deployments.projectId, projectId),
							eq(deployments.status, "pending"),
						),
					)
					.returning();

				if (!row) {
					throw new Error(
						`Deployment ${deploymentId} is no longer pending; refusing to promote`,
					);
				}

				return row;
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				const [row] = await this.db
					.select({ slug: deployments.slug })
					.from(deployments)
					.where(eq(deployments.id, deploymentId))
					.limit(1);

				throw new SlugTakenError(row?.slug ?? "slug");
			}

			throw error;
		}
	}

	async markFailed(
		deploymentId: string,
		error: string,
	): Promise<DeploymentRow | null> {
		const [row] = await this.db
			.update(deployments)
			.set({ error, status: "failed" })
			.where(
				and(
					eq(deployments.id, deploymentId),
					eq(deployments.status, "pending"),
				),
			)
			.returning();

		return row ?? null;
	}

	async unpublishActive(projectId: string): Promise<DeploymentRow | null> {
		const [row] = await this.db
			.update(deployments)
			.set({ status: "unpublished" })
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.status, "active"),
				),
			)
			.returning();

		return row ?? null;
	}

	async findActiveByProject(projectId: string): Promise<DeploymentRow | null> {
		const [row] = await this.db
			.select()
			.from(deployments)
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.status, "active"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async findById(
		deploymentId: string,
		projectId: string,
	): Promise<DeploymentRow | null> {
		const [row] = await this.db
			.select()
			.from(deployments)
			.where(
				and(
					eq(deployments.id, deploymentId),
					eq(deployments.projectId, projectId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	listByProject(projectId: string): Promise<DeploymentRow[]> {
		return this.db
			.select()
			.from(deployments)
			.where(eq(deployments.projectId, projectId))
			.orderBy(desc(deployments.createdAt), desc(deployments.id));
	}

	async isSlugTakenByOther(slug: string, projectId: string): Promise<boolean> {
		const [row] = await this.db
			.select({ id: deployments.id })
			.from(deployments)
			.where(
				and(
					eq(deployments.slug, slug),
					eq(deployments.status, "active"),
					ne(deployments.projectId, projectId),
				),
			)
			.limit(1);

		return Boolean(row);
	}

	// Self-heal on read: a pending row orphaned by a crash between insert and
	// promote/fail would otherwise pin the project to "publishing" forever.
	async healStalePending(projectId: string): Promise<void> {
		await this.db
			.update(deployments)
			.set({
				error:
					"The publish never finished — the server stopped mid-publish. Publish again.",
				status: "failed",
			})
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.status, "pending"),
					lt(deployments.createdAt, new Date(Date.now() - STALE_PENDING_MS)),
				),
			);
	}

	async findCurrent(projectId: string): Promise<CurrentDeploymentRows> {
		const [active, [newestPending], [newest], [draft]] = await Promise.all([
			this.findActiveByProject(projectId),
			this.db
				.select()
				.from(deployments)
				.where(
					and(
						eq(deployments.projectId, projectId),
						eq(deployments.status, "pending"),
					),
				)
				.orderBy(desc(deployments.createdAt), desc(deployments.id))
				.limit(1),
			this.db
				.select()
				.from(deployments)
				.where(eq(deployments.projectId, projectId))
				.orderBy(desc(deployments.createdAt), desc(deployments.id))
				.limit(1),
			this.db
				.select({ pendingVersionId: artifacts.activeVersionId })
				.from(artifacts)
				.where(
					and(
						eq(artifacts.projectId, projectId),
						eq(artifacts.kind, "landing_page"),
					),
				)
				.limit(1),
		]);

		return {
			active,
			newest: newest ?? null,
			newestPending: newestPending ?? null,
			pendingVersionId: draft?.pendingVersionId ?? null,
		};
	}
}

// Postgres unique_violation. Drizzle wraps the driver error, so walk the
// cause chain rather than trusting one shape.
function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;

	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (
			typeof current === "object" &&
			"code" in current &&
			(current as { code?: unknown }).code === "23505"
		) {
			return true;
		}

		current =
			typeof current === "object" && "cause" in current
				? (current as { cause?: unknown }).cause
				: null;
	}

	return false;
}
