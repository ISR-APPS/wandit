import { describe, expect, it } from "vitest";

import { DATABASE } from "../../../../server/src/infrastructure/database/database.constants";
import { WORKER_DATABASE } from "./database.constants";
import { databaseProvider } from "./database-alias.provider";

describe("worker database alias provider", () => {
	it("aliases server DATABASE consumers to the existing worker pool", () => {
		expect(databaseProvider).toEqual({
			provide: DATABASE,
			useExisting: WORKER_DATABASE,
		});
	});
});
