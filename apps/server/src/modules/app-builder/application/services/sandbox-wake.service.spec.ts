import { Logger, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	SandboxHandle,
	SandboxProvider,
} from "../../domain/ports/sandbox-provider";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import type { TurnProjectRow } from "../../infrastructure/persistence/turn-project.repository";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import { SandboxWakeService } from "./sandbox-wake.service";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};
const TURN_PROJECT: TurnProjectRow = {
	engine: "v2_app",
	framework: "web-app",
	languages: ["en"],
	networkAllowedHosts: [],
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

function fixture(options?: {
	project?: ScopedAppProject | null;
	sandboxes?: Pick<SandboxProvider, "findRunning" | "getOrCreate">;
}) {
	const sandboxes = options?.sandboxes ?? new FakeSandboxProvider();
	const turnLock = new FakeTurnLock();
	const service = new SandboxWakeService(
		{
			findScopedProject: async () =>
				options?.project === undefined ? PROJECT : options.project,
		},
		{ findForTurn: async () => TURN_PROJECT },
		{ findByProjectId: async () => null },
		sandboxes,
		turnLock,
	);
	return { service, turnLock };
}

describe("SandboxWakeService.wake", () => {
	// Same scope gate as the versions routes: no wake of a V1 project or of
	// another workspace's project.
	it.each<[string, ScopedAppProject | null]>([
		["a v1 project", { ...PROJECT, engine: "v1_page" }],
		["a project outside the scope", null],
	])("answers 404 for %s and takes no lock", async (_case, project) => {
		const { service, turnLock } = fixture({ project });

		await expect(service.wake(SCOPE, "p-1")).rejects.toEqual(
			expect.any(NotFoundException),
		);
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	it("answers busy and boots nothing while a turn holds the lock", async () => {
		const sandboxes = new FakeSandboxProvider();
		const { service, turnLock } = fixture({ sandboxes });
		await turnLock.acquire("p-1", "turn-9", 60_000);

		expect(await service.wake(SCOPE, "p-1")).toEqual({ status: "busy" });

		expect(sandboxes.createOptions).toEqual([]);
		expect(await turnLock.holder("p-1")).toBe("turn-9");
	});

	it("holds a wake lock during the boot and frees it when the boot fails", async () => {
		const logError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		// The boot stays open until the case fails it.
		const pendingBoot: { fail: ((error: Error) => void) | null } = {
			fail: null,
		};
		const { service, turnLock } = fixture({
			sandboxes: {
				findRunning: async () => null,
				getOrCreate: () =>
					new Promise<SandboxHandle>((_resolve, reject) => {
						pendingBoot.fail = reject;
					}),
			},
		});

		expect(await service.wake(SCOPE, "p-1")).toEqual({ status: "starting" });

		// A turn submit during the boot sees this holder and answers 409.
		expect(await turnLock.holder("p-1")).toMatch(/^wake:/);
		await vi.waitFor(() => expect(pendingBoot.fail).not.toBeNull());
		pendingBoot.fail?.(new Error("vendor down"));
		await vi.waitFor(async () =>
			expect(await turnLock.holder("p-1")).toBeNull(),
		);
		expect(logError).toHaveBeenCalledWith(
			"sandbox.wake-failed",
			expect.objectContaining({ projectId: "p-1", userId: "user-1" }),
		);
		logError.mockRestore();
	});
});
