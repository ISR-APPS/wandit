import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
	"../../../../../packages/db/src/migrations/0031_sour_siren.sql",
	import.meta.url,
);

describe("Academy migration", () => {
	it("creates the guide table, publication index, and restrictive author FK", async () => {
		const migration = await readFile(migrationUrl, "utf8");

		expect(migration).toContain('CREATE TABLE "academy_guides"');
		expect(migration).toContain(
			'FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict',
		);
		expect(migration).toContain(
			'CREATE INDEX "academy_guides_status_publishedAt_idx" ON "academy_guides" USING btree ("status","published_at")',
		);
	});
});
