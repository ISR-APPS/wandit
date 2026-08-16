import { productEvents } from "@wandit/db/schema/product-events";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type InsertProductEvent,
	ProductEventsRepository,
} from "./product-events.repository";

const INPUT = {
	idempotencyKey: "11111111-1111-4111-8111-111111111111",
	kind: "upgrade_clicked",
	surface: "sidebar",
	userId: "user_1",
} satisfies InsertProductEvent;

function setup() {
	const onConflictDoNothing = vi.fn(async () => undefined);
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	const repository = new ProductEventsRepository({
		insert,
	} as unknown as Database);

	return { insert, onConflictDoNothing, repository, values };
}

describe("ProductEventsRepository", () => {
	it("inserts an event and ignores an idempotency-key conflict", async () => {
		const { insert, onConflictDoNothing, repository, values } = setup();

		await expect(repository.insert(INPUT)).resolves.toBeUndefined();

		expect(insert).toHaveBeenCalledWith(productEvents);
		expect(values).toHaveBeenCalledWith(INPUT);
		expect(onConflictDoNothing).toHaveBeenCalledWith({
			target: productEvents.idempotencyKey,
		});
	});
});
