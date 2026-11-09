/**
 * Tables of the Better Auth OAuth provider for the remote MCP server (D29).
 * The plugins `jwt()`, `mcp()` (oauth-provider), and `cimd()` of `@better-auth/*` 1.7.16 read and write them
 * through the Drizzle adapter in `@wandit/auth`. The adapter finds each model by its export name.
 * The columns copy `getAuthTables()` of that plugin set. Check them again on each Better Auth upgrade.
 */
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { session, user } from "./auth";

/** Signing keys of the `jwt()` plugin. It signs the MCP access tokens. The private key is encrypted with BETTER_AUTH_SECRET. */
export const jwks = pgTable("jwks", {
	id: text("id").primaryKey(),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }),
	alg: text("alg"),
	crv: text("crv"),
});

/** One OAuth client: a coding agent from CIMD (`clientId` is a URL) or from Dynamic Client Registration. */
export const oauthClient = pgTable(
	"oauth_client",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id").notNull().unique(),
		// Hashed at rest. Null for the public clients that the MCP server accepts.
		clientSecret: text("client_secret"),
		// Set by `cimd()`: the discovery that created the row.
		clientDiscoveryId: text("client_discovery_id"),
		disabled: boolean("disabled").default(false),
		// Wandit never sets it: every client shows the consent page.
		skipConsent: boolean("skip_consent"),
		enableEndSession: boolean("enable_end_session"),
		subjectType: text("subject_type"),
		scopes: text("scopes").array(),
		clientCredentialsScopes: text("client_credentials_scopes").array(),
		// Owner of a client that a signed-in user created. Null for CIMD and DCR clients.
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }),
		// Client name, given by the client. The consent page marks it as "given by the app".
		name: text("name"),
		uri: text("uri"),
		icon: text("icon"),
		contacts: text("contacts").array(),
		tos: text("tos"),
		policy: text("policy"),
		softwareId: text("software_id"),
		softwareVersion: text("software_version"),
		softwareStatement: text("software_statement"),
		redirectUris: text("redirect_uris").array().notNull(),
		postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
		backchannelLogoutUri: text("backchannel_logout_uri"),
		backchannelLogoutSessionRequired: boolean(
			"backchannel_logout_session_required",
		),
		tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
		applicationType: text("application_type"),
		jwks: text("jwks"),
		jwksUri: text("jwks_uri"),
		grantTypes: text("grant_types").array(),
		responseTypes: text("response_types").array(),
		requirePKCE: boolean("require_pkce"),
		dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
		// Owner group of the client, from the `clientReference` option. Wandit sets no such option, so it stays null.
		referenceId: text("reference_id"),
		// Plugin-owned JSON. Wandit code does not read it.
		metadata: jsonb("metadata"),
	},
	(table) => [index("oauth_client_userId_idx").on(table.userId)],
);

/** One protected resource (RFC 8707). The plugin seeds the MCP resource `<BETTER_AUTH_URL>/api/mcp` at boot. */
export const oauthResource = pgTable("oauth_resource", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	name: text("name").notNull(),
	// Seconds. Null means the provider default (15 minutes for access tokens here).
	accessTokenTtl: integer("access_token_ttl"),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	// `kid` of the `jwks` row that signs tokens for this resource. Null signs with the newest jwt() key.
	signingKeyId: text("signing_key_id"),
	allowedScopes: text("allowed_scopes").array(),
	customClaims: jsonb("custom_claims"),
	dpopBoundAccessTokensRequired: boolean(
		"dpop_bound_access_tokens_required",
	).default(false),
	disabled: boolean("disabled").default(false),
	createdAt: timestamp("created_at", { withTimezone: true }),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
	// Format version of the policy columns. The plugin writes 1 and does not read it in 1.7.16.
	policyVersion: integer("policy_version").default(1),
	metadata: jsonb("metadata"),
});

/** Link of a client to a resource. A client gets a token only for a linked resource. */
export const oauthClientResource = pgTable(
	"oauth_client_resource",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		resourceId: text("resource_id")
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: "cascade" }),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }),
	},
	(table) => [
		index("oauth_client_resource_clientId_idx").on(table.clientId),
		index("oauth_client_resource_resourceId_idx").on(table.resourceId),
		// The plugin assumes one row per pair. A concurrent second link fails here and becomes a no-op.
		uniqueIndex("oauth_client_resource_clientId_resourceId_uq").on(
			table.clientId,
			table.resourceId,
		),
	],
);

/** Refresh tokens, hashed at rest. 30 days, rotated on each use. A reuse revokes the family. */
export const oauthRefreshToken = pgTable(
	"oauth_refresh_token",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// The consent `referenceId` of the grant. Wandit sets no consent reference, so it stays null.
		referenceId: text("reference_id"),
		// Hash of the authorization code of the grant. A second use of that code deletes its tokens.
		authorizationCodeId: text("authorization_code_id"),
		resources: text("resources").array(),
		// Claim names from the OIDC `claims.userinfo` parameter. Userinfo adds them to the claims of the scopes.
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		// Time the token stopped: a revoke or a rotation. A use after the 30 s reuse window revokes the family.
		revoked: timestamp("revoked", { withTimezone: true }),
		rotatedAt: timestamp("rotated_at", { withTimezone: true }),
		// The token answer that a retried refresh gets back in the 30 s reuse window.
		rotationReplayResponse: text("rotation_replay_response"),
		rotationReplayExpiresAt: timestamp("rotation_replay_expires_at", {
			withTimezone: true,
		}),
		authTime: timestamp("auth_time", { withTimezone: true }),
		// DPoP key binding (`cnf`). Plugin-owned JSON.
		confirmation: jsonb("confirmation"),
		scopes: text("scopes").array().notNull(),
	},
	(table) => [
		index("oauth_refresh_token_clientId_idx").on(table.clientId),
		index("oauth_refresh_token_sessionId_idx").on(table.sessionId),
		index("oauth_refresh_token_userId_idx").on(table.userId),
		index("oauth_refresh_token_authorizationCodeId_idx").on(
			table.authorizationCodeId,
		),
	],
);

/** Opaque access tokens, hashed at rest. The MCP server refuses them: it accepts only JWT access tokens. */
export const oauthAccessToken = pgTable(
	"oauth_access_token",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		// The consent `referenceId` of the grant. Wandit sets no consent reference, so it stays null.
		referenceId: text("reference_id"),
		// Hash of the authorization code of the grant. A second use of that code deletes its tokens.
		authorizationCodeId: text("authorization_code_id"),
		resources: text("resources").array(),
		// Claim names from the OIDC `claims.userinfo` parameter. Userinfo adds them to the claims of the scopes.
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
			onDelete: "cascade",
		}),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		// Time of the revoke. Introspection answers "inactive" for a revoked token.
		revoked: timestamp("revoked", { withTimezone: true }),
		confirmation: jsonb("confirmation"),
		scopes: text("scopes").array().notNull(),
	},
	(table) => [
		index("oauth_access_token_clientId_idx").on(table.clientId),
		index("oauth_access_token_sessionId_idx").on(table.sessionId),
		index("oauth_access_token_userId_idx").on(table.userId),
		index("oauth_access_token_authorizationCodeId_idx").on(
			table.authorizationCodeId,
		),
		index("oauth_access_token_refreshId_idx").on(table.refreshId),
	],
);

/** The grant of one user to one client. The MCP token guard checks that this row exists on each call. */
export const oauthConsent = pgTable(
	"oauth_consent",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		// Key from the `postLogin.consentReferenceId` option. Wandit sets no such option, so it stays null.
		referenceId: text("reference_id"),
		resources: text("resources").array(),
		// Claim names from the OIDC `claims.userinfo` parameter that the user accepted on the consent page.
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		scopes: text("scopes").array().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		index("oauth_consent_clientId_idx").on(table.clientId),
		index("oauth_consent_userId_idx").on(table.userId),
	],
);

/** Used client assertions, so a `private_key_jwt` assertion works once. The row id is a hash of its `jti`. */
export const oauthClientAssertion = pgTable("oauth_client_assertion", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
