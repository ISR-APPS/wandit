import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
	"../../../../../packages/db/src/migrations/0064_admin-view-grants.sql",
	import.meta.url,
);

describe("admin view grants migration", () => {
	it("creates the grants table and both user foreign keys", async () => {
		const migration = await readFile(migrationUrl, "utf8");

		expect(migration).toContain('CREATE TABLE "admin_view_grants"');
		expect(migration).toContain(
			'FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade',
		);
		expect(migration).toContain(
			'FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null',
		);
	});
});
