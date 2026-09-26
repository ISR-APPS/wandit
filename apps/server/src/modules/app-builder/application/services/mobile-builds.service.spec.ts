import {
	HttpException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { ListMobileBuildsResponse, MobileBuild } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { AiUsageEvent } from "../../../metering/domain/metering";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { EasBuildRunner } from "../../domain/ports/eas-build-runner";
import type { MobileBuildTaskStarter } from "../../domain/ports/mobile-build-task-starter";
import type {
	AppCommitsRepository,
	ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import type {
	AuditEventInput,
	AuditEventsRepository,
} from "../../infrastructure/persistence/audit-events.repository";
import {
	MalformedMobileBuildCursorError,
	type MobileBuildRow,
	type MobileBuildsRepository,
} from "../../infrastructure/persistence/mobile-builds.repository";
import { MobileBuildsService } from "./mobile-builds.service";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BUILD_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_KEY = "33333333-3333-4333-8333-333333333333";
const HEAD_SHA = "a".repeat(40);
const CREATED_AT = new Date("2026-09-26T10:00:00.000Z");
const PERSONAL: ProjectScope = { kind: "personal", userId: "user_1" };
const ORG: ProjectScope = {
	actorIsLimitExempt: true,
	kind: "org",
	organizationId: "org_1",
	userId: "user_1",
};
const BODY = { platform: "android", requestKey: REQUEST_KEY } as const;
const IP = "203.0.113.9";
const INITIAL_GENERATION_BILLING_MODE = env.GENERATION_BILLING_MODE;

afterEach(() => {
	// The env object can be process.env; restore it so the billing mode does
	// not leak into other spec files on the same worker.
	if (INITIAL_GENERATION_BILLING_MODE === undefined) {
		Reflect.deleteProperty(env, "GENERATION_BILLING_MODE");
	} else {
		Reflect.set(
			env,
			"GENERATION_BILLING_MODE",
			INITIAL_GENERATION_BILLING_MODE,
		);
	}
});

function buildRow(overrides: Partial<MobileBuildRow> = {}): MobileBuildRow {
	return {
		artifactUrl: null,
		commitSha: HEAD_SHA,
		completedAt: null,
		createdAt: CREATED_AT,
		easBuildId: null,
		errorCode: null,
		errorMessage: null,
		id: BUILD_ID,
		kind: "apk",
		organizationId: null,
		platform: "android",
		projectId: PROJECT_ID,
		requestKey: REQUEST_KEY,
		status: "queued",
		triggerRunId: null,
		updatedAt: CREATED_AT,
		userId: "user_1",
		...overrides,
	};
}

function mobileProject(
	overrides: Partial<ScopedAppProject> = {},
): ScopedAppProject {
	return {
		engine: "v2_app",
		framework: "mobile-app",
		id: PROJECT_ID,
		organizationId: null,
		templateVersion: "mobile-app@1.1.0",
		userId: "user_1",
		...overrides,
	};
}

function holdEvent(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
	return {
		attemptRef: BUILD_ID,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: CREATED_AT,
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: null,
		id: "hold_1",
		idempotencyKey: `mobile_build:${BUILD_ID}`,
		inputTokens: null,
		messageId: null,
		model: null,
		nextReconcileAttemptAt: null,
		operation: "mobile_build",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		pricingSnapshot: {},
		projectId: PROJECT_ID,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: 5_000,
		settledAt: null,
		status: "reserved",
		userId: "user_1",
		...overrides,
	};
}

function setup(options: { runner?: "none" } = {}) {
	const audits: AuditEventInput[] = [];
	const builds = {
		findById: vi.fn<MobileBuildsRepository["findById"]>(async () => buildRow()),
		findByRequestKey: vi.fn<MobileBuildsRepository["findByRequestKey"]>(
			async () => null,
		),
		findLive: vi.fn<MobileBuildsRepository["findLive"]>(async () => null),
		insertQueued: vi.fn<MobileBuildsRepository["insertQueued"]>(
			async (input) => ({
				kind: "created",
				row: buildRow({
					id: input.id,
					organizationId: input.organizationId,
				}),
			}),
		),
		listByProject: vi.fn<MobileBuildsRepository["listByProject"]>(async () => ({
			items: [buildRow()],
			nextCursor: "next-1",
		})),
		setTriggerRunId: vi.fn<MobileBuildsRepository["setTriggerRunId"]>(
			async () => undefined,
		),
		transition: vi.fn<MobileBuildsRepository["transition"]>(
			async (id, change) =>
				change.to === "failed"
					? buildRow({
							completedAt: CREATED_AT,
							errorCode: change.errorCode,
							errorMessage: change.errorMessage,
							id,
							status: "failed",
						})
					: buildRow({ completedAt: CREATED_AT, id, status: change.to }),
		),
	};
	const appCommits = {
		findBranch: vi.fn<AppCommitsRepository["findBranch"]>(async () => ({
			headSha: HEAD_SHA,
		})),
		findScopedProject: vi.fn<AppCommitsRepository["findScopedProject"]>(
			async () => mobileProject(),
		),
	};
	const auditEvents = {
		insert: vi.fn<AuditEventsRepository["insert"]>(async (input) => {
			audits.push(input);
		}),
	};
	const metering = {
		findByIdempotencyKey: vi.fn<MeteringService["findByIdempotencyKey"]>(
			async () => holdEvent(),
		),
		refund: vi.fn<MeteringService["refund"]>(async () =>
			holdEvent({ status: "refunded" }),
		),
		reserveWithReplay: vi.fn<MeteringService["reserveWithReplay"]>(
			async () => ({ event: holdEvent(), replay: "none", replayed: false }),
		),
	};
	const starter = {
		start: vi.fn<MobileBuildTaskStarter["start"]>(async () => ({
			runId: "run_1",
		})),
	};
	const runner = {
		cancel: vi.fn<EasBuildRunner["cancel"]>(async () => undefined),
		start: vi.fn<EasBuildRunner["start"]>(),
		view: vi.fn<EasBuildRunner["view"]>(),
	};
	const service = new MobileBuildsService(
		builds,
		appCommits,
		auditEvents,
		metering,
		starter,
		options.runner === "none" ? null : runner,
	);
	return {
		appCommits,
		audits,
		builds,
		metering,
		runner,
		service,
		starter,
	};
}

// Reads the status and the `code` of the envelope body of an HttpException.
async function rejection(
	promise: Promise<MobileBuild | ListMobileBuildsResponse>,
): Promise<{ code: string | null; status: number }> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof HttpException) {
			const body = error.getResponse();
			return {
				code:
					typeof body === "object" && "code" in body ? String(body.code) : null,
				status: error.getStatus(),
			};
		}
		throw error;
	}
	throw new Error("expected a rejection");
}

describe("MobileBuildsService.create", () => {
	it("holds 50 credits, writes the queued row, starts the task, and audits", async () => {
		const { audits, builds, metering, service, starter } = setup();

		const result = await service.create(ORG, PROJECT_ID, BODY, IP);

		const [, subject, estimate] =
			metering.reserveWithReplay.mock.calls[0] ?? [];
		const buildId = estimate?.attemptRef ?? "";
		expect(metering.reserveWithReplay).toHaveBeenCalledOnce();
		expect(metering.reserveWithReplay.mock.calls[0]?.[0]).toBe("mobile_build");
		expect(subject).toEqual({
			actorIsLimitExempt: true,
			actorUserId: "user_1",
			organizationId: "org_1",
		});
		expect(estimate).toEqual({
			attemptRef: buildId,
			credits: 5_000,
			idempotencyKey: `mobile_build:${buildId}`,
			projectId: PROJECT_ID,
		});
		expect(builds.insertQueued).toHaveBeenCalledWith({
			commitSha: HEAD_SHA,
			id: buildId,
			kind: "apk",
			organizationId: "org_1",
			platform: "android",
			projectId: PROJECT_ID,
			requestKey: REQUEST_KEY,
			userId: "user_1",
		});
		expect(starter.start).toHaveBeenCalledWith({
			actorIsLimitExempt: true,
			buildId,
			projectId: PROJECT_ID,
		});
		expect(builds.setTriggerRunId).toHaveBeenCalledWith(buildId, "run_1");
		expect(audits).toEqual([
			{
				action: "mobile_build.started",
				actorUserId: "user_1",
				ip: IP,
				metadata: { commitSha: HEAD_SHA, platform: "android" },
				organizationId: "org_1",
				projectId: PROJECT_ID,
				targetId: buildId,
				targetType: "mobile_build",
			},
		]);
		expect(metering.refund).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			completedAt: null,
			createdAt: "2026-09-26T10:00:00.000Z",
			id: buildId,
			status: "queued",
		});
		expect(result).not.toHaveProperty("triggerRunId");
	});

	it("answers the build of a retried request key and holds nothing", async () => {
		const { builds, metering, service } = setup();
		builds.findByRequestKey.mockResolvedValue(buildRow({ status: "building" }));

		const result = await service.create(PERSONAL, PROJECT_ID, BODY, IP);

		expect(result.status).toBe("building");
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(builds.insertQueued).not.toHaveBeenCalled();
	});

	it("answers 404 for a web app, a V1 project, and a project out of scope", async () => {
		const { appCommits, metering, service } = setup();
		appCommits.findScopedProject.mockResolvedValueOnce(
			mobileProject({ framework: "web-app" }),
		);
		appCommits.findScopedProject.mockResolvedValueOnce(
			mobileProject({ engine: "v1_page" }),
		);
		appCommits.findScopedProject.mockResolvedValueOnce(null);

		for (let call = 0; call < 3; call += 1) {
			await expect(
				service.create(PERSONAL, PROJECT_ID, BODY, IP),
			).rejects.toBeInstanceOf(NotFoundException);
		}
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("answers 503 V2_ENV_MISSING without an EAS runner", async () => {
		const { metering, service } = setup({ runner: "none" });

		expect(
			await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
		).toEqual({ code: "V2_ENV_MISSING", status: 503 });
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("answers 409 MOBILE_BUILD_NO_VERSION without a saved head", async () => {
		const { appCommits, metering, service } = setup();
		appCommits.findBranch.mockResolvedValueOnce(null);
		appCommits.findBranch.mockResolvedValueOnce({ headSha: null });

		for (let call = 0; call < 2; call += 1) {
			expect(
				await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
			).toEqual({ code: "MOBILE_BUILD_NO_VERSION", status: 409 });
		}
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("answers 409 MOBILE_BUILD_ACTIVE before the hold when a build is live", async () => {
		const { builds, metering, service } = setup();
		builds.findLive.mockResolvedValue(buildRow({ status: "building" }));

		expect(
			await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
		).toEqual({ code: "MOBILE_BUILD_ACTIVE", status: 409 });
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
	});

	it("passes the 402 through and writes no row when the hold fails", async () => {
		const { builds, metering, service, starter } = setup();
		const paymentRequired = new InsufficientCreditsError(5_000, 100);
		metering.reserveWithReplay.mockRejectedValue(paymentRequired);

		await expect(service.create(PERSONAL, PROJECT_ID, BODY, IP)).rejects.toBe(
			paymentRequired,
		);
		expect(builds.insertQueued).not.toHaveBeenCalled();
		expect(starter.start).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("refunds and answers 409 when the live index rejects the insert", async () => {
		const { builds, metering, service, starter } = setup();
		builds.insertQueued.mockResolvedValue({ kind: "live_exists" });

		expect(
			await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
		).toEqual({ code: "MOBILE_BUILD_ACTIVE", status: 409 });
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"mobile_build_create_failed",
		);
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("keeps the 409 when the compensation refund fails too", async () => {
		const { builds, metering, service } = setup();
		builds.insertQueued.mockResolvedValue({ kind: "live_exists" });
		metering.refund.mockRejectedValue(new Error("db down"));

		expect(
			await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
		).toEqual({ code: "MOBILE_BUILD_ACTIVE", status: 409 });
	});

	it("refunds its own hold and answers the row of a parallel retry", async () => {
		const { builds, metering, service, starter } = setup();
		const winner = buildRow({ id: "44444444-4444-4444-8444-444444444444" });
		builds.insertQueued.mockResolvedValue({
			kind: "request_exists",
			row: winner,
		});

		const result = await service.create(PERSONAL, PROJECT_ID, BODY, IP);

		expect(result.id).toBe(winner.id);
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"mobile_build_create_failed",
		);
		expect(starter.start).not.toHaveBeenCalled();
	});

	it("refunds and rethrows when the insert fails", async () => {
		const { builds, metering, service } = setup();
		builds.insertQueued.mockRejectedValue(new Error("insert failed"));

		await expect(
			service.create(PERSONAL, PROJECT_ID, BODY, IP),
		).rejects.toThrow("insert failed");
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"mobile_build_create_failed",
		);
	});

	it("fails the row with a fixed start_failed text and refunds when the task does not start", async () => {
		const { audits, builds, metering, service, starter } = setup();
		starter.start.mockRejectedValue(new Error("trigger down: tr_secret"));

		const result = await service.create(PERSONAL, PROJECT_ID, BODY, IP);

		expect(builds.transition).toHaveBeenCalledWith(expect.any(String), {
			errorCode: "start_failed",
			errorMessage: "The build task could not start",
			to: "failed",
		});
		expect(result).toMatchObject({
			errorCode: "start_failed",
			status: "failed",
		});
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"mobile_build_create_failed",
		);
		expect(builds.setTriggerRunId).not.toHaveBeenCalled();
		expect(audits).toEqual([]);
	});

	it("fails the row, refunds, and answers the 503 when Trigger.dev is not configured", async () => {
		const { builds, metering, service, starter } = setup();
		starter.start.mockRejectedValue(
			new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "TRIGGER_SECRET_KEY is not set",
			}),
		);

		expect(
			await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
		).toEqual({ code: "V2_ENV_MISSING", status: 503 });
		expect(builds.transition).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ errorCode: "start_failed", to: "failed" }),
		);
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"mobile_build_create_failed",
		);
	});

	it("keeps the hold when the row ended before the failed write", async () => {
		const { builds, metering, service, starter } = setup();
		starter.start.mockRejectedValue(new Error("trigger timeout"));
		builds.transition.mockResolvedValue(null);
		builds.findById.mockResolvedValue(buildRow({ status: "canceled" }));

		const result = await service.create(PERSONAL, PROJECT_ID, BODY, IP);

		expect(result.status).toBe("canceled");
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("still answers and audits when the run id write fails", async () => {
		const { audits, builds, service } = setup();
		builds.setTriggerRunId.mockRejectedValue(new Error("db blip"));

		const result = await service.create(PERSONAL, PROJECT_ID, BODY, IP);

		expect(result.status).toBe("queued");
		expect(audits).toHaveLength(1);
	});

	it("holds nothing and refunds nothing with billing off", async () => {
		Reflect.set(env, "GENERATION_BILLING_MODE", "off");
		const { builds, metering, service } = setup();
		builds.insertQueued.mockResolvedValue({ kind: "live_exists" });

		expect(
			await rejection(service.create(PERSONAL, PROJECT_ID, BODY, IP)),
		).toEqual({ code: "MOBILE_BUILD_ACTIVE", status: 409 });
		expect(metering.reserveWithReplay).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
	});
});

describe("MobileBuildsService.list and get", () => {
	it("pages the builds with the query cursor and maps the dates", async () => {
		const { builds, service } = setup();

		const page = await service.list(PERSONAL, PROJECT_ID, {
			cursor: "cursor-1",
			limit: 5,
		});

		expect(builds.listByProject).toHaveBeenCalledWith(PROJECT_ID, {
			cursor: "cursor-1",
			limit: 5,
		});
		expect(page.nextCursor).toBe("next-1");
		expect(page.items[0]?.createdAt).toBe("2026-09-26T10:00:00.000Z");
	});

	it("answers 400 VALIDATION_ERROR for a malformed cursor", async () => {
		const { builds, service } = setup();
		builds.listByProject.mockRejectedValue(
			new MalformedMobileBuildCursorError(),
		);

		expect(
			await rejection(
				service.list(PERSONAL, PROJECT_ID, { cursor: "bad", limit: 20 }),
			),
		).toEqual({ code: "VALIDATION_ERROR", status: 400 });
	});

	it("answers 404 for a build of another project", async () => {
		const { builds, service } = setup();
		builds.findById.mockResolvedValue(
			buildRow({ projectId: "55555555-5555-4555-8555-555555555555" }),
		);

		await expect(
			service.get(PERSONAL, PROJECT_ID, BUILD_ID),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("MobileBuildsService.cancel", () => {
	it("cancels the row and the EAS build, refunds the hold, and audits", async () => {
		const { audits, builds, metering, runner, service } = setup();
		builds.transition.mockResolvedValue(
			buildRow({ easBuildId: "eas_1", status: "canceled" }),
		);

		const result = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(builds.transition).toHaveBeenCalledWith(BUILD_ID, {
			to: "canceled",
		});
		expect(runner.cancel).toHaveBeenCalledWith("eas_1");
		expect(metering.findByIdempotencyKey).toHaveBeenCalledWith(
			`mobile_build:${BUILD_ID}`,
			{ actorUserId: "user_1" },
		);
		expect(metering.refund).toHaveBeenCalledWith(
			"hold_1",
			"mobile_build_canceled",
		);
		expect(audits).toEqual([
			{
				action: "mobile_build.canceled",
				actorUserId: "user_1",
				ip: IP,
				metadata: { platform: "android" },
				organizationId: null,
				projectId: PROJECT_ID,
				targetId: BUILD_ID,
				targetType: "mobile_build",
			},
		]);
		expect(result.status).toBe("canceled");
	});

	it("answers an ended build as it is and moves no money", async () => {
		const { builds, metering, runner, service } = setup();
		builds.transition.mockResolvedValue(null);
		builds.findById.mockResolvedValue(
			buildRow({ easBuildId: "eas_1", status: "finished" }),
		);

		const result = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(result.status).toBe("finished");
		expect(runner.cancel).not.toHaveBeenCalled();
		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("skips the EAS call before EAS has the build and still refunds", async () => {
		const { metering, runner, service } = setup();

		await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(runner.cancel).not.toHaveBeenCalled();
		expect(metering.refund).toHaveBeenCalledOnce();
	});

	it("still refunds and answers when the EAS cancel fails", async () => {
		const { builds, metering, runner, service } = setup();
		builds.transition.mockResolvedValue(
			buildRow({ easBuildId: "eas_1", status: "canceled" }),
		);
		runner.cancel.mockRejectedValue(new Error("EAS GraphQL answered 500"));

		const result = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(result.status).toBe("canceled");
		expect(metering.refund).toHaveBeenCalledOnce();
	});

	it("answers without an EAS call when the runner is not configured", async () => {
		const { builds, metering, service } = setup({ runner: "none" });
		builds.transition.mockResolvedValue(
			buildRow({ easBuildId: "eas_1", status: "canceled" }),
		);

		const result = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(result.status).toBe("canceled");
		expect(metering.refund).toHaveBeenCalledOnce();
	});

	it("refunds nothing when the hold is not reserved", async () => {
		const { metering, service } = setup();
		metering.findByIdempotencyKey.mockResolvedValue(
			holdEvent({ status: "refunded" }),
		);

		await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(metering.refund).not.toHaveBeenCalled();
	});

	it("still answers when the refund fails", async () => {
		const { metering, service } = setup();
		metering.refund.mockRejectedValue(new Error("db down"));

		const result = await service.cancel(PERSONAL, PROJECT_ID, BUILD_ID, IP);

		expect(result.status).toBe("canceled");
	});
});
