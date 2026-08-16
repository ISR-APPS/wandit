import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { ProductEventsService } from "./application/services/product-events.service";
import { ProductEventsRepository } from "./infrastructure/persistence/product-events.repository";
import { ProductEventsController } from "./presentation/http/controllers/product-events.controller";
import { ProductEventsModule } from "./product-events.module";

describe("ProductEventsModule", () => {
	it("wires the controller, service, repository, and database module", () => {
		expect(
			Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, ProductEventsModule),
		).toEqual([ProductEventsController]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.IMPORTS, ProductEventsModule),
		).toEqual([DatabaseModule]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ProductEventsModule),
		).toEqual([ProductEventsRepository, ProductEventsService]);
	});
});
