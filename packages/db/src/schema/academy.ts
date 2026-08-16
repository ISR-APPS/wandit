import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const academyGuides = pgTable(
	"academy_guides",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title").notNull(),
		description: text("description"),
		category: text("category"),
		youtubeUrl: text("youtube_url"),
		youtubeVideoId: text("youtube_video_id"),
		bodyHtml: text("body_html").notNull().default(""),
		status: text("status").notNull().default("draft"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("academy_guides_status_publishedAt_idx").on(
			table.status,
			table.publishedAt,
		),
	],
);
