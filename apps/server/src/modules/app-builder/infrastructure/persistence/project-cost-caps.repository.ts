/**
 * Read of the `project_cost_caps` row for one project.
 * The `builder-turn` runtime calls `findByProjectId` to price the LLM
 * proxy token cap; a missing row or null field means the plan default.
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
}
