import { describe, expect, it, vi } from "vitest";

import type { ProvisionBackendTaskStarter } from "../../domain/ports/provision-backend-task-starter";
import type { V2EnvSource } from "../../infrastructure/env/v2-env";
import type {
	AppBackendRow,
	AppBackendsRepository,
} from "../../infrastructure/persistence/app-backends.repository";
import { BackendsService } from "./backends.service";

const INPUT = {
	countryCode: "DE",
	organizationId: null,
	userId: "user-1",
} as const;

function backendRow(overrides: Partial<AppBackendRow> = {}): AppBackendRow {
	return {
		anonKey: null,
		dbHost: null,
		failureCode: null,
		id: "backend-1",
		orgId: null,
		organizationId: null,
		projectId: "project-1",
		ref: null,
		region: "eu-west-3",
		requestKey: "request-1",
		status: "creating",
		triggerRunId: null,
		userId: "user-1",
		...overrides,
	};
}

function setup(envOverrides: Partial<V2EnvSource> = {}) {
	const backends = {
		findByProjectId: vi.fn<AppBackendsRepository["findByProjectId"]>(
			async () => null,
		),
		insertCreating: vi.fn<AppBackendsRepository["insertCreating"]>(
			async (input) => backendRow({ ...input }),
		),
		markError: vi.fn<AppBackendsRepository["markError"]>(async () => undefined),
		setTriggerRunId: vi.fn<AppBackendsRepository["setTriggerRunId"]>(
			async () => undefined,
		),
	};
	const starter = {
		start: vi.fn<ProvisionBackendTaskStarter["start"]>(async () => ({
			runId: "run-1",
		})),
	};
	const v2Env: V2EnvSource = {
		SUPABASE_PLATFORM_ORG_ID: "org-slug",
		SUPABASE_PLATFORM_TOKEN: "token",
		V2_HARNESS: "claude-code",
		...envOverrides,
	};

	const service = new BackendsService(backends, starter, v2Env);

	return { backends, service, starter };
}

describe("BackendsService.provisionBackend", () => {
	it("answers null and writes nothing when the platform token is unset", async () => {
		const { backends, service, starter } = setup({
			SUPABASE_PLATFORM_TOKEN: undefined,
		});

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBeNull();
		expect(backends.findByProjectId).not.toHaveBeenCalled();
		expect(backends.insertCreating).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers null when the platform org id is unset", async () => {
		const { backends, service, starter } = setup({
			SUPABASE_PLATFORM_ORG_ID: undefined,
		});

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBeNull();
		expect(backends.insertCreating).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers the existing row and starts nothing on a second call", async () => {
		const { backends, service, starter } = setup();
		const existing = backendRow({ status: "active" });
		backends.findByProjectId.mockResolvedValue(existing);

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBe(existing);
		expect(backends.insertCreating).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("inserts eu-central-1 for a German user and starts the task", async () => {
		const { backends, service, starter } = setup();

		const row = await service.provisionBackend("project-1", INPUT);

		const inserted = backends.insertCreating.mock.calls[0]?.[0];
		if (!inserted) {
			throw new Error("insertCreating was not called");
		}
		expect(inserted).toMatchObject({
			organizationId: null,
			projectId: "project-1",
			region: "eu-central-1",
			userId: "user-1",
		});
		expect(inserted.requestKey).toMatch(/^[0-9a-f-]{36}$/u);
		expect(starter.start).toHaveBeenCalledWith({
			projectId: "project-1",
			requestKey: inserted.requestKey,
		});
		expect(backends.setTriggerRunId).toHaveBeenCalledWith("project-1", "run-1");
		expect(row).toMatchObject({ requestKey: inserted.requestKey });
	});

	it("lets SUPABASE_PLATFORM_REGION override the picked region", async () => {
		const { backends, service } = setup({
			SUPABASE_PLATFORM_REGION: "eu-west-1",
		});

		await service.provisionBackend("project-1", INPUT);

		expect(backends.insertCreating).toHaveBeenCalledWith(
			expect.objectContaining({ region: "eu-west-1" }),
		);
	});

	it("inserts the picked region when the override is invalid", async () => {
		const { backends, service } = setup({
			SUPABASE_PLATFORM_REGION: "moon-1",
		});

		await service.provisionBackend("project-1", INPUT);

		expect(backends.insertCreating).toHaveBeenCalledWith(
			expect.objectContaining({ region: "eu-central-1" }),
		);
	});

	it("answers the re-read row and starts nothing when a concurrent create won", async () => {
		const { backends, service, starter } = setup();
		const winner = backendRow({ requestKey: "other-key" });
		backends.findByProjectId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(winner);
		backends.insertCreating.mockResolvedValue(null);

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBe(winner);
		expect(starter.start).not.toHaveBeenCalled();
		expect(backends.setTriggerRunId).not.toHaveBeenCalled();
	});

	it("throws and starts nothing when the insert and the re-read answer no row", async () => {
		const { backends, service, starter } = setup();
		backends.insertCreating.mockResolvedValue(null);
		backends.findByProjectId.mockResolvedValue(null);

		await expect(service.provisionBackend("project-1", INPUT)).rejects.toThrow(
			"app_backends insert returned no row for project project-1",
		);
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("marks the row backend_provision_start_failed and answers it when the start throws", async () => {
		const { backends, service, starter } = setup();
		const failed = backendRow({
			failureCode: "backend_provision_start_failed",
			status: "error",
		});
		backends.findByProjectId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(failed);
		starter.start.mockRejectedValue(new Error("trigger down"));

		const row = await service.provisionBackend("project-1", INPUT);

		expect(row).toBe(failed);
		expect(backends.markError).toHaveBeenCalledWith("project-1", {
			error: "trigger down",
			failureCode: "backend_provision_start_failed",
			failureKind: "internal",
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			failureSource: "task",
			sentryEventId: null,
		});
		expect(backends.setTriggerRunId).not.toHaveBeenCalled();
	});
});
