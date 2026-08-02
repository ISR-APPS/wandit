// Database schema for projects.
//
// A project is the main workspace object. Chat, artifacts, deployments, and
// leads all connect back to a project.
//
// Projects are soft-deleted with `deletedAt`, so normal queries must filter it.
import { relations, sql } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { artifacts } from "./artifacts";
import { user } from "./auth";
import { chats } from "./chats";
import { deployments } from "./deployments";
import { leads } from "./leads";

// Main workspace table.
export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			// Do not hard-delete projects automatically when a user is deleted.
			.references(() => user.id, { onDelete: "restrict" }),
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
		// Public tokens must be unique.
		uniqueIndex("projects_publicFormId_uq").on(table.publicFormId),
		uniqueIndex("projects_previewToken_uq").on(table.previewToken),
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
}));
