import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { ProductEventsService } from "./application/services/product-events.service";
import { ProductEventsRepository } from "./infrastructure/persistence/product-events.repository";
import { ProductEventsController } from "./presentation/http/controllers/product-events.controller";

@Module({
	controllers: [ProductEventsController],
	imports: [DatabaseModule],
	providers: [ProductEventsRepository, ProductEventsService],
})
export class ProductEventsModule {}
