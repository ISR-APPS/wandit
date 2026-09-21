import { describe, expect, it } from "vitest";

import { FakeSandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/fake-sandbox-sessions.repository";
import { FakeTurnLock } from "../modules/app-builder/infrastructure/redis/fake-turn-lock";
import { FakeSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/fake-sandbox.provider";
import {
	runSandboxIdleSweep,
	SANDBOX_IDLE_STOP_MINUTES,
} from "./sandbox-idle-sweep.runtime";

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

async function seedRunningRow(
	sessions: FakeSandboxSessionsRepository,
	projectId: string,
	lastActiveAt: Date | null,
): Promise<string> {
	const row = await sessions.insertCreating({
		organizationId: null,
		projectId,
		provider: "vercel",
		userId: "user-1",
	});
	await sessions.markRunning(row.id, {
		expiresAt: null,
		image: "registry.test/wandit/sandbox:1",
		previewHost: "preview.example.test",
		providerSandboxId: `vendor-${projectId}`,
	});
	const stored = sessions.rows.get(row.id);
	if (stored) {
		stored.lastActiveAt = lastActiveAt;
	}
	return row.id;
}

const NOW = new Date("2030-06-01T12:00:00Z");
const IDLE_AT = new Date(
	NOW.getTime() - (SANDBOX_IDLE_STOP_MINUTES + 5) * 60_000,
);

describe("runSandboxIdleSweep", () => {
	it("stops running rows idle past the threshold and marks them stopped", async () => {
		const sessions = new FakeSandboxSessionsRepository();
		const provider = new FakeSandboxProvider();
		const { lines, logger } = makeLogger();
		const idleRowId = await seedRunningRow(sessions, "proj-idle", IDLE_AT);
		const activeRowId = await seedRunningRow(
			sessions,
			"proj-active",
			new Date(NOW.getTime() - 60_000),
		);

		const result = await runSandboxIdleSweep({
			logger,
			now: () => NOW,
			provider,
			sessions,
			turnLock: new FakeTurnLock(),
		});

		expect(result).toEqual({ failed: 0, skipped: 0, stopped: 1, total: 1 });
		expect(provider.calls).toEqual([{ detail: "proj-idle", method: "stop" }]);
		expect(sessions.rows.get(idleRowId)?.status).toBe("stopped");
		expect(sessions.rows.get(idleRowId)?.lastSnapshotAt).toEqual(NOW);
		expect(sessions.rows.get(activeRowId)?.status).toBe("running");
		expect(lines).toEqual([
			{
				fields: {
					projectId: "proj-idle",
					sandboxId: "vendor-proj-idle",
				},
				level: "info",
				message: "sandbox.idle-sweep.stopped",
			},
		]);
	});

	it("marks the row error and continues when one stop fails", async () => {
		const sessions = new FakeSandboxSessionsRepository();
		// A spec-local override, not a mock: only the failing project throws.
		const provider = new (class extends FakeSandboxProvider {
			override async stop(projectId: string): Promise<void> {
				if (projectId === "proj-bad") {
					throw new Error("vendor unreachable");
				}
				return super.stop(projectId);
			}
		})();
		const { lines, logger } = makeLogger();
		const badRowId = await seedRunningRow(sessions, "proj-bad", IDLE_AT);
		const okRowId = await seedRunningRow(sessions, "proj-ok", IDLE_AT);

		const result = await runSandboxIdleSweep({
			logger,
			now: () => NOW,
			provider,
			sessions,
			turnLock: new FakeTurnLock(),
		});

		expect(result).toEqual({ failed: 1, skipped: 0, stopped: 1, total: 2 });
		expect(sessions.rows.get(badRowId)?.status).toBe("error");
		expect(sessions.rows.get(badRowId)?.error).toBe("vendor unreachable");
		expect(sessions.rows.get(okRowId)?.status).toBe("stopped");
		expect(lines.map((line) => line.level)).toEqual(["warn", "info"]);
	});

	it("never sees a running row without activity as idle", async () => {
		// `lt(lastActiveAt, cutoff)` excludes NULL, mirroring the SQL. Every
		// real running row got `lastActiveAt` from `markRunning`; this only
		// guards the fake against a different read of the rule.
		const sessions = new FakeSandboxSessionsRepository();
		const provider = new FakeSandboxProvider();
		const { logger } = makeLogger();
		await seedRunningRow(sessions, "proj-null-activity", null);

		const result = await runSandboxIdleSweep({
			logger,
			now: () => NOW,
			provider,
			sessions,
			turnLock: new FakeTurnLock(),
		});

		expect(result).toEqual({ failed: 0, skipped: 0, stopped: 0, total: 0 });
		expect(provider.calls).toEqual([]);
	});

	it("skips an idle row while its project holds a live turn lock", async () => {
		const sessions = new FakeSandboxSessionsRepository();
		const provider = new FakeSandboxProvider();
		const turnLock = new FakeTurnLock();
		const { lines, logger } = makeLogger();
		const idleRowId = await seedRunningRow(sessions, "proj-idle", IDLE_AT);
		await turnLock.acquire("proj-idle", "turn-1", 60_000);

		const result = await runSandboxIdleSweep({
			logger,
			now: () => NOW,
			provider,
			sessions,
			turnLock,
		});

		expect(result).toEqual({ failed: 0, skipped: 1, stopped: 0, total: 1 });
		expect(provider.calls).toEqual([]);
		expect(sessions.rows.get(idleRowId)?.status).toBe("running");
		expect(lines).toEqual([
			{
				fields: {
					projectId: "proj-idle",
					sandboxId: "vendor-proj-idle",
				},
				level: "info",
				message: "sandbox.idle-sweep.skipped-live-turn",
			},
		]);
	});
});
