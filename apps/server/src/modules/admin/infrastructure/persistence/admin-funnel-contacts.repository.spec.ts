import { adminFunnelContacts } from "@wandit/db/schema/admin-funnel-contacts";
import { user } from "@wandit/db/schema/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminFunnelContactsRepository } from "./admin-funnel-contacts.repository";

const NOW = new Date("2026-08-13T10:20:30.000Z");

function setup(
	rows: Array<{
		contactedAt: Date;
		contactedByName: string;
		contactedByUserId: string;
	}> = [],
) {
	const onConflictDoUpdate = vi.fn(async () => undefined);
	const values = vi.fn(() => ({ onConflictDoUpdate }));
	const insert = vi.fn(() => ({ values }));
	const deleteWhere = vi.fn(async () => undefined);
	const deleteRecord = vi.fn(() => ({ where: deleteWhere }));
	const limit = vi.fn(async () => rows);
	const selectWhere = vi.fn(() => ({ limit }));
	const innerJoin = vi.fn(() => ({ where: selectWhere }));
	const from = vi.fn(() => ({ innerJoin }));
	const select = vi.fn(() => ({ from }));
	const repository = new AdminFunnelContactsRepository({
		delete: deleteRecord,
		insert,
		select,
	} as unknown as Database);

	return {
		deleteRecord,
		deleteWhere,
		from,
		innerJoin,
		insert,
		limit,
		onConflictDoUpdate,
		repository,
		select,
		selectWhere,
		values,
	};
}

describe("AdminFunnelContactsRepository", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("upserts contacted state per target user", async () => {
		const { insert, onConflictDoUpdate, repository, values } = setup();

		await expect(repository.set("user_1", "admin_1")).resolves.toBeUndefined();

		expect(insert).toHaveBeenCalledWith(adminFunnelContacts);
		expect(values).toHaveBeenCalledWith({
			userId: "user_1",
			contactedByUserId: "admin_1",
			contactedAt: NOW,
		});
		expect(onConflictDoUpdate).toHaveBeenCalledWith({
			target: adminFunnelContacts.userId,
			set: {
				contactedByUserId: "admin_1",
				contactedAt: NOW,
				updatedAt: NOW,
			},
		});
	});

	it("clears contacted state by target user", async () => {
		const { deleteRecord, deleteWhere, repository } = setup();

		await expect(repository.clear("user_1")).resolves.toBeUndefined();

		expect(deleteRecord).toHaveBeenCalledWith(adminFunnelContacts);
		expect(deleteWhere).toHaveBeenCalledOnce();
	});

	it("loads contact metadata with the acting admin identity", async () => {
		const { from, innerJoin, limit, repository, select } = setup([
			{
				contactedAt: NOW,
				contactedByUserId: "admin_1",
				contactedByName: "Grace Hopper",
			},
		]);

		await expect(repository.get("user_1")).resolves.toEqual({
			contactedAt: NOW,
			contactedBy: { id: "admin_1", name: "Grace Hopper" },
		});
		expect(select).toHaveBeenCalledWith({
			contactedAt: adminFunnelContacts.contactedAt,
			contactedByUserId: user.id,
			contactedByName: user.name,
		});
		expect(from).toHaveBeenCalledWith(adminFunnelContacts);
		expect(innerJoin).toHaveBeenCalledWith(user, expect.anything());
		expect(limit).toHaveBeenCalledWith(1);
	});
});
