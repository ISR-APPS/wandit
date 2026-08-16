import {
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userAttributionSource = pgEnum("user_attribution_source", [
	"cookie",
	"body",
]);

export const userAttributions = pgTable(
	"user_attributions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		utmSource: text("utm_source"),
		utmMedium: text("utm_medium"),
		utmCampaign: text("utm_campaign"),
		utmContent: text("utm_content"),
		storyLinkSlug: text("story_link_slug"),
		landingPath: text("landing_path"),
		referrer: text("referrer"),
		country: text("country"),
		device: text("device"),
		source: userAttributionSource("source").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [uniqueIndex("user_attributions_userId_uq").on(table.userId)],
);
