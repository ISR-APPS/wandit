/**
 * Maps a `ProjectQueryRow` to the V2 `AppProject` contract.
 * `AppProjectsService.get` calls it after the scope and engine checks; it
 * reuses the V1 `mapProjectRow` and adds the app-engine fields.
 */
import { type AppProject, appLanguageSchema } from "@wandit/contracts";

import { mapProjectRow } from "../../../projects/infrastructure/mappers/project.mapper";
import type { ProjectQueryRow } from "../../../projects/infrastructure/persistence/projects.repository";

/** One row → one API object; throws when `languages` holds a bad value. */
export function mapAppProjectRow(row: ProjectQueryRow): AppProject {
	return {
		...mapProjectRow(row),
		engine: row.engine,
		framework: row.framework,
		// The column is text[]; the database check constraint allows only
		// ar, fr, en, so the parse cannot fail on a good row.
		languages: appLanguageSchema.array().parse(row.languages),
		targetPlatform: row.targetPlatform,
		templateVersion: row.templateVersion,
	};
}
