// MCP connectors: catalog of connectable third-party providers (registry rows,
// seeded by apps/server/scripts/seed-mcp-connectors.ts) and per-user OAuth
// connections holding tokens + transient authorize-flow state.
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const mcpConnectorAuthKind = pgEnum("mcp_connector_auth_kind", [
	"mcp_dcr",
	"oauth_prereg",
]);

export const mcpConnectors = pgTable(
	"mcp_connectors",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull(),
		iconUrl: text("icon_url"),
		authKind: mcpConnectorAuthKind("auth_kind").notNull(),
		// mcp_dcr: discovery entrypoint. oauth_prereg: future MCP endpoint.
		mcpServerUrl: text("mcp_server_url"),
		// oauth_prereg only; null for mcp_dcr (discovered at connect time).
		authorizationUrl: text("authorization_url"),
		tokenUrl: text("token_url"),
		scopes: text("scopes"),
		enabled: boolean("enabled").notNull().default(true),
		sortOrder: integer("sort_order").notNull().default(0),
		toolPolicy: jsonb("tool_policy"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("mcp_connectors_slug_uq").on(table.slug)],
);

export const mcpConnections = pgTable(
	"mcp_connections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		connectorId: uuid("connector_id")
			.notNull()
			.references(() => mcpConnectors.id, { onDelete: "cascade" }),
		// Transient authorize-flow state; cleared by the callback.
		oauthState: text("oauth_state"),
		codeVerifier: text("code_verifier"),
		returnUrl: text("return_url"),
		// mcp_dcr dynamically registered client, retained across reconnects.
		clientInfo: jsonb("client_info"),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		connectedAt: timestamp("connected_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("mcp_connections_userId_connectorId_uq").on(
			table.userId,
			table.connectorId,
		),
		index("mcp_connections_oauthState_idx").on(table.oauthState),
		index("mcp_connections_userId_idx").on(table.userId),
	],
);

export const mcpConnectorsRelations = relations(mcpConnectors, ({ many }) => ({
	connections: many(mcpConnections),
}));

export const mcpConnectionsRelations = relations(mcpConnections, ({ one }) => ({
	connector: one(mcpConnectors, {
		fields: [mcpConnections.connectorId],
		references: [mcpConnectors.id],
	}),
	user: one(user, {
		fields: [mcpConnections.userId],
		references: [user.id],
	}),
}));
