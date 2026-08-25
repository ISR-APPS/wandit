import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CreateProductEventRequest } from "@wandit/contracts";

import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { ProductEventsRepository } from "../../infrastructure/persistence/product-events.repository";

@Injectable()
export class ProductEventsService {
	private readonly logger = new Logger(ProductEventsService.name);

	constructor(
		@Inject(ProductEventsRepository)
		private readonly repository: ProductEventsRepository,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEvents: LifecycleEventsService,
	) {}

	async create(
		userId: string,
		input: CreateProductEventRequest,
	): Promise<void> {
		await this.repository.insert({
			...input,
			properties: input.properties ?? {},
			userId,
		});

		try {
			if (input.kind === "pricing_viewed") {
				await this.lifecycleEvents.enqueue({
					event: "pricing_viewed",
					idempotencyKey: `product:${input.idempotencyKey}`,
					userId,
				});
				return;
			}

			const method = input.properties?.method;
			if (!method) {
				return;
			}

			await this.lifecycleEvents.enqueue({
				event: "upgrade_clicked",
				idempotencyKey: `product:${input.idempotencyKey}`,
				payload: { method, surface: input.surface },
				userId,
			});
		} catch (error) {
			this.logger.warn(
				`Lifecycle bridge failed for product event ${input.idempotencyKey}`,
				error,
			);
		}
	}
}
