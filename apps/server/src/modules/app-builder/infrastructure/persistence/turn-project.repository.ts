/**
 * Narrow read of the `projects` row the builder-turn task needs.
 * The `builder-turn` runtime calls `findForTurn`, and so does
 * `startSandboxWithoutTurn` (restore, wake, publish) for the same sandbox
 * inputs. The projects module owns the table, so this read-only view lives
 * here instead of widening `ProjectsRepository`.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "@wandit/db";
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
	/** UI locale at project creation. The harness instructions give it as a hint, not a rule. */
	languages: string[];
	/** Per-project egress hosts (WANDIT-180); layer 3 of the allow list. */
	networkAllowedHosts: string[];
	/** Project creator; the sandbox owner. */
	userId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
};

@Injectable()
export class TurnProjectRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * The columns above for one live project, or null.
	 * A deleted project answers null. A queued turn then fails as
	 * `project_missing` before any sandbox work.
	 * A restore, wake, or publish does not start.
	 */
	async findForTurn(projectId: string): Promise<TurnProjectRow | null> {
		const [row] = await this.db
			.select({
				engine: projects.engine,
				framework: projects.framework,
				languages: projects.languages,
				networkAllowedHosts: projects.networkAllowedHosts,
				organizationId: projects.organizationId,
				templateVersion: projects.templateVersion,
				userId: projects.userId,
			})
			.from(projects)
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);

		return row ?? null;
	}
}
