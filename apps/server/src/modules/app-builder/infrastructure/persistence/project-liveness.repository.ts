/**
 * Narrow read of `projects` for the W4P orphan sweep: which project ids
 * still have a row that is not soft-deleted. The projects module owns the
 * table, so this read-only view lives here, like `TurnProjectRepository`.
 * `w4p-orphan-sweep.runtime.ts` composes it with the Trigger database.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, inArray, isNull } from "@wandit/db";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

@Injectable()
export class ProjectLivenessRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Answers the ids of `projectIds` whose row exists with `deletedAt` null.
	 * The caller passes uuids only: Postgres refuses any other value in the
	 * `IN` list of a uuid column. An empty input sends no query.
	 */
	async listLiveIds(projectIds: string[]): Promise<Set<string>> {
		if (projectIds.length === 0) {
			return new Set();
		}
		// LIMIT: one IN list, at most 65,535 ids (the Postgres bind limit).
		// Upgrade: query in chunks of 10,000 ids.
		const rows = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(and(inArray(projects.id, projectIds), isNull(projects.deletedAt)));
		return new Set(rows.map((row) => row.id));
	}
}
