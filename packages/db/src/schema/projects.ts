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

export const projects = pgTable(
	"projects",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			// restrict, not cascade: a user delete must not hard-wipe projects
			// (and their versions/deployments — the only catalog of live R2/KV
			// state); deletion is soft/anonymize at the app layer.
			.references(() => user.id, { onDelete: "restrict" }),
		name: text("name").notNull(),
		// Unguessable public id the generated page's lead form posts to.
		publicFormId: uuid("public_form_id").notNull().defaultRandom(),
		// Unguessable draft-preview subdomain: {token}.<preview-domain>.
		// Rotating the token = writing a new random value.
		previewToken: uuid("preview_token").notNull().defaultRandom(),
		metaPixelId: text("meta_pixel_id"),
		tiktokPixelId: text("tiktok_pixel_id"),
		// Soft delete: hides the project everywhere, keeps data recoverable.
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("projects_userId_idx").on(table.userId),
		// Dashboard list: caller's live projects, newest activity first.
		index("projects_dashboard_idx")
			.on(table.userId, table.updatedAt)
			.where(sql`${table.deletedAt} IS NULL`),
		uniqueIndex("projects_publicFormId_uq").on(table.publicFormId),
		uniqueIndex("projects_previewToken_uq").on(table.previewToken),
	],
);

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
