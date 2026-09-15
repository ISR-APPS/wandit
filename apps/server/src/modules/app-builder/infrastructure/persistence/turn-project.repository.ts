/**
 * Narrow read of the `projects` row the builder-turn task needs.
 * The `builder-turn` runtime calls `findForTurn`; the projects module
 * owns the table, so this read-only view lives here instead of widening
 * `ProjectsRepository` for one task.
 */
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** The project columns a builder turn reads. */
export type TurnProjectRow = {
	/** `v1_page` or `v2_app`; the runtime fails a turn on `v1_page`. */
	engine: "v1_page" | "v2_app";
	/** Sandbox template family; null means a broken V2 row. */
	framework: string | null;
	/** Template release tag; null means a broken V2 row. */
	templateVersion: string | null;
	/** Output languages the harness instructions enforce. */
	languages: string[];
	/** Project creator; the sandbox owner. */
	userId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
};

@Injectable()
export class TurnProjectRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The columns above for one project, or null. */
	async findForTurn(projectId: string): Promise<TurnProjectRow | null> {
		const [row] = await this.db
			.select({
				engine: projects.engine,
				framework: projects.framework,
				languages: projects.languages,
				organizationId: projects.organizationId,
				templateVersion: projects.templateVersion,
				userId: projects.userId,
			})
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		return row ?? null;
	}
}
