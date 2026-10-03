import {
	ConflictException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { env } from "@wandit/env/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SettledCreditBalance } from "../../../credits/application/services/credits.service";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	AppBranchHead,
	ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import type {
	AppBuildRow,
	AppDeploymentRow,
	InsertAppBuildResult,
	NewAppBuild,
} from "../../infrastructure/persistence/app-publish.repository";
import { PublishService } from "./publish.service";

const PROJECT_ID = "0f3a9c1b-4e7d-4a2b-9c3d-1e2f3a4b5c6d";
const BUILD_ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const SOURCE_BUILD_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const REQUEST_KEY = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const HEAD_SHA = "b".repeat(40);

// The env values the publish guards read. Each case starts configured.
const R2_KEYS = [
	"R2_ACCOUNT_ID",
	"R2_ACCESS_KEY_ID",
	"R2_SECRET_ACCESS_KEY",
	"R2_BUCKET",
] as const;
const INITIAL_ENV = new Map(
	[...R2_KEYS, "ALLOW_PUBLISH_WITHOUT_KV"].map((key) => [
		key,
		Reflect.get(env, key),
	]),
);

beforeEach(() => {
	for (const key of R2_KEYS) {
		Reflect.set(env, key, "r2-value");
	}
	// deleteProperty, not `= false`: on process.env the assignment would
	// coerce to the truthy string "false".
	Reflect.deleteProperty(env, "ALLOW_PUBLISH_WITHOUT_KV");
});

afterEach(() => {
	for (const [key, value] of INITIAL_ENV) {
		if (value === undefined) {
			Reflect.deleteProperty(env, key);
		} else {
			Reflect.set(env, key, value);
		}
	}
});

function buildRow(overrides: Partial<AppBuildRow> = {}): AppBuildRow {
	return {
		bytes: null,
		commitSha: HEAD_SHA,
		completedAt: null,
		createdAt: new Date("2026-10-01T10:00:00.000Z"),
		errorCode: null,
		errorMessage: null,
		fileCount: null,
		id: BUILD_ID,
		organizationId: null,
		projectId: PROJECT_ID,
		requestKey: REQUEST_KEY,
		sourceBuildId: null,
		status: "queued",
		triggerRunId: null,
		updatedAt: new Date("2026-10-01T10:00:00.000Z"),
		userId: "user-1",
		...overrides,
	};
}

function deploymentRow(
	overrides: Partial<AppDeploymentRow> = {},
): AppDeploymentRow {
	return {
		buildId: SOURCE_BUILD_ID,
		commitSha: "a".repeat(40),
		createdAt: new Date("2026-09-30T10:00:00.000Z"),
		error: null,
		id: "deployment-1",
		kind: "app",
		projectId: PROJECT_ID,
		slug: "booking-app",
		status: "superseded",
		updatedAt: new Date("2026-09-30T11:00:00.000Z"),
		versionId: null,
		...overrides,
	};
}

// A settled balance snapshot in centi-credits; only the two totals matter here.
function balance(settledBalance: number): SettledCreditBalance {
	return {
		balance: settledBalance,
		plan: 0,
		promo: 0,
		settledBalance,
		settledPlan: 0,
		settledPromo: 0,
		settledTopup: settledBalance,
		topup: settledBalance,
	};
}

function setup() {
	const order: string[] = [];
	const publish = {
		failStaleLive: vi.fn(async (_projectId: string, _olderThan: Date) => 0),
		findById: vi.fn(
			async (_id: string): Promise<AppBuildRow | null> =>
				buildRow({ id: SOURCE_BUILD_ID, status: "published" }),
		),
		findByRequestKey: vi.fn(
			async (_projectId: string, _key: string): Promise<AppBuildRow | null> =>
				null,
		),
		findDeployment: vi.fn(
			async (
				_projectId: string,
				_id: string,
			): Promise<AppDeploymentRow | null> => deploymentRow(),
		),
		findLatest: vi.fn(async (): Promise<AppBuildRow | null> => null),
		findLive: vi.fn(
			async (_projectId: string): Promise<AppBuildRow | null> => null,
		),
		findLiveDeployment: vi.fn(
			async (_projectId: string): Promise<AppDeploymentRow | null> => null,
		),
		insertQueued: vi.fn(
			async (input: NewAppBuild): Promise<InsertAppBuildResult> => ({
				kind: "created",
				row: buildRow({
					commitSha: input.commitSha,
					sourceBuildId: input.sourceBuildId,
				}),
			}),
		),
		listDeployments: vi.fn(
			async (
				_projectId: string,
				_limit: number,
			): Promise<AppDeploymentRow[]> => [],
		),
		setTriggerRunId: vi.fn(async (_id: string, _runId: string) => undefined),
		transition: vi.fn(async () =>
			buildRow({ errorCode: "start_failed", status: "failed" }),
		),
	};
	const deployments = {
		healStalePending: vi.fn(async (_projectId: string) => undefined),
		unpublishActive: vi.fn(async (_projectId: string) => {
			order.push("unpublish-row");
			return null;
		}),
	};
	const appCommits = {
		findBranch: vi.fn(
			async (): Promise<AppBranchHead | null> => ({ headSha: HEAD_SHA }),
		),
		findScopedProject: vi.fn(
			async (): Promise<ScopedAppProject | null> => ({
				engine: "v2_app",
				framework: "web-app",
				id: PROJECT_ID,
				organizationId: null,
				templateVersion: "web-app@1.0.0",
				userId: "user-1",
			}),
		),
	};
	const credits = {
		getSettledBalance: vi.fn(async () => balance(500)),
	};
	const routing = {
		deleteHostPointer: vi.fn(async (_host: string) => {
			order.push("pointer");
		}),
		isKvConfigured: vi.fn(() => true),
	};
	const starter = { start: vi.fn(async () => ({ runId: "run-1" })) };
	const workers = {
		deleteScript: vi.fn(async () => {
			order.push("worker");
			return "deleted" as const;
		}),
	};
	const service = new PublishService(
		publish,
		deployments,
		appCommits,
		credits,
		routing,
		starter,
		workers,
	);
	return {
		appCommits,
		credits,
		deployments,
		order,
		publish,
		routing,
		service,
		starter,
		workers,
	};
}

describe("PublishService.publishHead", () => {
	it("queues the head of main and starts the task", async () => {
		const { publish, service, starter } = setup();

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build).toMatchObject({ id: BUILD_ID, status: "queued" });
		expect(publish.insertQueued).toHaveBeenCalledWith({
			commitSha: HEAD_SHA,
			organizationId: null,
			projectId: PROJECT_ID,
			requestKey: REQUEST_KEY,
			sourceBuildId: null,
			userId: "user-1",
		});
		expect(starter.start).toHaveBeenCalledWith({
			buildId: BUILD_ID,
			projectId: PROJECT_ID,
		});
		expect(publish.setTriggerRunId).toHaveBeenCalledWith(BUILD_ID, "run-1");
	});

	it("answers the first build for a retried request key and starts nothing", async () => {
		const { publish, service, starter } = setup();
		publish.findByRequestKey.mockResolvedValue(
			buildRow({ status: "building" }),
		);

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build.status).toBe("building");
		expect(publish.insertQueued).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers 503 V2_ENV_MISSING without the W4P client and writes nothing", async () => {
		const base = setup();
		const service = new PublishService(
			base.publish,
			base.deployments,
			base.appCommits,
			base.credits,
			base.routing,
			base.starter,
			null,
		);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({
			response: { code: "V2_ENV_MISSING" },
		});
		expect(base.publish.insertQueued).not.toHaveBeenCalled();
	});

	it("answers 503 V2_ENV_MISSING without R2", async () => {
		const { service } = setup();
		Reflect.deleteProperty(env, "R2_BUCKET");

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it("answers 503 PUBLISH_UNAVAILABLE without KV, and allows the local switch", async () => {
		const { routing, service } = setup();
		routing.isKvConfigured.mockReturnValue(false);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({ response: { code: "PUBLISH_UNAVAILABLE" } });

		Reflect.set(env, "ALLOW_PUBLISH_WITHOUT_KV", "true");
		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).resolves.toMatchObject({ status: "queued" });
	});

	it("answers 402 on a negative settled balance and publishes on zero", async () => {
		const { credits, publish, service } = setup();
		credits.getSettledBalance.mockResolvedValueOnce(balance(-120));

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(InsufficientCreditsError);
		expect(publish.insertQueued).not.toHaveBeenCalled();

		credits.getSettledBalance.mockResolvedValueOnce(balance(0));
		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).resolves.toMatchObject({ status: "queued" });
	});

	it("answers 409 PUBLISH_NO_VERSION without a saved head", async () => {
		const { appCommits, service } = setup();
		appCommits.findBranch.mockResolvedValue({ headSha: null });

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({ response: { code: "PUBLISH_NO_VERSION" } });
	});

	it("answers 409 PUBLISH_ACTIVE while a publish runs, also when the live index wins", async () => {
		const { publish, service } = setup();
		publish.findLive.mockResolvedValueOnce(buildRow({ status: "building" }));

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toMatchObject({ response: { code: "PUBLISH_ACTIVE" } });

		publish.insertQueued.mockResolvedValueOnce({ kind: "live_exists" });
		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("starts nothing when a parallel retry of the same key wrote its row first", async () => {
		const { publish, service, starter } = setup();
		publish.insertQueued.mockResolvedValueOnce({
			kind: "request_exists",
			row: buildRow({ status: "building" }),
		});

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build.status).toBe("building");
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("answers the queued build when the run id write fails", async () => {
		const { publish, service } = setup();
		publish.setTriggerRunId.mockRejectedValue(new Error("db down"));

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).resolves.toMatchObject({ status: "queued" });
	});

	it("fails the row start_failed when the task does not start", async () => {
		const { publish, service, starter } = setup();
		starter.start.mockRejectedValue(new Error("trigger down"));

		const build = await service.publishHead(SCOPE, PROJECT_ID, {
			requestKey: REQUEST_KEY,
		});

		expect(build).toMatchObject({
			errorCode: "start_failed",
			status: "failed",
		});
		expect(publish.transition).toHaveBeenCalledWith(BUILD_ID, {
			errorCode: "start_failed",
			errorMessage: "The publish task could not start",
			to: "failed",
		});
	});

	it("passes a 503 of the starter to the client after it fails the row", async () => {
		const { publish, service, starter } = setup();
		starter.start.mockRejectedValue(
			new ServiceUnavailableException({ code: "V2_ENV_MISSING" }),
		);

		await expect(
			service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
		).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(publish.transition).toHaveBeenCalledOnce();
	});

	it("answers 404 for a mobile app, a V1 project, and a missing project", async () => {
		const { appCommits, service } = setup();
		for (const project of [
			{ engine: "v2_app", framework: "mobile-app" },
			{ engine: "v1_page", framework: null },
			null,
		]) {
			appCommits.findScopedProject.mockResolvedValueOnce(
				project === null
					? null
					: {
							...project,
							id: PROJECT_ID,
							organizationId: null,
							templateVersion: null,
							userId: "user-1",
						},
			);
			await expect(
				service.publishHead(SCOPE, PROJECT_ID, { requestKey: REQUEST_KEY }),
			).rejects.toBeInstanceOf(NotFoundException);
		}
	});
});

describe("PublishService.rollback", () => {
	const body = { deploymentId: "deployment-1", requestKey: REQUEST_KEY };

	it("queues the stored output of the target build with its commit", async () => {
		const { publish, service } = setup();

		await service.rollback(SCOPE, PROJECT_ID, body);

		expect(publish.insertQueued).toHaveBeenCalledWith(
			expect.objectContaining({
				commitSha: "a".repeat(40),
				sourceBuildId: SOURCE_BUILD_ID,
			}),
		);
	});

	it("uploads the first stored output on a rollback of a rollback", async () => {
		const { publish, service } = setup();
		publish.findById.mockResolvedValue(
			buildRow({ id: SOURCE_BUILD_ID, sourceBuildId: "first-build" }),
		);

		await service.rollback(SCOPE, PROJECT_ID, body);

		expect(publish.insertQueued).toHaveBeenCalledWith(
			expect.objectContaining({ sourceBuildId: "first-build" }),
		);
	});

	it("answers 404 when the build of the row belongs to another project", async () => {
		const { publish, service } = setup();
		publish.findById.mockResolvedValue(
			buildRow({ id: SOURCE_BUILD_ID, projectId: "other-project" }),
		);

		await expect(
			service.rollback(SCOPE, PROJECT_ID, body),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(publish.insertQueued).not.toHaveBeenCalled();
	});

	it("answers 409 for the live row and 404 for a missing row", async () => {
		const { publish, service } = setup();
		publish.findDeployment.mockResolvedValueOnce(
			deploymentRow({ status: "active" }),
		);

		await expect(
			service.rollback(SCOPE, PROJECT_ID, body),
		).rejects.toMatchObject({ response: { code: "PUBLISH_ROLLBACK_INVALID" } });

		publish.findDeployment.mockResolvedValueOnce(null);
		await expect(
			service.rollback(SCOPE, PROJECT_ID, body),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(publish.insertQueued).not.toHaveBeenCalled();
	});
});

describe("PublishService.unpublish", () => {
	it("deletes the pointer, then the Worker, then ends the live row", async () => {
		const { order, publish, routing, service, workers } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);

		await service.unpublish(SCOPE, PROJECT_ID);

		expect(order).toEqual(["pointer", "worker", "unpublish-row"]);
		expect(routing.deleteHostPointer).toHaveBeenCalledWith(
			`booking-app.${env.SITES_DOMAIN}`,
		);
		expect(workers.deleteScript).toHaveBeenCalledWith({
			projectId: PROJECT_ID,
			scriptName: `app-${PROJECT_ID}`,
		});
	});

	it("keeps the live row when the pointer delete fails", async () => {
		const { deployments, publish, routing, service } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		routing.deleteHostPointer.mockRejectedValue(new Error("kv down"));

		await expect(service.unpublish(SCOPE, PROJECT_ID)).rejects.toThrow(
			"kv down",
		);
		expect(deployments.unpublishActive).not.toHaveBeenCalled();
	});

	it("ends the live row when the Worker delete fails", async () => {
		const { deployments, publish, service, workers } = setup();
		publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		workers.deleteScript.mockRejectedValue(new Error("cloudflare down"));

		await service.unpublish(SCOPE, PROJECT_ID);

		expect(deployments.unpublishActive).toHaveBeenCalledWith(PROJECT_ID);
	});

	it("ends the live row without KV and without the W4P client", async () => {
		const base = setup();
		base.publish.findLiveDeployment.mockResolvedValue(
			deploymentRow({ status: "active" }),
		);
		base.routing.isKvConfigured.mockReturnValue(false);
		const service = new PublishService(
			base.publish,
			base.deployments,
			base.appCommits,
			base.credits,
			base.routing,
			base.starter,
			null,
		);

		await service.unpublish(SCOPE, PROJECT_ID);

		expect(base.routing.deleteHostPointer).not.toHaveBeenCalled();
		expect(base.deployments.unpublishActive).toHaveBeenCalledWith(PROJECT_ID);
	});

	it("answers 409 PUBLISH_ACTIVE while a publish runs", async () => {
		const { publish, routing, service } = setup();
		publish.findLive.mockResolvedValue(buildRow({ status: "uploading" }));

		await expect(service.unpublish(SCOPE, PROJECT_ID)).rejects.toMatchObject({
			response: { code: "PUBLISH_ACTIVE" },
		});
		expect(routing.deleteHostPointer).not.toHaveBeenCalled();
	});
});

describe("PublishService.status", () => {
	it("answers the live app, the latest build, and the history", async () => {
		const { publish, service } = setup();
		const live = deploymentRow({ status: "active" });
		publish.findLiveDeployment.mockResolvedValue(live);
		publish.findLatest.mockResolvedValue(buildRow({ status: "published" }));
		publish.listDeployments.mockResolvedValue([live]);

		const status = await service.status(SCOPE, PROJECT_ID);

		expect(status.live).toEqual({
			commitSha: "a".repeat(40),
			deploymentId: "deployment-1",
			publishedAt: "2026-09-30T11:00:00.000Z",
			slug: "booking-app",
			url: `https://booking-app.${env.SITES_DOMAIN}`,
		});
		expect(status.latestBuild?.status).toBe("published");
		expect(status.history).toHaveLength(1);
		expect(publish.listDeployments).toHaveBeenCalledWith(PROJECT_ID, 20);
	});

	it("ends live rows older than 30 minutes and stale pending deployments first", async () => {
		const { deployments, publish, service } = setup();
		vi.useFakeTimers({ now: new Date("2026-10-01T12:00:00.000Z") });
		try {
			await service.status(SCOPE, PROJECT_ID);
		} finally {
			vi.useRealTimers();
		}

		expect(publish.failStaleLive).toHaveBeenCalledWith(
			PROJECT_ID,
			new Date("2026-10-01T11:30:00.000Z"),
		);
		expect(deployments.healStalePending).toHaveBeenCalledWith(PROJECT_ID);
	});
});
