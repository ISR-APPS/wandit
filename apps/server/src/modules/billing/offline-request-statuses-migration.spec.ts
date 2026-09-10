import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
	"../../../../../packages/db/src/migrations/0071_offline-request-statuses.sql",
	import.meta.url,
);
const schemaUrl = new URL(
	"../../../../../packages/db/src/schema/billing.ts",
	import.meta.url,
);

const OPEN_PREDICATE = /NOT IN \('approved', 'rejected', 'canceled'\)/g;

describe("offline request statuses migration", () => {
	it("adds the four call-outcome values to the status enum", async () => {
		const migration = await readFile(migrationUrl, "utf8");

		for (const status of [
			"no_answer",
			"call_back",
			"wrong_number",
			"awaiting_payment",
		]) {
			expect(migration).toContain(
				`ALTER TYPE "public"."manual_subscription_request_status" ADD VALUE '${status}'`,
			);
		}
	});

	it("names only the terminal statuses in both index predicates", async () => {
		const migration = await readFile(migrationUrl, "utf8");
		const createIndexStatements = migration
			.split("--> statement-breakpoint")
			.filter((statement) => statement.includes("CREATE UNIQUE INDEX"));

		expect(createIndexStatements).toHaveLength(2);
		for (const statement of createIndexStatements) {
			expect(statement).toMatch(OPEN_PREDICATE);
			// A cast in an index predicate fails: the enum-to-text function is not IMMUTABLE.
			expect(statement).not.toContain("::text");
		}
	});

	it("uses the same predicate for both schema indexes", async () => {
		const schema = await readFile(schemaUrl, "utf8");

		expect(schema.match(OPEN_PREDICATE)).toHaveLength(2);
	});
});
