import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { PagesRepository } from "../../infrastructure/persistence/pages.repository";
import { PagesService } from "./pages.service";

// R2 is a network dependency — replace the storage module so tests control
// what "the bucket" returns without credentials.
vi.mock("../../../../infrastructure/storage/r2", () => ({
	getPageHtml: vi.fn(),
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

// The attempt lifecycle talks to Trigger.dev twice (cancel a run, queue a
// retry). Both are network dependencies — mocked so tests stay hermetic.
vi.mock("@trigger.dev/sdk", () => ({
	runs: { cancel: vi.fn() },
}));

vi.mock("../page-build-handoff", () => ({
	isDefinitiveTriggerRejection: vi.fn(() => false),
	mintRealtimeHandle: vi.fn(async () => ({
		publicAccessToken: "tok_2",
		runId: "run_2",
	})),
	triggerGeneratePageTask: vi.fn(async () => ({ id: "run_2" })),
}));

vi.mock("@wandit/env/server", () => ({
	env: { TRIGGER_SECRET_KEY: "tr_sk_test" },
}));

import { runs } from "@trigger.dev/sdk";
import { triggerGeneratePageTask } from "../page-build-handoff";

const SCOPE: ProjectScope = { kind: "personal", userId: "user_1" };

function attemptRow(overrides: Record<string, unknown> = {}) {
	return {
		completedAt: null,
		createdAt: new Date("2026-08-07T10:00:00.000Z"),
		dismissedAt: null,
		error: null,
		failureCode: null,
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		lastProgressPercent: null,
		status: "generating" as const,
		triggerRunId: "run_1",
		versionId: null,
		...overrides,
	};
}

function setup() {
	const pagesRepository = {
		cancelAttempt: vi.fn(),
		dismissAttempt: vi.fn(),
		findAccessibleVersionById: vi.fn(),
		findAttemptDetail: vi.fn(),
		findOverviewByProject: vi.fn(),
		countVersionsForProject: vi.fn(),
		listVersionsForProject: vi.fn(),
		listVersionsForProjectPaginated: vi.fn(),
		markAttemptFailed: vi.fn(),
		markAttemptTriggered: vi.fn(),
		resetAttemptForRetry: vi.fn(),
	};
	const service = new PagesService(
		pagesRepository as unknown as PagesRepository,
	);

	return { pagesRepository, service };
}

beforeEach(() => {
	vi.mocked(getPageHtml).mockReset();
});

describe("PagesService", () => {
	it("maps overview rows to the contract shape with ISO dates", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOverviewByProject.mockResolvedValue({
			activeVersion: {
				createdAt: new Date("2026-07-11T10:00:00.000Z"),
				id: "22222222-2222-4222-8222-222222222222",
				number: 3,
			},
			artifactId: "11111111-1111-4111-8111-111111111111",
			latestAttempt: {
				createdAt: new Date("2026-07-11T11:00:00.000Z"),
				error: null,
				failureCode: null,
				id: "33333333-3333-4333-8333-333333333333",
				status: "generating" as const,
				versionId: null,
			},
		});

		await expect(service.overview(SCOPE, "project_1")).resolves.toEqual({
			activeVersion: {
				createdAt: "2026-07-11T10:00:00.000Z",
				id: "22222222-2222-4222-8222-222222222222",
				number: 3,
			},
			artifactId: "11111111-1111-4111-8111-111111111111",
			latestAttempt: {
				createdAt: "2026-07-11T11:00:00.000Z",
				error: null,
				failureCode: null,
				id: "33333333-3333-4333-8333-333333333333",
				status: "generating",
				versionId: null,
			},
		});
	});

	it("maps an attempt row to the contract shape", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAttemptDetail.mockResolvedValue(
			attemptRow({
				completedAt: new Date("2026-08-07T10:05:00.000Z"),
				dismissedAt: new Date("2026-08-07T10:06:00.000Z"),
				failureCode: "provider_rate_limited",
				lastProgressPercent: 62,
				status: "failed" as const,
			}),
		);

		await expect(
			service.attemptDetail(SCOPE, "project_1", "attempt_1"),
		).resolves.toEqual({
			completedAt: "2026-08-07T10:05:00.000Z",
			createdAt: "2026-08-07T10:00:00.000Z",
			dismissed: true,
			error: null,
			failureCode: "provider_rate_limited",
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			lastProgressPercent: 62,
			status: "failed",
			triggerRunId: "run_1",
			versionId: null,
		});
	});

	it("degrades an unknown stored failure code to null instead of failing", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAttemptDetail.mockResolvedValue(
			attemptRow({
				failureCode: "some_future_code",
				status: "failed" as const,
			}),
		);

		const detail = await service.attemptDetail(SCOPE, "project_1", "attempt_1");

		expect(detail.failureCode).toBeNull();
	});

	it("404s the attempt when the project is not owned", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAttemptDetail.mockResolvedValue(null);

		await expect(
			service.attemptDetail(SCOPE, "project_1", "attempt_x"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("stops a running attempt and cancels its Trigger run", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAttemptDetail
			.mockResolvedValueOnce(attemptRow())
			.mockResolvedValueOnce(
				attemptRow({
					completedAt: new Date("2026-08-07T10:07:00.000Z"),
					lastProgressPercent: 62,
					status: "canceled" as const,
				}),
			);
		pagesRepository.cancelAttempt.mockResolvedValue({ triggerRunId: "run_1" });

		const detail = await service.stopAttempt(SCOPE, "project_1", "attempt_1", {
			observedPercent: 62,
		});

		expect(pagesRepository.cancelAttempt).toHaveBeenCalledWith("attempt_1", 62);
		expect(runs.cancel).toHaveBeenCalledWith("run_1");
		expect(detail.status).toBe("canceled");
		expect(detail.lastProgressPercent).toBe(62);
	});

	it("answers with current truth when the attempt already settled (no cancel)", async () => {
		const { pagesRepository, service } = setup();
		vi.mocked(runs.cancel).mockClear();
		pagesRepository.findAttemptDetail.mockResolvedValue(
			attemptRow({ status: "succeeded" as const }),
		);
		pagesRepository.cancelAttempt.mockResolvedValue(null);

		const detail = await service.stopAttempt(
			SCOPE,
			"project_1",
			"attempt_1",
			{},
		);

		expect(runs.cancel).not.toHaveBeenCalled();
		expect(detail.status).toBe("succeeded");
	});

	it("retries a failed attempt on a fresh nonced run with a fresh handle", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAttemptDetail
			.mockResolvedValueOnce(attemptRow({ status: "failed" as const }))
			.mockResolvedValueOnce(attemptRow({ status: "queued" as const }));
		pagesRepository.resetAttemptForRetry.mockResolvedValue(true);
		pagesRepository.markAttemptTriggered.mockResolvedValue(true);

		const response = await service.retryAttempt(
			SCOPE,
			"project_1",
			"attempt_1",
		);

		expect(pagesRepository.resetAttemptForRetry).toHaveBeenCalledWith(
			"attempt_1",
		);
		expect(triggerGeneratePageTask).toHaveBeenCalledWith(
			expect.objectContaining({
				actorUserId: "user_1",
				attemptId: "attempt_1",
				idempotencyNonce: expect.any(String),
				projectId: "project_1",
			}),
		);
		expect(pagesRepository.markAttemptTriggered).toHaveBeenCalledWith(
			"attempt_1",
			"run_2",
		);
		expect(response.attempt.status).toBe("queued");
		expect(response.realtime).toEqual({
			publicAccessToken: "tok_2",
			runId: "run_2",
		});
	});

	it("does not queue a second run when the retry CAS loses (double-click)", async () => {
		const { pagesRepository, service } = setup();
		vi.mocked(triggerGeneratePageTask).mockClear();
		pagesRepository.findAttemptDetail.mockResolvedValue(attemptRow());
		pagesRepository.resetAttemptForRetry.mockResolvedValue(false);

		const response = await service.retryAttempt(
			SCOPE,
			"project_1",
			"attempt_1",
		);

		expect(triggerGeneratePageTask).not.toHaveBeenCalled();
		expect(response.realtime).toBeUndefined();
		expect(response.attempt.status).toBe("generating");
	});

	it("dismisses a terminal attempt", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAttemptDetail
			.mockResolvedValueOnce(attemptRow({ status: "canceled" as const }))
			.mockResolvedValueOnce(
				attemptRow({
					dismissedAt: new Date("2026-08-07T10:08:00.000Z"),
					status: "canceled" as const,
				}),
			);
		pagesRepository.dismissAttempt.mockResolvedValue(true);

		const detail = await service.dismissAttempt(
			SCOPE,
			"project_1",
			"attempt_1",
		);

		expect(pagesRepository.dismissAttempt).toHaveBeenCalledWith("attempt_1");
		expect(detail.dismissed).toBe(true);
	});

	it("404s the overview when the project is not owned", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOverviewByProject.mockResolvedValue(null);

		await expect(service.overview(SCOPE, "project_x")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("returns the version html from storage", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			id: "44444444-4444-4444-8444-444444444444",
			r2Key: "sites/project_1/version_1/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(
			'<!doctype html><html><body><section data-wid="hero"><span>Price: <em>now</em></span></section></body></html>',
		);

		const response = await service.versionHtml(SCOPE, "version_1");

		expect(response.versionId).toBe("44444444-4444-4444-8444-444444444444");
		expect(response.html).toMatch(
			/<span data-wid="e-\d+">Price: <em>now<\/em><\/span>/,
		);
		expect(getPageHtml).toHaveBeenCalledWith(
			"sites/project_1/version_1/index.html",
		);
	});

	it("maps valid version sources and defaults legacy or invalid metadata to null", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.listVersionsForProject.mockResolvedValue([
			{
				createdAt: new Date("2026-07-31T10:00:00.000Z"),
				id: "11111111-1111-4111-8111-111111111111",
				isLive: false,
				meta: { source: "builder" },
				number: 3,
			},
			{
				createdAt: new Date("2026-07-31T09:00:00.000Z"),
				id: "22222222-2222-4222-8222-222222222222",
				isLive: false,
				meta: { source: "unknown" },
				number: 2,
			},
			{
				createdAt: new Date("2026-07-31T08:00:00.000Z"),
				id: "33333333-3333-4333-8333-333333333333",
				isLive: true,
				meta: {},
				number: 1,
			},
		]);

		const response = await service.listVersions(SCOPE, "project_1");

		expect(response.versions.map((version) => version.source)).toEqual([
			"builder",
			null,
			null,
		]);
		expect(response.versions.map((version) => version.isBuilderOrigin)).toEqual(
			[true, false, true],
		);
	});

	it("paginates versions and maps active and live pointers independently", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.listVersionsForProjectPaginated.mockResolvedValue({
			rows: [
				{
					createdAt: new Date("2026-08-07T12:00:00.000Z"),
					id: "11111111-1111-4111-8111-111111111111",
					isActive: true,
					isLive: false,
					meta: { builderSummary: "Current draft", source: "inline" },
					number: 9,
				},
				{
					createdAt: new Date("2026-08-06T12:00:00.000Z"),
					id: "22222222-2222-4222-8222-222222222222",
					isActive: false,
					isLive: true,
					meta: { source: "builder" },
					number: 8,
				},
			],
			total: 19,
		});

		const response = await service.listVersionsPaginated(SCOPE, "project_1", {
			page: 3,
			pageSize: 8,
		});

		expect(
			pagesRepository.listVersionsForProjectPaginated,
		).toHaveBeenCalledWith(SCOPE, "project_1", { limit: 8, offset: 16 });
		expect(response).toEqual({
			items: [
				{
					createdAt: "2026-08-07T12:00:00.000Z",
					id: "11111111-1111-4111-8111-111111111111",
					isActive: true,
					isBuilderOrigin: false,
					isLive: false,
					label: "Current draft",
					number: 9,
					source: "inline",
				},
				{
					createdAt: "2026-08-06T12:00:00.000Z",
					id: "22222222-2222-4222-8222-222222222222",
					isActive: false,
					isBuilderOrigin: true,
					isLive: true,
					label: null,
					number: 8,
					source: "builder",
				},
			],
			page: 3,
			pageSize: 8,
			total: 19,
		});
		expect(response.items[0]).not.toHaveProperty("r2Key");
	});

	it("returns an empty page when the project has no landing artifact", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.listVersionsForProjectPaginated.mockResolvedValue({
			rows: [],
			total: 0,
		});

		await expect(
			service.listVersionsPaginated(SCOPE, "project_1", {
				page: 1,
				pageSize: 8,
			}),
		).resolves.toEqual({ items: [], page: 1, pageSize: 8, total: 0 });
	});

	it("keeps the cheap count in parity with the full version history", async () => {
		const { pagesRepository, service } = setup();
		const rows = [1, 2, 3].map((number) => ({
			createdAt: new Date(`2026-08-0${number}T12:00:00.000Z`),
			id: `version_${number}`,
			isLive: false,
			meta: null,
			number,
		}));
		pagesRepository.listVersionsForProject.mockResolvedValue(rows);
		pagesRepository.countVersionsForProject.mockResolvedValue(rows.length);

		const [history, total] = await Promise.all([
			service.listVersions(SCOPE, "project_1"),
			service.countVersions(SCOPE, "project_1"),
		]);

		expect(total).toBe(history.versions.length);
		expect(total).toBe(3);
	});

	it("404s paginated versions when the project is inaccessible", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.listVersionsForProjectPaginated.mockResolvedValue(null);

		await expect(
			service.listVersionsPaginated(SCOPE, "missing_project", {
				page: 1,
				pageSize: 8,
			}),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("404s the version html when the version is unknown or not owned", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAccessibleVersionById.mockResolvedValue(null);

		await expect(
			service.versionHtml(SCOPE, "version_x"),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(getPageHtml).not.toHaveBeenCalled();
	});

	it("404s the version html when the object is missing in storage", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			id: "44444444-4444-4444-8444-444444444444",
			r2Key: "sites/project_1/version_1/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(null);

		await expect(
			service.versionHtml(SCOPE, "version_1"),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
