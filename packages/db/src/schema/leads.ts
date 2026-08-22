import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { deployments } from "./deployments";
import { projects } from "./projects";

// cancelled = phone confirmation failed (refused / unreachable / fake order) —
// the most common terminal COD outcome; economically distinct from returned,
// which implies shipping cost was incurred.
export const leadStatus = pgEnum("lead_status", [
	"to_confirm",
	"confirmed",
	"shipped",
	"delivered",
	"returned",
	"cancelled",
]);

export const leads = pgTable(
	"leads",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// Which live deployment captured it. FK'd as a (projectId, deploymentId)
		// pair below; deployment rows are only ever deleted with the whole
		// project, so leads keep their provenance for the project's lifetime.
		deploymentId: uuid("deployment_id"),
		productSku: text("product_sku"),
		name: text("name").notNull(),
		// Canonical E.164 (+213…) — the capture endpoint normalizes (folds
		// Arabic-Indic digits, maps 0 / 00213 prefixes) before insert and keeps
		// the raw input in extras; unparseable phones are a form validation error.
		phone: text("phone").notNull(),
		// First-class for Algeria; optional so non-COD pages can skip them.
		wilaya: text("wilaya"),
		commune: text("commune"),
		// Anything else the page's form collects (product options, quantity…).
		extras: jsonb("extras"),
		// Ad attribution, captured server-side from the whitelisted params the
		// page's form script forwards (page contract): utm_source, utm_medium,
		// utm_campaign, utm_term, utm_content, fbclid, ttclid, referrer,
		// landing_url. Separate from visitor-supplied extras.
		attribution: jsonb("attribution"),
		status: leadStatus("status").notNull().default("to_confirm"),
		statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("leads_projectId_createdAt_idx").on(table.projectId, table.createdAt),
		index("leads_active_projectId_createdAt_idx")
			.on(table.projectId, table.createdAt)
			.where(sql`${table.archivedAt} is null`),
		index("leads_projectId_status_createdAt_idx").on(
			table.projectId,
			table.status,
			table.createdAt,
		),
		// Dashboard aggregate list: newest-first keyset across every project in
		// scope has no project_id equality, so it needs a bare recency index (a
		// backward scan serves created_at DESC, id DESC).
		index("leads_createdAt_id_idx").on(table.createdAt, table.id),
		// A lead's deployment must belong to the lead's own project.
		foreignKey({
			columns: [table.projectId, table.deploymentId],
			foreignColumns: [deployments.projectId, deployments.id],
			name: "leads_project_deployment_fk",
		}),
		// Practical E.164 shape: leading +, no leading zero, 8–15 digits.
		// Deliberately not Algeria-only — pages serve any business goal.
		check("leads_phone_e164_ck", sql`${table.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
	],
);

export const leadsRelations = relations(leads, ({ one }) => ({
	project: one(projects, {
		fields: [leads.projectId],
		references: [projects.id],
	}),
	deployment: one(deployments, {
		fields: [leads.deploymentId],
		references: [deployments.id],
	}),
}));
