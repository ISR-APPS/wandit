/**
 * Reads of the remote MCP server (docs/features/coding-agents-mcp.md) that prove the token on every call.
 * `McpTokenGuard` reads the token user and the consent of (user, client). Nothing here writes.
 * The tools prove the project role with `ProjectAccessService`, as the web routes do.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, or } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { oauthClient, oauthConsent } from "@wandit/db/schema/oauth-provider";

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
}
