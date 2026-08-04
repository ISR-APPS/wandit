/**
 * Minimal persistence for the Assets tab: prove project ownership before any
 * listing or download. The media rows themselves come from the image/video
 * repositories (already ownership-joined); the R2 prefix listing has no rows
 * at all, which is exactly why this explicit gate must run first.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "@wandit/db";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

@Injectable()
export class ProjectAssetsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async isProjectAccessible(
		scope: ProjectScope,
		projectId: string,
	): Promise<boolean> {
		const [row] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return Boolean(row);
	}
}
