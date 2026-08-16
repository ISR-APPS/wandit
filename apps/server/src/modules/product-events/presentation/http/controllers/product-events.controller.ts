import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateProductEventRequest,
	createProductEventRequestSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { ProductEventsService } from "../../../application/services/product-events.service";

@Controller("v1/product-events")
export class ProductEventsController {
	constructor(
		@Inject(ProductEventsService)
		private readonly service: ProductEventsService,
	) {}

	@Post()
	@HttpCode(204)
	create(
		@CurrentUser() user: AuthUser,
		@Body(new ZodValidationPipe(createProductEventRequestSchema))
		body: CreateProductEventRequest,
	): Promise<void> {
		return this.service.create(user.id, body);
	}
}
