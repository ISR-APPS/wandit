import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const storyLinks = pgTable(
	"story_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		utmSource: text("utm_source").notNull(),
		utmMedium: text("utm_medium").notNull(),
		utmCampaign: text("utm_campaign").notNull(),
		utmContent: text("utm_content"),
		destinationPath: text("destination_path").notNull().default("/"),
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("story_links_slug_uq").on(table.slug)],
);

export const storyLinkClicks = pgTable(
	"story_link_clicks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		storyLinkId: uuid("story_link_id")
			.notNull()
			.references(() => storyLinks.id, { onDelete: "restrict" }),
		ipHash: text("ip_hash").notNull(),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("story_link_clicks_storyLinkId_createdAt_idx").on(
			table.storyLinkId,
			table.createdAt,
		),
		index("story_link_clicks_createdAt_idx").on(table.createdAt),
	],
);
