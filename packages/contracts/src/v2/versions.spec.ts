import { describe, expect, it } from "vitest";

import { listVersionsQuerySchema } from "./versions";

describe("listVersionsQuerySchema", () => {
	// Postgres rejects a non-uuid id in the cursor cast, so the route gave 500.
	it.each([
		["a valid date and a non-uuid id", "2026-01-01T00:00:00.000Z_abc"],
		["no separator", "not-a-cursor"],
		[
			"a bad date",
			"2026-13-45T00:00:00.000Z_0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10",
		],
		[
			"a third part",
			"2026-01-01T00:00:00.000Z_0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10_x",
		],
	])("refuses a cursor with %s", (_label, cursor) => {
		expect(listVersionsQuerySchema.safeParse({ cursor }).success).toBe(false);
	});

	// The repository writes `nextCursor` as `<toISOString()>_<row id>`; "Load more" sends it back.
	it("parses the cursor text the repository writes", () => {
		const createdAt = new Date("2026-01-01T00:00:00.123Z");
		const id = "0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10";

		const parsed = listVersionsQuerySchema.parse({
			cursor: `${createdAt.toISOString()}_${id}`,
		});

		expect(parsed.cursor).toEqual({ createdAt, id });
	});
});
