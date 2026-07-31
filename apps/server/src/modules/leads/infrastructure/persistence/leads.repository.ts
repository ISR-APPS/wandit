/**
 * Persistence for captured leads.
 *
 * Two access paths with different trust levels: the public capture endpoint
 * resolves a project by its unguessable publicFormId (no user in sight), and
 * the workspace endpoints prove ownership in SQL through the projects join
 * (misses read as 404, never 403 — docs/api-security.md).
 */
import { Inject, Injectable } from "@nestjs/common";
import type { LeadStatus } from "@wandit/contracts";
import { and, desc, eq, gt, isNull, sql } from "@wandit/db";
import { deployments } from "@wandit/db/schema/deployments";
import { leads } from "@wandit/db/schema/leads";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type LeadRow = {
	attribution: unknown;
	commune: string | null;
	createdAt: Date;
	extras: unknown;
	id: string;
	name: string;
	phone: string;
	status: LeadStatus;
	wilaya: string | null;
};

const LEAD_COLUMNS = {
	attribution: leads.attribution,
	commune: leads.commune,
	createdAt: leads.createdAt,
	extras: leads.extras,
	id: leads.id,
	name: leads.name,
	phone: leads.phone,
	status: leads.status,
	wilaya: leads.wilaya,
} as const;

// The Leads tab loads the full list and works client-side; the cap only
// guards against a runaway project becoming an unbounded response.
const LIST_LIMIT = 1_000;

// The sheet sync exports everything the merchant has — the tab cap is a UI
// response guard, not export semantics. This ceiling only bounds a
// pathological flood (far beyond any real project) so one sync stays a
// single in-memory batch and one Google write.
const SYNC_LIST_LIMIT = 10_000;

@Injectable()
export class LeadsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Capture path: unguessable form id → live project, or null. */
	async findProjectByPublicFormId(
		publicFormId: string,
	): Promise<{ id: string } | null> {
		const [row] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.publicFormId, publicFormId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/** Which live deployment captured the lead — null before publishing exists. */
	async findActiveDeploymentId(projectId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ id: deployments.id })
			.from(deployments)
			.where(
				and(
					eq(deployments.projectId, projectId),
					eq(deployments.status, "active"),
				),
			)
			.limit(1);

		return row?.id ?? null;
	}

	/** Double-submit guard: same phone on the same project since `since`. */
	async hasRecentLeadWithPhone(
		projectId: string,
		phone: string,
		since: Date,
	): Promise<boolean> {
		const [row] = await this.db
			.select({ id: leads.id })
			.from(leads)
			.where(
				and(
					eq(leads.projectId, projectId),
					eq(leads.phone, phone),
					gt(leads.createdAt, since),
				),
			)
			.limit(1);

		return Boolean(row);
	}

	async insertLead(input: {
		attribution: Record<string, unknown> | null;
		commune: string | null;
		deploymentId: string | null;
		extras: Record<string, unknown> | null;
		name: string;
		phone: string;
		projectId: string;
		wilaya: string | null;
	}): Promise<void> {
		await this.db.insert(leads).values(input);
	}

	async listOwnedByProject(
		userId: string,
		projectId: string,
		limit = LIST_LIMIT,
	): Promise<LeadRow[]> {
		return this.listOwned(
			userId,
			projectId,
			Math.min(LIST_LIMIT, Math.max(1, Math.floor(limit))),
		);
	}

	async countOwnedByProject(
		userId: string,
		projectId: string,
	): Promise<number> {
		const [row] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				and(
					eq(leads.projectId, projectId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			);

		return row?.total ?? 0;
	}

	async listOwnedByProjectForSync(
		userId: string,
		projectId: string,
	): Promise<LeadRow[]> {
		return this.listOwned(userId, projectId, SYNC_LIST_LIMIT);
	}

	private listOwned(
		userId: string,
		projectId: string,
		limit: number,
	): Promise<LeadRow[]> {
		return this.db
			.select(LEAD_COLUMNS)
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				and(
					eq(leads.projectId, projectId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.orderBy(desc(leads.createdAt))
			.limit(limit);
	}

	async updateOwnedLeadStatus(
		userId: string,
		projectId: string,
		leadId: string,
		status: LeadStatus,
	): Promise<LeadRow | null> {
		const [owned] = await this.db
			.select({ id: leads.id })
			.from(leads)
			.innerJoin(projects, eq(projects.id, leads.projectId))
			.where(
				and(
					eq(leads.id, leadId),
					eq(leads.projectId, projectId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		if (!owned) {
			return null;
		}

		const [row] = await this.db
			.update(leads)
			.set({ status, statusChangedAt: new Date() })
			.where(eq(leads.id, leadId))
			.returning(LEAD_COLUMNS);

		return row ?? null;
	}
}
