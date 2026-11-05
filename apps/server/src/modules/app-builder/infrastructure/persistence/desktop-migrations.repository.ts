/**
 * Reads the `desktop_migrations` registry: the migration files that a ready
 * desktop build held (docs/v2/desktop-apps.md section 6). The
 * `add_local_migration` host tool and the `desktop-build` task read it
 * before the gate. The build task writes the rows in its `ready` transaction.
 */
import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "@wandit/db";
import { desktopMigrations } from "@wandit/db/schema/desktop-apps";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { ReleasedDesktopMigration } from "../../domain/desktop-migrations";

@Injectable()
export class DesktopMigrationsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The frozen files of one project, in version order. Empty before the first ready build. */
	async listFrozen(projectId: string): Promise<ReleasedDesktopMigration[]> {
		return this.db
			.select({
				name: desktopMigrations.name,
				sha256: desktopMigrations.sha256,
				version: desktopMigrations.version,
			})
			.from(desktopMigrations)
			.where(eq(desktopMigrations.projectId, projectId))
			.orderBy(asc(desktopMigrations.version));
	}
}
