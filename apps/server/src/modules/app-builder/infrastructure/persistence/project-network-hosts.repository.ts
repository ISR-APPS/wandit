/**
 * Writes the `projects.networkAllowedHosts` egress allow list (WANDIT-180).
 * The `request_network_host` host tool calls `appendHost` after the user
 * approves a host. `buildNetworkPolicy` reads the column at the next
 * sandbox start. Writes go through Drizzle only.
 */
import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "@wandit/db";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

@Injectable()
export class ProjectNetworkHostsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Adds `host` to the project's allow list and answers the new list.
	 * The write is deduped in one statement, so a repeated approval of the
	 * same host is a no-op. Returns an empty list when the project is gone.
	 */
	async appendHost(projectId: string, host: string): Promise<string[]> {
		const [row] = await this.db
			.update(projects)
			.set({
				// Concatenate the host as a jsonb string, then re-aggregate the
				// distinct text elements, so a repeated host adds no duplicate.
				networkAllowedHosts: sql`(
					select coalesce(jsonb_agg(distinct element), '[]'::jsonb)
					from jsonb_array_elements_text(
						${projects.networkAllowedHosts} || to_jsonb(${host}::text)
					) as element
				)`,
			})
			.where(eq(projects.id, projectId))
			.returning({ networkAllowedHosts: projects.networkAllowedHosts });
		return row?.networkAllowedHosts ?? [];
	}
}
