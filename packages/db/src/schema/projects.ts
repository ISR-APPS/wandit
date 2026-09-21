// Database schema for projects.
//
// A project is the main workspace object. Chat, artifacts, deployments, and
// leads all connect back to a project.
//
// Projects are soft-deleted with `deletedAt`, so normal queries must filter it.
import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { appBackends } from "./app-backends";
import { appCommits } from "./app-versions";
import { artifacts } from "./artifacts";
import { user } from "./auth";
import { builderTurns } from "./builder-turns";
import { chats } from "./chats";
import { deployments } from "./deployments";
import { leads } from "./leads";
import { organization } from "./organizations";
import { sandboxSessions } from "./sandbox-sessions";

/** Which builder produces the project: a V1 page or a V2 app. */
export const projectEngine = pgEnum("project_engine", ["v1_page", "v2_app"]);

/** Device family a V2 app project targets. Null on V1 page projects. */
export const projectTargetPlatform = pgEnum("project_target_platform", [
	"web",
	"mobile",
]);

// Main workspace table.
export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			// Do not hard-delete projects automatically when a user is deleted.
			// For org projects this is the creating member — provenance only;
			// authorization goes through workspace membership, never this column.
			.references(() => user.id, { onDelete: "restrict" }),
		// NULL = personal project (authorized by userId). Set = org project
		// (authorized by org membership + role).
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Name shown in dashboard/workspace.
		name: text("name").notNull(),
		// Public id used by generated lead forms.
		publicFormId: uuid("public_form_id").notNull().defaultRandom(),
		// Token for future preview URLs.
		previewToken: uuid("preview_token").notNull().defaultRandom(),
		metaPixelId: text("meta_pixel_id"),
		tiktokPixelId: text("tiktok_pixel_id"),
		// Hero-viewport screenshot of the latest activated build (dashboard card
		// cover). Null until a build succeeds.
		previewImageUrl: text("preview_image_url"),
		// User-uploaded brand logo reused by page rebuilds. Null until selected.
		logoUrl: text("logo_url"),
		// Publishing setting: hide the "Made with Wandit" badge on the published
		// page. Honoured at publish time ONLY while the owner holds an entitled
		// subscription — free publishes always carry the badge.
		hideWanditBadge: boolean("hide_wandit_badge").notNull().default(false),
		// Which builder produces the project. An existing project never
		// changes engine; V1 rows stay `v1_page`.
		engine: projectEngine("engine").notNull().default("v1_page"),
		// Device family the app targets. Null on V1 page projects.
		targetPlatform: projectTargetPlatform("target_platform"),
		// App template stack of a V2 project, for example `tanstack-start`.
		framework: text("framework"),
		// Version of the app template the project was created from.
		templateVersion: text("template_version"),
		// Languages the agent must build in (D7). The check below allows only
		// ar, fr, and en.
		languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
		// Extra egress hosts the V2 sandbox may reach, on top of the global
		// allow list (WANDIT-180). The `request_network_host` host tool appends
		// one host per approval; `buildNetworkPolicy` reads them as layer 3.
		networkAllowedHosts: jsonb("network_allowed_hosts")
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		// Soft delete marker.
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		// Timestamps used for dashboard sorting.
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// Speeds up owner-based lookups.
		index("projects_userId_idx").on(table.userId),
		// Speeds up dashboard list of live projects.
		index("projects_dashboard_idx")
			.on(table.userId, table.updatedAt)
			.where(sql`${table.deletedAt} IS NULL`),
		// Org workspace dashboard listing.
		index("projects_org_dashboard_idx")
			.on(table.organizationId, table.updatedAt)
			.where(
				sql`${table.deletedAt} IS NULL AND ${table.organizationId} IS NOT NULL`,
			),
		// Public tokens must be unique.
		uniqueIndex("projects_publicFormId_uq").on(table.publicFormId),
		uniqueIndex("projects_previewToken_uq").on(table.previewToken),
		// V2 listings filter on engine without touching soft-deleted rows.
		index("projects_engine_idx")
			.on(table.engine)
			.where(sql`${table.deletedAt} IS NULL`),
		check(
			"projects_languages_allowed_ck",
			sql`${table.languages} <@ ARRAY['ar','fr','en']::text[]`,
		),
	],
);

// Relations tell Drizzle what connects to a project.
export const projectsRelations = relations(projects, ({ one, many }) => ({
	user: one(user, {
		fields: [projects.userId],
		references: [user.id],
	}),
	chats: many(chats),
	artifacts: many(artifacts),
	deployments: many(deployments),
	leads: many(leads),
	builderTurns: many(builderTurns),
	sandboxSessions: many(sandboxSessions),
	appCommits: many(appCommits),
	// Inverse side of app_backends.projectId — the column lives on the
	// backend row, not on projects.
	appBackend: one(appBackends),
}));
