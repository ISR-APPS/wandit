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
	properties: { method: "card" },
	surface: "sidebar",
	userId: "user_1",
} satisfies InsertProductEvent;

function setup(returningRows: { id: string }[] = [{ id: "event_1" }]) {
	const returning = vi.fn(async () => returningRows);
	const onConflictDoNothing = vi.fn(() => ({ returning }));
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	const repository = new ProductEventsRepository({
		insert,
	} as unknown as Database);

	return { insert, onConflictDoNothing, repository, returning, values };
}

describe("ProductEventsRepository", () => {
	it("inserts properties and reports a newly accepted event", async () => {
		const { insert, onConflictDoNothing, repository, returning, values } =
			setup();

		await expect(repository.insert(INPUT)).resolves.toBe(true);

		expect(insert).toHaveBeenCalledWith(productEvents);
		expect(values).toHaveBeenCalledWith(INPUT);
		expect(onConflictDoNothing).toHaveBeenCalledWith({
			target: productEvents.idempotencyKey,
		});
		expect(returning).toHaveBeenCalledWith({ id: productEvents.id });
	});

	it("reports an idempotency-key replay", async () => {
		const { repository } = setup([]);

		await expect(repository.insert(INPUT)).resolves.toBe(false);
	});
});
