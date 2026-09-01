import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { AdminSecurityModule } from "./admin-security.module";
import { AdminViewGrantsRepository } from "./infrastructure/persistence/admin-view-grants.repository";
import { AdminGuard } from "./presentation/http/guards/admin.guard";

describe("AdminSecurityModule", () => {
	it("makes the database-backed guard and grants repository available to consumers", () => {
		expect(
			Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminSecurityModule),
		).toEqual([DatabaseModule]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AdminSecurityModule),
		).toEqual([AdminGuard, AdminViewGrantsRepository]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.EXPORTS, AdminSecurityModule),
		).toEqual([AdminGuard, AdminViewGrantsRepository]);
	});
});
