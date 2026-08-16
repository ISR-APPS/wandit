import type { CreateProductEventRequest } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ProductEventsRepository } from "../../infrastructure/persistence/product-events.repository";
import { ProductEventsService } from "./product-events.service";

const INPUT = {
	idempotencyKey: "11111111-1111-4111-8111-111111111111",
	kind: "pricing_viewed",
	surface: "marketing_pricing",
} satisfies CreateProductEventRequest;

describe("ProductEventsService", () => {
	it("binds the validated event to the acting user", async () => {
		const repository = {
			insert: vi.fn(async () => undefined),
		};
		const service = new ProductEventsService(
			repository as unknown as ProductEventsRepository,
		);

		await expect(service.create("user_1", INPUT)).resolves.toBeUndefined();

		expect(repository.insert).toHaveBeenCalledWith({
			...INPUT,
			userId: "user_1",
		});
	});
});
