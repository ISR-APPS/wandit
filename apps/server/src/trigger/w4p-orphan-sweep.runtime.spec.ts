import { describe, expect, it } from "vitest";

import { FakeWorkersForPlatformsClient } from "../modules/app-builder/infrastructure/cloudflare/fake-workers-for-platforms.client";
import {
	runW4pOrphanSweep,
	W4P_ORPHAN_SWEEP_MAX_DELETES,
} from "./w4p-orphan-sweep.runtime";

const LIVE = "2b8e1d7c-4f7a-4a51-9f4e-0f7d6c1b2a3e";
const GONE = "9c1f0e2d-3b4a-4c5d-8e6f-7a8b9c0d1e2f";
const SOFT_DELETED = "4d5e6f70-8192-4a3b-9c4d-5e6f7a8b9c0d";

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

// A liveness lookup that answers `live` and records every id list it got.
function fakeProjects(live: string[]) {
	const asked: string[][] = [];
	return {
		asked,
		projects: {
			listLiveIds: async (projectIds: string[]) => {
				asked.push(projectIds);
				return new Set(projectIds.filter((id) => live.includes(id)));
			},
		},
	};
}

function seedAppWorker(
	workers: FakeWorkersForPlatformsClient,
	projectId: string,
): void {
	workers.seed(`app-${projectId}`, [`project:${projectId}`, "customer:org-1"]);
}

// A distinct valid uuid per index, for the cap case.
function uuidAt(index: number): string {
	return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

describe("runW4pOrphanSweep", () => {
	it("deletes the Workers of gone and soft-deleted projects and keeps the live one", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		seedAppWorker(workers, LIVE);
		seedAppWorker(workers, GONE);
		seedAppWorker(workers, SOFT_DELETED);
		const { projects } = fakeProjects([LIVE]);
		const { lines, logger } = makeLogger();

		const result = await runW4pOrphanSweep({
			environmentType: "PRODUCTION",
			logger,
			projects,
			workers,
		});

		expect(result).toEqual({
			deleted: 2,
			failed: 0,
			ignored: 0,
			missing: 0,
			orphans: 2,
			scanned: 3,
			skipped: null,
		});
		expect([...workers.scripts.keys()]).toEqual([`app-${LIVE}`]);
		expect(
			lines.filter((line) => line.message === "w4p.orphan-sweep.deleted"),
		).toEqual([
			{
				fields: {
					outcome: "deleted",
					projectId: GONE,
					scriptName: `app-${GONE}`,
				},
				level: "info",
				message: "w4p.orphan-sweep.deleted",
			},
			{
				fields: {
					outcome: "deleted",
					projectId: SOFT_DELETED,
					scriptName: `app-${SOFT_DELETED}`,
				},
				level: "info",
				message: "w4p.orphan-sweep.deleted",
			},
		]);
	});

	it("ignores a script it cannot tie to one project", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		workers.seed("someone-elses-worker", ["customer:org-1"]);
		workers.seed("app-not-a-uuid", ["project:not-a-uuid"]);
		workers.seed(`app-${LIVE}`, [`project:${GONE}`]);
		const { asked, projects } = fakeProjects([]);
		const { logger } = makeLogger();

		const result = await runW4pOrphanSweep({
			environmentType: "PRODUCTION",
			logger,
			projects,
			workers,
		});

		expect(result.ignored).toBe(3);
		expect(result.orphans).toBe(0);
		expect(asked).toEqual([[]]);
		expect(workers.scripts.size).toBe(3);
		expect(workers.calls.map((call) => call.method)).toEqual(["listScripts"]);
	});

	it("deletes at most the cap per run and logs what is left", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		for (let index = 0; index < W4P_ORPHAN_SWEEP_MAX_DELETES + 5; index += 1) {
			seedAppWorker(workers, uuidAt(index));
		}
		const { projects } = fakeProjects([]);
		const { lines, logger } = makeLogger();

		const result = await runW4pOrphanSweep({
			environmentType: "PRODUCTION",
			logger,
			projects,
			workers,
		});

		expect(result.orphans).toBe(W4P_ORPHAN_SWEEP_MAX_DELETES + 5);
		expect(result.deleted).toBe(W4P_ORPHAN_SWEEP_MAX_DELETES);
		expect(workers.scripts.size).toBe(5);
		expect(
			lines.filter((line) => line.message === "w4p.orphan-sweep.capped"),
		).toEqual([
			{
				fields: { left: "5" },
				level: "warn",
				message: "w4p.orphan-sweep.capped",
			},
		]);
	});

	it("logs a failed delete and deletes the other orphans", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		seedAppWorker(workers, GONE);
		seedAppWorker(workers, SOFT_DELETED);
		workers.failNext("deleteScript", new Error("cloudflare down"));
		const { projects } = fakeProjects([]);
		const { lines, logger } = makeLogger();

		const result = await runW4pOrphanSweep({
			environmentType: "PRODUCTION",
			logger,
			projects,
			workers,
		});

		expect(result.failed).toBe(1);
		expect(result.deleted).toBe(1);
		expect(workers.scripts.has(`app-${SOFT_DELETED}`)).toBe(false);
		expect(lines).toContainEqual({
			fields: {
				error: "cloudflare down",
				projectId: GONE,
				scriptName: `app-${GONE}`,
			},
			level: "warn",
			message: "w4p.orphan-sweep.delete-failed",
		});
	});

	it("does nothing without the Cloudflare env values", async () => {
		const { asked, projects } = fakeProjects([]);
		const { lines, logger } = makeLogger();

		const result = await runW4pOrphanSweep({
			environmentType: "STAGING",
			logger,
			projects,
			workers: null,
		});

		expect(result.skipped).toBe("unconfigured");
		expect(asked).toEqual([]);
		expect(lines.map((line) => line.message)).toEqual([
			"w4p.orphan-sweep.unconfigured",
		]);
	});

	it("does nothing in a dev environment, even with the Cloudflare values", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		seedAppWorker(workers, GONE);
		const { asked, projects } = fakeProjects([]);
		const { lines, logger } = makeLogger();

		const result = await runW4pOrphanSweep({
			environmentType: "DEVELOPMENT",
			logger,
			projects,
			workers,
		});

		expect(result.skipped).toBe("environment");
		expect(workers.calls).toEqual([]);
		expect(asked).toEqual([]);
		expect(lines).toEqual([
			{
				fields: { environmentType: "DEVELOPMENT" },
				level: "info",
				message: "w4p.orphan-sweep.environment-skipped",
			},
		]);
	});

	it("rejects the run and deletes nothing when the liveness read fails", async () => {
		const workers = new FakeWorkersForPlatformsClient();
		seedAppWorker(workers, GONE);
		const { logger } = makeLogger();

		await expect(
			runW4pOrphanSweep({
				environmentType: "PRODUCTION",
				logger,
				projects: {
					listLiveIds: async () => {
						throw new Error("db down");
					},
				},
				workers,
			}),
		).rejects.toThrow("db down");
		expect(workers.scripts.has(`app-${GONE}`)).toBe(true);
	});
});
