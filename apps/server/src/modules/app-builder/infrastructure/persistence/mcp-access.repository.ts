/**
 * Reads of the remote MCP server (docs/features/coding-agents-mcp.md) that prove access on every call.
 * `McpTokenGuard` reads the token user and the consent of (user, client). `McpTools`
 * reads the owner columns of a project before it builds the `ProjectScope`. Nothing here writes.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { oauthClient, oauthConsent } from "@wandit/db/schema/oauth-provider";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** One `user` row. The guard puts it on `request.user`, as `AuthGuard` puts the session user. */
export type McpUserRow = typeof user.$inferSelect;

/** The columns of one `oauth_consent` row that `McpTokenGuard` reads. */
export type McpConsentRow = {
	/** The scopes that the user granted to the client. */
	scopes: string[];
	/**
	 * When the user granted the client. Better Auth sets it in whole seconds. A second grant
	 * updates the row and keeps this value. Only a grant after a revoke makes a new row.
	 */
	createdAt: Date;
};

/** The owner columns of one non-deleted `projects` row. */
export type McpProjectOwner = {
	/** Creator of the project. The only user with access to a personal project. */
	userId: string;
	/** Team of the project, or null on a personal project. */
	organizationId: string | null;
	/** "v1_page" or "v2_app". The MCP tools serve only "v2_app". */
	engine: "v1_page" | "v2_app";
};

/** Each method reads Postgres on each MCP call, with no cache, so a ban or a revoke applies at once. */
@Injectable()
export class McpAccessRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** The user row of the token subject, or null when the account is gone. */
	async findUser(userId: string): Promise<McpUserRow | null> {
		const [row] = await this.db
			.select()
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		return row ?? null;
	}

	/**
	 * The consent of (user, client), or null without a consent row.
	 * A revoke deletes the row. A disabled client also gives null, so its tokens stop at once.
	 */
	async findConsent(
		userId: string,
		clientId: string,
	): Promise<McpConsentRow | null> {
		const [row] = await this.db
			.select({
				createdAt: oauthConsent.createdAt,
				scopes: oauthConsent.scopes,
			})
			.from(oauthConsent)
			.innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
			.where(
				and(
					eq(oauthConsent.userId, userId),
					eq(oauthConsent.clientId, clientId),
					// `disabled` is nullable, and null means enabled. A plain `NOT disabled` drops null rows.
					or(isNull(oauthClient.disabled), eq(oauthClient.disabled, false)),
				),
			)
			.limit(1);
		return row ?? null;
	}

	/** The owner columns of a non-deleted project, or null. The caller then proves access. */
	async findProjectOwner(projectId: string): Promise<McpProjectOwner | null> {
		const [row] = await this.db
			.select({
				engine: projects.engine,
				organizationId: projects.organizationId,
				userId: projects.userId,
			})
			.from(projects)
			.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
			.limit(1);
		return row ?? null;
	}
}
