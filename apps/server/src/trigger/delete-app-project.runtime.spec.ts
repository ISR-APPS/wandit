import { describe, expect, it, vi } from "vitest";

import type { DeleteAppProjectInput } from "../modules/app-builder/domain/ports/delete-app-project-task-starter";
import type { BuilderTurnRow } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import {
	type DeleteAppProjectDeps,
	runDeleteAppProject,
} from "./delete-app-project.runtime";

const INPUT: DeleteAppProjectInput = {
	actorUserId: "user-1",
	organizationId: "org-1",
	projectId: "project-1",
};

// Copy of the `turnRow` fixture of `turns.service.spec.ts`: the spec must
// not import from another spec file.
function turnRow(overrides: Partial<BuilderTurnRow> = {}): BuilderTurnRow {
	return {
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: "chat-1",
		completedAt: null,
		createdAt: new Date(0),
		credits: null,
		error: null,
		failureCode: null,
		failureKind: null,
		failureProvider: null,
		failureProviderMessage: null,
		failureRequestId: null,
		failureSource: null,
		harness: "claude_code",
		id: "turn-1",
		inputCommitSha: null,
		inputTokens: null,
		messageId: "message-1",
		model: null,
		organizationId: null,
		outputCommitSha: null,
		outputTokens: null,
		projectId: "project-1",
		requestKey: "turn-1",
		sentryEventId: null,
		sessionId: "session-1",
		spec: { attachments: [], composer: null, message: "hi" },
		startedAt: null,
		status: "queued",
		triggerRunId: null,
		turnNumber: 1,
		userId: "user-1",
		...overrides,
	};
}

function setup(active: BuilderTurnRow | null = null) {
	const order: string[] = [];
	const deps = {
		auditEvents: {
			insert: vi.fn(async () => {
				order.push("audit");
			}),
		},
		cancelRun: vi.fn(async (_runId: string) => {
			order.push("cancel");
		}),
		capture: vi.fn(() => {
			order.push("capture");
		}),
		deleteObjectsByPrefix: vi.fn(async (prefix: string) => {
			order.push(`objects:${prefix}`);
			return prefix.startsWith("git/") ? 2 : 3;
		}),
		gitStore: {
			deleteRepository: vi.fn(async () => {
				order.push("repository");
			}),
		},
		logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
		sandboxes: {
			destroy: vi.fn(async () => {
				order.push("sandbox");
			}),
		},
		turns: { findActiveForProject: vi.fn(async () => active) },
	} satisfies DeleteAppProjectDeps;

	return { deps, order };
}

describe("runDeleteAppProject", () => {
	it("runs the seven steps in order and sums both prefixes", async () => {
		const { deps, order } = setup(
			turnRow({ status: "running", triggerRunId: "run-9" }),
		);

		const result = await runDeleteAppProject(deps, INPUT);

		expect(order).toEqual([
			"cancel",
			"sandbox",
			"objects:git/project-1/",
			"objects:sites/project-1/assets/",
			"repository",
			"audit",
			"capture",
		]);
		expect(result).toEqual({
			auditWritten: true,
			objectsDeleted: 5,
			repository: "deleted",
			sandbox: "destroyed",
			turnCanceled: true,
		});
		expect(deps.cancelRun).toHaveBeenCalledWith("run-9");
	});

	it("does not cancel a queued turn without a run id", async () => {
		const { deps, order } = setup(
			turnRow({ status: "queued", triggerRunId: null }),
		);

		const result = await runDeleteAppProject(deps, INPUT);

		expect(deps.cancelRun).not.toHaveBeenCalled();
		expect(result.turnCanceled).toBe(false);
		expect(order[0]).toBe("sandbox");
	});

	it("does not cancel when no turn is active", async () => {
		const { deps } = setup(null);

		const result = await runDeleteAppProject(deps, INPUT);

		expect(deps.cancelRun).not.toHaveBeenCalled();
		expect(result.turnCanceled).toBe(false);
	});

	it("answers sandbox error and continues when destroy throws", async () => {
		const { deps } = setup();
		deps.sandboxes.destroy.mockRejectedValue(new Error("vercel down"));

		const result = await runDeleteAppProject(deps, INPUT);

		expect(result.sandbox).toBe("error");
		expect(result.repository).toBe("deleted");
		expect(result.auditWritten).toBe(true);
		expect(deps.logger.error).toHaveBeenCalledWith(
			"app-project.delete.sandbox-failed",
			{ error: "vercel down", projectId: "project-1" },
		);
		expect(deps.auditEvents.insert).toHaveBeenCalledTimes(1);
		expect(deps.auditEvents.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: {
					objectsDeleted: 5,
					repository: "deleted",
					sandbox: "error",
					turnCanceled: false,
				},
			}),
		);
	});

	it("answers repository error and still writes the audit row when deleteRepository throws", async () => {
		const { deps } = setup();
		deps.gitStore.deleteRepository.mockRejectedValue(
			new Error("code.storage 500"),
		);

		const result = await runDeleteAppProject(deps, INPUT);

		expect(result.repository).toBe("error");
		expect(result.auditWritten).toBe(true);
		expect(deps.auditEvents.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({ repository: "error" }),
			}),
		);
	});

	it("answers auditWritten false when the insert throws", async () => {
		const { deps } = setup();
		deps.auditEvents.insert.mockRejectedValue(new Error("db down"));

		const result = await runDeleteAppProject(deps, INPUT);

		expect(result.auditWritten).toBe(false);
		expect(deps.capture).toHaveBeenCalled();
	});

	it("writes the audit row and the analytics event", async () => {
		const { deps } = setup();

		await runDeleteAppProject(deps, INPUT);

		expect(deps.auditEvents.insert).toHaveBeenCalledWith({
			action: "project.deleted",
			actorUserId: "user-1",
			metadata: {
				objectsDeleted: 5,
				repository: "deleted",
				sandbox: "destroyed",
				turnCanceled: false,
			},
			organizationId: "org-1",
			projectId: "project-1",
			targetId: "project-1",
			targetType: "project",
		});
		expect(deps.capture).toHaveBeenCalledWith("user-1", "v2_project_deleted", {
			objectsDeleted: 5,
			organizationId: "org-1",
			projectId: "project-1",
			repository: "deleted",
			sandbox: "destroyed",
		});
	});

	it("logs a prefix failure and drains the other prefix", async () => {
		const { deps } = setup();
		deps.deleteObjectsByPrefix.mockImplementation(async (prefix) => {
			if (prefix.startsWith("git/")) {
				throw new Error("r2 down");
			}
			return 3;
		});

		const result = await runDeleteAppProject(deps, INPUT);

		expect(result.objectsDeleted).toBe(3);
		expect(deps.logger.error).toHaveBeenCalledWith(
			"app-project.delete.objects-failed",
			expect.objectContaining({ prefix: "git/project-1/" }),
		);
	});

	it("logs a cancel failure and continues when cancelRun throws", async () => {
		const { deps } = setup(
			turnRow({ status: "running", triggerRunId: "run-9" }),
		);
		deps.cancelRun.mockRejectedValue(new Error("trigger down"));

		const result = await runDeleteAppProject(deps, INPUT);

		expect(deps.cancelRun).toHaveBeenCalledWith("run-9");
		expect(result.turnCanceled).toBe(false);
		expect(result.sandbox).toBe("destroyed");
		expect(result.auditWritten).toBe(true);
		expect(deps.logger.error).toHaveBeenCalledWith(
			"app-project.delete.turn-cancel-failed",
			{ error: "trigger down", projectId: "project-1" },
		);
		expect(deps.auditEvents.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({ turnCanceled: false }),
			}),
		);
	});
});
