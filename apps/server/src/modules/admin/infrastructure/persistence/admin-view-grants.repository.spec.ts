import { adminViewGrants } from "@wandit/db/schema/admin-view-grants";
import { user } from "@wandit/db/schema/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminViewGrantsRepository } from "./admin-view-grants.repository";

const NOW = new Date("2026-09-01T10:20:30.000Z");

function setup(
	rows: Array<
		{ role: string; views: string[] | null } | { views: string[] }
	> = [],
) {
	const onConflictDoUpdate = vi.fn(async () => undefined);
	const values = vi.fn(() => ({ onConflictDoUpdate }));
	const insert = vi.fn(() => ({ values }));
	const deleteWhere = vi.fn(async () => undefined);
	const deleteRecord = vi.fn(() => ({ where: deleteWhere }));
	const limit = vi.fn(async () => rows);
	const selectWhere = vi.fn(() => ({ limit }));
	const leftJoin = vi.fn(() => ({ where: selectWhere }));
	const from = vi.fn(() => ({ leftJoin, where: selectWhere }));
	const select = vi.fn(() => ({ from }));
	const repository = new AdminViewGrantsRepository({
		delete: deleteRecord,
		insert,
		select,
	} as unknown as Database);

	return {
		deleteRecord,
		deleteWhere,
		from,
		insert,
		leftJoin,
		limit,
		onConflictDoUpdate,
		repository,
		select,
		selectWhere,
		values,
	};
}

describe("AdminViewGrantsRepository", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("loads the user's role and optional grants in one left-joined query", async () => {
		const { from, leftJoin, repository, select } = setup([
			{ role: "support", views: ["academy"] },
		]);

		await expect(repository.findSupportAccess("user-1")).resolves.toEqual({
			role: "support",
			views: ["academy"],
		});
		expect(select).toHaveBeenCalledWith({
			role: user.role,
			views: adminViewGrants.views,
		});
		expect(select).toHaveBeenCalledOnce();
		expect(from).toHaveBeenCalledWith(user);
		expect(leftJoin).toHaveBeenCalledWith(adminViewGrants, expect.anything());
	});

	it("keeps a null grants row distinct from a missing user", async () => {
		const existingUser = setup([{ role: "support", views: null }]);
		const missingUser = setup();

		await expect(
			existingUser.repository.findSupportAccess("user-1"),
		).resolves.toEqual({ role: "support", views: null });
		await expect(
			missingUser.repository.findSupportAccess("user-1"),
		).resolves.toBeNull();
	});

	it("loads the stored view array for a user", async () => {
		const { from, limit, repository, select } = setup([
			{ views: ["overview", "users"] },
		]);

		await expect(repository.findViews("user-1")).resolves.toEqual([
			"overview",
			"users",
		]);
		expect(select).toHaveBeenCalledWith({ views: adminViewGrants.views });
		expect(from).toHaveBeenCalledWith(adminViewGrants);
		expect(limit).toHaveBeenCalledWith(1);
	});

	it("returns null when the user has no grants row", async () => {
		const { repository } = setup();

		await expect(repository.findViews("user-1")).resolves.toBeNull();
	});

	it("upserts de-duplicated views and actor attribution on the user primary key", async () => {
		const { insert, onConflictDoUpdate, repository, values } = setup();

		await expect(
			repository.upsertViews(
				"user-1",
				["overview", "feedback", "overview"],
				"admin-1",
			),
		).resolves.toBeUndefined();

		expect(insert).toHaveBeenCalledWith(adminViewGrants);
		expect(values).toHaveBeenCalledWith({
			updatedByUserId: "admin-1",
			userId: "user-1",
			views: ["overview", "feedback"],
		});
		expect(onConflictDoUpdate).toHaveBeenCalledWith({
			target: adminViewGrants.userId,
			set: {
				updatedAt: NOW,
				updatedByUserId: "admin-1",
				views: ["overview", "feedback"],
			},
		});
	});

	it("rejects an empty grants array before attempting an insert", async () => {
		const { insert, repository } = setup();

		await expect(
			repository.upsertViews("user-1", [], "admin-1"),
		).rejects.toThrow("admin view grants must contain at least one view");
		expect(insert).not.toHaveBeenCalled();
	});

	it("deletes a user's grants row", async () => {
		const { deleteRecord, deleteWhere, repository } = setup();

		await expect(repository.deleteViews("user-1")).resolves.toBeUndefined();

		expect(deleteRecord).toHaveBeenCalledWith(adminViewGrants);
		expect(deleteWhere).toHaveBeenCalledOnce();
	});
});
