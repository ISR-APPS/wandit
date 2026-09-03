import { Logger } from "@nestjs/common";
import type { CreateProductEventRequest } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import type { ProductEventsRepository } from "../../infrastructure/persistence/product-events.repository";
import { ProductEventsService } from "./product-events.service";

const INPUT = {
	idempotencyKey: "11111111-1111-4111-8111-111111111111",
	kind: "pricing_viewed",
	surface: "marketing_pricing",
} satisfies CreateProductEventRequest;

afterEach(() => {
	vi.restoreAllMocks();
});

function setup(inserted = true) {
	const repository = {
		insert: vi.fn(async () => inserted),
	};
	const lifecycleEvents = {
		enqueue: vi.fn(async () => null),
	};
	const service = new ProductEventsService(
		repository as unknown as ProductEventsRepository,
		lifecycleEvents as unknown as LifecycleEventsService,
	);

	return { lifecycleEvents, repository, service };
}

describe("ProductEventsService", () => {
	it("persists an accepted event and bridges pricing_viewed to lifecycle", async () => {
		const { lifecycleEvents, repository, service } = setup();

		await expect(service.create("user_1", INPUT)).resolves.toBeUndefined();

		expect(repository.insert).toHaveBeenCalledWith({
			...INPUT,
			properties: {},
			userId: "user_1",
		});
		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "pricing_viewed",
			idempotencyKey: `product:${INPUT.idempotencyKey}`,
			userId: "user_1",
		});
	});

	it("bridges upgrade_clicked with its method and surface", async () => {
		const { lifecycleEvents, service } = setup();
		const input = {
			idempotencyKey: "22222222-2222-4222-8222-222222222222",
			kind: "upgrade_clicked",
			properties: { method: "offline" },
			surface: "plan_picker",
		} satisfies CreateProductEventRequest;

		await expect(service.create("user_2", input)).resolves.toBeUndefined();

		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "upgrade_clicked",
			idempotencyKey: `product:${input.idempotencyKey}`,
			payload: { method: "offline", surface: "plan_picker" },
			userId: "user_2",
		});
	});

	it("retries lifecycle capture for an idempotent product-event replay", async () => {
		const { lifecycleEvents, service } = setup(false);

		await expect(service.create("user_1", INPUT)).resolves.toBeUndefined();

		expect(lifecycleEvents.enqueue).toHaveBeenCalledWith({
			event: "pricing_viewed",
			idempotencyKey: `product:${INPUT.idempotencyKey}`,
			userId: "user_1",
		});
	});

	it("keeps lifecycle capture best-effort for an accepted product event", async () => {
		const { lifecycleEvents, service } = setup();
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => {});
		lifecycleEvents.enqueue.mockRejectedValueOnce(
			new Error("database offline"),
		);

		await expect(service.create("user_1", INPUT)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(
			`Lifecycle bridge failed for product event ${INPUT.idempotencyKey}`,
			expect.any(Error),
		);
	});
});
