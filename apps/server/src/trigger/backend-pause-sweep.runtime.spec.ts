import type { SupabaseProjectStatus } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { BACKEND_DEFAULTS } from "../modules/app-builder/domain/backend-lifecycle";
import type { BackendLifecycleRow } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type { AuditEventInput } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import type { BackendRef } from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import {
	type BackendPauseSweepDeps,
	runBackendPauseSweep,
} from "./backend-pause-sweep.runtime";

const NOW = new Date("2026-09-25T03:00:00.000Z");
const DAY_MS = 86_400_000;
const WINDOWS = { deleteGraceDays: 7, idleDays: 7, publishedIdleDays: 30 };

function daysAgo(days: number): Date {
	return new Date(NOW.getTime() - days * DAY_MS);
}

function makeLogger() {
	const lines: {
		fields: Record<string, string>;
		level: string;
		message: string;
	}[] = [];
	return {
		lines,
		logger: {
			error(message: string, fields: Record<string, string>) {
				lines.push({ fields, level: "error", message });
			},
			info(message: string, fields: Record<string, string>) {
				lines.push({ fields, level: "info", message });
			},
			warn(message: string, fields: Record<string, string>) {
				lines.push({ fields, level: "warn", message });
			},
		},
	};
}

function row(
	index: number,
	overrides: Partial<BackendLifecycleRow> = {},
): BackendLifecycleRow {
	return {
		createdAt: daysAgo(60),
		deletingAt: null,
		id: `backend-${index}`,
		lastActiveAt: daysAgo(8),
		organizationId: null,
		projectDeletedAt: null,
		projectId: `project-${index}`,
		published: false,
		ref: `ref-${index}`,
		status: "active",
		...overrides,
	};
}

// A scripted Management API client: records each call. `fail` names the
// refs whose call of that kind throws; `statuses` holds the status reads.
function fakeClient(options: {
	fail: { delete: string[]; get: string[]; pause: string[] };
	statuses: Map<string, SupabaseProjectStatus>;
}) {
	const calls: { method: "delete" | "get" | "pause"; ref: string }[] = [];
	const call = async (
		method: "delete" | "get" | "pause",
		scope: BackendRef,
	) => {
		calls.push({ method, ref: scope.ref });
		if (options.fail[method].includes(scope.ref)) {
			throw new Error("supabase down");
		}
	};
	return {
		calls,
		client: {
			deleteProject: (scope: BackendRef) => call("delete", scope),
			getProject: async (scope: BackendRef) => {
				await call("get", scope);
				return {
					dbHost: "db.test.supabase.co",
					status: options.statuses.get(scope.ref) ?? "ACTIVE_HEALTHY",
				};
			},
			pauseProject: (scope: BackendRef) => call("pause", scope),
		},
	};
}

function setup(
	rows: BackendLifecycleRow[],
	options: {
		environmentType?: string;
		failDelete?: string[];
		failGet?: string[];
		failPause?: string[];
		statuses?: [string, SupabaseProjectStatus][];
	} = {},
) {
	const { calls, client } = fakeClient({
		fail: {
			delete: options.failDelete ?? [],
			get: options.failGet ?? [],
			pause: options.failPause ?? [],
		},
		statuses: new Map(options.statuses),
	});
	const { lines, logger } = makeLogger();
	const audits: AuditEventInput[] = [];
	/** Row writes, as `<method>:<projectId>`, in call order. */
	const writes: string[] = [];
	const secretsDeleted: string[] = [];
	const listCutoffs: Date[] = [];
	const write = async (method: string, projectId: string) => {
		writes.push(`${method}:${projectId}`);
		return true;
	};
	const deps: BackendPauseSweepDeps = {
		auditEvents: {
			insert: async (input) => {
				audits.push(input);
			},
		},
		backends: {
			listLifecycleCandidates: async (idleBefore) => {
				listCutoffs.push(idleBefore);
				return rows;
			},
			markDeleted: (projectId) => write("markDeleted", projectId),
			markDeleting: (projectId) => write("markDeleting", projectId),
			markPaused: (projectId) => write("markPaused", projectId),
			markRestoreFailed: (projectId) => write("markRestoreFailed", projectId),
			markRestored: (projectId) => write("markRestored", projectId),
		},
		client,
		environmentType: options.environmentType ?? "PRODUCTION",
		logger,
		now: () => NOW,
		projectSecrets: {
			deleteAllForProject: async (projectId) => {
				secretsDeleted.push(projectId);
				return 1;
			},
		},
		windows: WINDOWS,
	};
	return { audits, calls, deps, lines, listCutoffs, secretsDeleted, writes };
}

function messages(lines: { message: string }[]): string[] {
	return lines.map((line) => line.message);
}

describe("runBackendPauseSweep", () => {
	it("pauses an idle unpublished backend and writes the audit row", async () => {
		const world = setup([row(1)]);

		const result = await runBackendPauseSweep(world.deps);

		expect(result).toEqual({
			deleteFailed: 0,
			deleted: 0,
			expired: 0,
			idle: 1,
			orphanFailed: 0,
			orphaned: 0,
			pauseFailed: 0,
			paused: 1,
			restoreCheckFailed: 0,
			restoreFailed: 0,
			restored: 0,
			scanned: 1,
			skipped: null,
		});
		expect(world.calls).toEqual([{ method: "pause", ref: "ref-1" }]);
		expect(world.writes).toEqual(["markPaused:project-1"]);
		expect(world.audits).toEqual([
			{
				action: "backend.paused",
				actorUserId: null,
				metadata: { ref: "ref-1" },
				organizationId: null,
				projectId: "project-1",
				targetId: "backend-1",
				targetType: "app_backend",
			},
		]);
		// The query cutoff is the shorter window: 7 days before the run.
		expect(world.listCutoffs).toEqual([daysAgo(7)]);
	});

	it("keeps a recently active backend", async () => {
		const world = setup([row(1, { lastActiveAt: daysAgo(2) })]);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.paused).toBe(0);
		expect(world.calls).toEqual([]);
	});

	it("gives a published backend the longer window", async () => {
		const world = setup([
			row(1, { lastActiveAt: daysAgo(10), published: true }),
			row(2, { lastActiveAt: daysAgo(31), published: true }),
		]);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.paused).toBe(1);
		expect(world.writes).toEqual(["markPaused:project-2"]);
	});

	it("pauses at most the batch cap and logs what is left", async () => {
		const cap = BACKEND_DEFAULTS.sweepBatchCap;
		const world = setup(
			Array.from({ length: cap + 3 }, (_unused, index) => row(index)),
		);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.idle).toBe(cap + 3);
		expect(result.paused).toBe(cap);
		expect(world.calls).toHaveLength(cap);
		expect(
			world.lines.filter(
				(line) => line.message === "backend.pause-sweep.capped",
			),
		).toEqual([
			{
				fields: { action: "pause", left: "3" },
				level: "warn",
				message: "backend.pause-sweep.capped",
			},
		]);
	});

	it("logs a failed pause and pauses the other backends", async () => {
		const world = setup([row(1), row(2)], { failPause: ["ref-1"] });

		const result = await runBackendPauseSweep(world.deps);

		expect(result.pauseFailed).toBe(1);
		expect(result.paused).toBe(1);
		expect(world.writes).toEqual(["markPaused:project-2"]);
		expect(world.lines).toContainEqual({
			fields: { error: "supabase down", projectId: "project-1", ref: "ref-1" },
			level: "warn",
			message: "backend.pause-sweep.pause-failed",
		});
	});

	it("marks the row paused when the pause call fails but Supabase paused the project", async () => {
		const world = setup([row(1)], {
			failPause: ["ref-1"],
			statuses: [["ref-1", "INACTIVE"]],
		});

		const result = await runBackendPauseSweep(world.deps);

		expect(result.paused).toBe(1);
		expect(result.pauseFailed).toBe(0);
		expect(world.calls).toEqual([
			{ method: "pause", ref: "ref-1" },
			{ method: "get", ref: "ref-1" },
		]);
		expect(world.writes).toEqual(["markPaused:project-1"]);
	});

	it("counts a failed pause when the status read after it fails too", async () => {
		const world = setup([row(1)], { failGet: ["ref-1"], failPause: ["ref-1"] });

		const result = await runBackendPauseSweep(world.deps);

		expect(result.pauseFailed).toBe(1);
		expect(world.writes).toEqual([]);
		expect(messages(world.lines)).toEqual(
			expect.arrayContaining([
				"backend.pause-sweep.pause-check-failed",
				"backend.pause-sweep.pause-failed",
			]),
		);
	});

	it("counts a failed pause when Supabase still runs the project", async () => {
		const world = setup([row(1)], {
			failPause: ["ref-1"],
			statuses: [["ref-1", "ACTIVE_HEALTHY"]],
		});

		const result = await runBackendPauseSweep(world.deps);

		expect(result.pauseFailed).toBe(1);
		expect(world.writes).toEqual([]);
	});

	it("counts no pause when the row left active during the call", async () => {
		const world = setup([row(1)]);
		world.deps.backends = {
			...world.deps.backends,
			markPaused: async () => false,
		};

		const result = await runBackendPauseSweep(world.deps);

		expect(result.paused).toBe(0);
		expect(world.audits).toEqual([]);
		expect(messages(world.lines)).toContain("backend.pause-sweep.row-moved");
	});

	it("deletes a deleting backend after the grace window and clears its ref", async () => {
		const world = setup([
			row(1, {
				deletingAt: daysAgo(8),
				projectDeletedAt: daysAgo(8),
				status: "deleting",
			}),
			row(2, {
				deletingAt: daysAgo(2),
				projectDeletedAt: daysAgo(2),
				status: "deleting",
			}),
		]);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.expired).toBe(1);
		expect(result.deleted).toBe(1);
		expect(result.orphaned).toBe(0);
		expect(world.calls).toEqual([{ method: "delete", ref: "ref-1" }]);
		expect(world.writes).toEqual(["markDeleted:project-1"]);
		expect(world.secretsDeleted).toEqual(["project-1"]);
		expect(world.audits.map((audit) => audit.action)).toEqual([
			"backend.deleted",
		]);
		expect(world.audits[0]?.metadata).toEqual({ ref: "ref-1" });
	});

	it("counts and audits a delete when the row moved during the call", async () => {
		const world = setup([
			row(1, { deletingAt: daysAgo(8), status: "deleting" }),
		]);
		world.deps.backends = {
			...world.deps.backends,
			markDeleted: async () => false,
		};

		const result = await runBackendPauseSweep(world.deps);

		expect(result.deleted).toBe(1);
		expect(messages(world.lines)).toContain("backend.pause-sweep.row-moved");
		expect(world.audits.map((audit) => audit.action)).toEqual([
			"backend.deleted",
		]);
	});

	it("deletes nothing at Supabase when the secrets delete fails, so the next run tries both", async () => {
		const world = setup([
			row(1, { deletingAt: daysAgo(8), status: "deleting" }),
		]);
		world.deps.projectSecrets = {
			deleteAllForProject: async () => {
				throw new Error("db down");
			},
		};

		const result = await runBackendPauseSweep(world.deps);

		expect(result.deleteFailed).toBe(1);
		expect(world.calls).toEqual([]);
		expect(world.writes).toEqual([]);
	});

	it("logs a failed delete and keeps the ref for the next run", async () => {
		const world = setup(
			[row(1, { deletingAt: daysAgo(8), status: "deleting" })],
			{ failDelete: ["ref-1"] },
		);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.deleteFailed).toBe(1);
		expect(world.writes).toEqual([]);
		expect(messages(world.lines)).toContain(
			"backend.pause-sweep.delete-failed",
		);
	});

	it("moves the backend of a project deleted days ago to deleting and pauses it", async () => {
		const world = setup([
			row(1, { lastActiveAt: daysAgo(30), projectDeletedAt: daysAgo(3) }),
			row(2, { projectDeletedAt: daysAgo(3), status: "paused" }),
		]);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.orphaned).toBe(2);
		expect(world.writes).toEqual([
			"markDeleting:project-1",
			"markDeleting:project-2",
		]);
		// Only the running project gets a pause; neither row takes the idle path.
		expect(world.calls).toEqual([{ method: "pause", ref: "ref-1" }]);
		expect(result.paused).toBe(0);
	});

	it("skips an orphaned backend that another writer moved first", async () => {
		const world = setup([row(1, { projectDeletedAt: daysAgo(3) })]);
		world.deps.backends = {
			...world.deps.backends,
			markDeleting: async () => false,
		};

		const result = await runBackendPauseSweep(world.deps);

		expect(result.orphaned).toBe(0);
		expect(world.calls).toEqual([]);
	});

	it("counts a failed orphan move and continues", async () => {
		const world = setup(
			[
				row(1, { projectDeletedAt: daysAgo(3) }),
				row(2, { projectDeletedAt: daysAgo(3) }),
			],
			{ failPause: ["ref-1"] },
		);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.orphanFailed).toBe(1);
		expect(result.orphaned).toBe(1);
		expect(messages(world.lines)).toContain(
			"backend.pause-sweep.orphan-failed",
		);
	});

	it("ends a stale restore: healthy moves to active, a failed restore to error", async () => {
		const world = setup(
			[
				row(1, { status: "restoring" }),
				row(2, { status: "restoring" }),
				row(3, { status: "restoring" }),
			],
			{
				statuses: [
					["ref-1", "ACTIVE_HEALTHY"],
					["ref-2", "RESTORE_FAILED"],
					["ref-3", "COMING_UP"],
				],
			},
		);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.restored).toBe(1);
		expect(result.restoreFailed).toBe(1);
		expect(world.writes).toEqual([
			"markRestored:project-1",
			"markRestoreFailed:project-2",
		]);
		expect(world.calls.every((call) => call.method === "get")).toBe(true);
	});

	it("counts a failed restore check and continues", async () => {
		const world = setup(
			[row(1, { status: "restoring" }), row(2, { status: "restoring" })],
			{ failGet: ["ref-1"] },
		);

		const result = await runBackendPauseSweep(world.deps);

		expect(result.restoreCheckFailed).toBe(1);
		expect(result.restored).toBe(1);
	});

	it("keeps the run going when an audit insert fails", async () => {
		const world = setup([row(1), row(2)]);
		world.deps.auditEvents = {
			insert: async () => {
				throw new Error("db down");
			},
		};

		const result = await runBackendPauseSweep(world.deps);

		expect(result.paused).toBe(2);
		expect(
			world.lines.filter(
				(line) => line.message === "backend.pause-sweep.audit-failed",
			),
		).toHaveLength(2);
	});

	it("does nothing without the Supabase platform env values", async () => {
		const world = setup([row(1)]);
		world.deps.client = null;

		const result = await runBackendPauseSweep(world.deps);

		expect(result.skipped).toBe("unconfigured");
		expect(world.listCutoffs).toEqual([]);
		expect(messages(world.lines)).toEqual(["backend.pause-sweep.unconfigured"]);
	});

	it("does nothing in a dev environment", async () => {
		const world = setup([row(1)], { environmentType: "DEVELOPMENT" });

		const result = await runBackendPauseSweep(world.deps);

		expect(result.skipped).toBe("environment");
		expect(world.listCutoffs).toEqual([]);
		expect(world.calls).toEqual([]);
	});

	it("rejects the run and calls nothing when the list read fails", async () => {
		const world = setup([]);
		world.deps.backends = {
			...world.deps.backends,
			listLifecycleCandidates: async () => {
				throw new Error("db down");
			},
		};

		await expect(runBackendPauseSweep(world.deps)).rejects.toThrow("db down");
		expect(world.calls).toEqual([]);
	});
});
