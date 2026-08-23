import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const pushTokenPlatform = pgEnum("push_token_platform", [
	"ios",
	"android",
]);

// One row per device installation. The token is the device identity, so
// re-registering an existing token for another user moves this row to that user.
export const pushTokens = pgTable(
	"push_tokens",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		platform: pushTokenPlatform("platform").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("push_tokens_userId_idx").on(table.userId)],
);
