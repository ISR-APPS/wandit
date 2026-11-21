/**
 * Table of the trophies that a user unlocked. One row per user and trophy, written on the first unlock.
 * The server module `trophies` reads and writes it through its repository.
 * The catalog lives in `@wandit/contracts` (`v1/trophies.ts`). This table stores ids only.
 */
import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** One stored unlock. A row stays when its fact goes down later, so points never go down. */
export const userTrophies = pgTable(
	"user_trophies",
	{
		userId: text("user_id")
			.notNull()
			// cascade: a trophy is personal and holds no money or credit history.
			.references(() => user.id, { onDelete: "cascade" }),
		// An id of TROPHIES in `@wandit/contracts`. Text, not a PG enum, so a catalog change needs no migration.
		trophyId: text("trophy_id").notNull(),
		unlockedAt: timestamp("unlocked_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		// The time the web showed the unlock toast. Null while the trophy is new.
		seenAt: timestamp("seen_at", { withTimezone: true }),
	},
	// The key makes a second insert of the same unlock a no-op (ON CONFLICT DO NOTHING).
	(table) => [primaryKey({ columns: [table.userId, table.trophyId] })],
);
