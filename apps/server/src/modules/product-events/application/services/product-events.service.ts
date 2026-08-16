import { Inject, Injectable } from "@nestjs/common";
import type { CreateProductEventRequest } from "@wandit/contracts";

import { ProductEventsRepository } from "../../infrastructure/persistence/product-events.repository";

@Injectable()
export class ProductEventsService {
	constructor(
		@Inject(ProductEventsRepository)
		private readonly repository: ProductEventsRepository,
	) {}

	async create(
		userId: string,
		input: CreateProductEventRequest,
	): Promise<void> {
		await this.repository.insert({
			...input,
			userId,
		});
	}
}
