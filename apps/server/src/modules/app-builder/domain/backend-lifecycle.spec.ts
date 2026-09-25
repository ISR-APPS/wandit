import { describe, expect, it } from "vitest";

import {
	assertBackendEntitlement,
	BACKEND_DEFAULTS,
	type BackendLifecycleFacts,
	type BackendLifecycleWindows,
	isProjectComingUp,
	selectBackendsToDelete,
	selectBackendsToPause,
	selectOrphanedBackends,
} from "./backend-lifecycle";

const NOW = new Date("2026-09-25T03:00:00.000Z");
const DAY_MS = 86_400_000;
const WINDOWS: BackendLifecycleWindows = {
	deleteGraceDays: 7,
	idleDays: 7,
	publishedIdleDays: 30,
};

function daysAgo(days: number): Date {
	return new Date(NOW.getTime() - days * DAY_MS);
}

type Row = BackendLifecycleFacts & { id: string };

function row(overrides: Partial<Row> = {}): Row {
	return {
		createdAt: daysAgo(100),
		deletingAt: null,
		id: "backend-1",
		lastActiveAt: daysAgo(1),
		projectDeletedAt: null,
		published: false,
		status: "active",
		...overrides,
	};
}

describe("selectBackendsToPause", () => {
	it("pauses an unpublished row idle for more than the idle window", () => {
		const idle = row({ id: "idle", lastActiveAt: daysAgo(8) });
		const recent = row({ id: "recent", lastActiveAt: daysAgo(2) });

		expect(selectBackendsToPause([idle, recent], NOW, WINDOWS)).toEqual([idle]);
	});

	it("gives a published row the longer window", () => {
		const publishedTenDays = row({
			id: "published-10",
			lastActiveAt: daysAgo(10),
			published: true,
		});
		const publishedThirtyOneDays = row({
			id: "published-31",
			lastActiveAt: daysAgo(31),
			published: true,
		});

		expect(
			selectBackendsToPause(
				[publishedTenDays, publishedThirtyOneDays],
				NOW,
				WINDOWS,
			),
		).toEqual([publishedThirtyOneDays]);
	});

	it("counts from createdAt when the row has no activity stamp", () => {
		const oldNeverTouched = row({
			createdAt: daysAgo(8),
			id: "old",
			lastActiveAt: null,
		});
		const newNeverTouched = row({
			createdAt: daysAgo(1),
			id: "new",
			lastActiveAt: null,
		});

		expect(
			selectBackendsToPause([oldNeverTouched, newNeverTouched], NOW, WINDOWS),
		).toEqual([oldNeverTouched]);
	});

	it("keeps a row exactly on the window", () => {
		const boundary = row({ lastActiveAt: daysAgo(7) });

		expect(selectBackendsToPause([boundary], NOW, WINDOWS)).toEqual([]);
	});

	it("never pauses a row that is not active", () => {
		const rows = (
			["creating", "paused", "restoring", "deleting", "error"] as const
		).map((status) => row({ id: status, lastActiveAt: daysAgo(90), status }));

		expect(selectBackendsToPause(rows, NOW, WINDOWS)).toEqual([]);
	});

	it("leaves the idle row of a deleted project to the orphan rule", () => {
		const deletedProject = row({
			lastActiveAt: daysAgo(30),
			projectDeletedAt: daysAgo(2),
		});

		expect(selectBackendsToPause([deletedProject], NOW, WINDOWS)).toEqual([]);
	});

	it("pauses every active row when the idle window is 0 days", () => {
		const justUsed = row({ lastActiveAt: new Date(NOW.getTime() - 1) });

		expect(
			selectBackendsToPause([justUsed], NOW, { ...WINDOWS, idleDays: 0 }),
		).toEqual([justUsed]);
	});
});

describe("selectBackendsToDelete", () => {
	it("deletes a deleting row after the grace window", () => {
		const expired = row({
			deletingAt: daysAgo(8),
			id: "expired",
			status: "deleting",
		});
		const inGrace = row({
			deletingAt: daysAgo(3),
			id: "in-grace",
			status: "deleting",
		});

		expect(selectBackendsToDelete([expired, inGrace], NOW, WINDOWS)).toEqual([
			expired,
		]);
	});

	it("keeps a row exactly on the grace window", () => {
		const boundary = row({ deletingAt: daysAgo(7), status: "deleting" });

		expect(selectBackendsToDelete([boundary], NOW, WINDOWS)).toEqual([]);
	});

	it("ignores a row that is not deleting or has no deletingAt", () => {
		const active = row({ deletingAt: daysAgo(30), status: "active" });
		const noStamp = row({ deletingAt: null, status: "deleting" });

		expect(selectBackendsToDelete([active, noStamp], NOW, WINDOWS)).toEqual([]);
	});
});

describe("selectOrphanedBackends", () => {
	it("picks a non-deleting row of a project deleted more than a day ago", () => {
		const orphans = (["active", "paused", "restoring", "error"] as const).map(
			(status) => row({ id: status, projectDeletedAt: daysAgo(2), status }),
		);

		expect(selectOrphanedBackends(orphans, NOW)).toEqual(orphans);
	});

	it("waits one day for the delete step of a fresh delete", () => {
		const fresh = row({
			projectDeletedAt: new Date(NOW.getTime() - 3_600_000),
		});

		expect(selectOrphanedBackends([fresh], NOW)).toEqual([]);
	});

	it("ignores a deleting row and a row of a live project", () => {
		const deleting = row({ projectDeletedAt: daysAgo(9), status: "deleting" });
		const live = row({ projectDeletedAt: null });

		expect(selectOrphanedBackends([deleting, live], NOW)).toEqual([]);
	});
});

describe("isProjectComingUp", () => {
	it("answers true for a running or starting project and false otherwise", () => {
		expect(
			(["ACTIVE_HEALTHY", "COMING_UP", "RESTORING"] as const).map(
				isProjectComingUp,
			),
		).toEqual([true, true, true]);
		expect(
			(["INACTIVE", "PAUSING", "RESTORE_FAILED", "REMOVED"] as const).map(
				isProjectComingUp,
			),
		).toEqual([false, false, false, false]);
	});
});

describe("assertBackendEntitlement", () => {
	it("allows a backend under the plan limit", () => {
		expect(assertBackendEntitlement("business", 2)).toEqual({
			allowed: true,
		});
	});

	it("refuses at the limit with backend_limit_reached", () => {
		expect(assertBackendEntitlement("pro", 1)).toEqual({
			allowed: false,
			code: "backend_limit_reached",
			limit: BACKEND_DEFAULTS.backendsPerPlan.pro,
			plan: "pro",
		});
	});

	it("gives starter and business different answers for the same count", () => {
		expect(assertBackendEntitlement("starter", 0)).toEqual({
			allowed: false,
			code: "backend_limit_reached",
			limit: 0,
			plan: "starter",
		});
		expect(assertBackendEntitlement("business", 0)).toEqual({
			allowed: true,
		});
	});
});
