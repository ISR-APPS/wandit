import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const productEventKind = pgEnum("product_event_kind", [
	"pricing_viewed",
	"upgrade_clicked",
]);

export const productEvents = pgTable(
	"product_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		kind: productEventKind("kind").notNull(),
		properties: jsonb("properties")
			.$type<{ method?: "card" | "offline" }>()
			.notNull()
			.default({}),
		surface: text("surface").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("product_events_idempotency_uq").on(table.idempotencyKey),
		index("product_events_kind_createdAt_idx").on(table.kind, table.createdAt),
		index("product_events_userId_kind_idx").on(table.userId, table.kind),
	],
);
