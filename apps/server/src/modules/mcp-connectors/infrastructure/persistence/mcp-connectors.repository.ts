import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq } from "@wandit/db";
import { mcpConnectors } from "@wandit/db/schema/mcp-connectors";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type McpConnectorRow = typeof mcpConnectors.$inferSelect;

@Injectable()
export class McpConnectorsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	listEnabled(): Promise<McpConnectorRow[]> {
		return this.db
			.select()
			.from(mcpConnectors)
			.where(eq(mcpConnectors.enabled, true))
			.orderBy(asc(mcpConnectors.sortOrder), asc(mcpConnectors.slug));
	}

	async findEnabledBySlug(slug: string): Promise<McpConnectorRow | null> {
		const [row] = await this.db
			.select()
			.from(mcpConnectors)
			.where(and(eq(mcpConnectors.slug, slug), eq(mcpConnectors.enabled, true)))
			.limit(1);

		return row ?? null;
	}
}
