/**
 * Read and write of the `project_cost_caps` row for one project.
 * The `builder-turn` runtime calls `findByProjectId` to price the LLM
 * proxy token cap; the cost-caps controller calls `upsert` to store the
 * owner's limits. A missing row or null field means the plan default.
 */
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { projectCostCaps } from "@wandit/db/schema/project-cost-caps";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** The cap columns a builder turn reads; centi-credits, null = default. */
export type ProjectCostCapsRow = {
	/** Monthly ceiling in centi-credits; null means the plan default. */
	monthlyCapCredits: number | null;
	/** Per-turn ceiling in centi-credits; null means the plan default. */
	perTurnCapCredits: number | null;
};

@Injectable()
export class ProjectCostCapsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The caps row of one project, or null when none was written. */
	async findByProjectId(projectId: string): Promise<ProjectCostCapsRow | null> {
		const [row] = await this.db
			.select({
				monthlyCapCredits: projectCostCaps.monthlyCapCredits,
				perTurnCapCredits: projectCostCaps.perTurnCapCredits,
			})
			.from(projectCostCaps)
			.where(eq(projectCostCaps.projectId, projectId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Writes the two cap columns of one project; creates the row when the
	 * project has none. `updatedByUserId` is the acting user from the
	 * request. Throws when Postgres returns no row.
	 */
	async upsert(
		projectId: string,
		caps: ProjectCostCapsRow,
		updatedByUserId: string,
	): Promise<ProjectCostCapsRow> {
		const [row] = await this.db
			.insert(projectCostCaps)
			.values({
				projectId,
				monthlyCapCredits: caps.monthlyCapCredits,
				perTurnCapCredits: caps.perTurnCapCredits,
				updatedByUserId,
			})
			.onConflictDoUpdate({
				target: projectCostCaps.projectId,
				set: {
					monthlyCapCredits: caps.monthlyCapCredits,
					perTurnCapCredits: caps.perTurnCapCredits,
					updatedByUserId,
					updatedAt: new Date(),
				},
			})
			.returning({
				monthlyCapCredits: projectCostCaps.monthlyCapCredits,
				perTurnCapCredits: projectCostCaps.perTurnCapCredits,
			});
		if (row === undefined) {
			throw new Error("project_cost_caps upsert returned no row");
		}
		return row;
	}
}
