import { describe, expect, it, vi } from "vitest";
import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";

import {
	PAGE_ATTEMPT_MAX_RUNTIME_MS,
	PAGE_ATTEMPT_STALE_GENERATING_MS,
	PAGE_ATTEMPT_STALE_GRACE_MS,
	PAGE_ATTEMPT_STALE_QUEUED_MS,
	PAGE_ATTEMPT_TRIGGER_TTL_MS,
	PagesRepository,
} from "./pages.repository";

function repositoryWithVersions(
	rows: Array<{ id: string; meta: unknown; r2Key: string }>,
) {
	const orderBy = vi.fn().mockResolvedValue(rows);
	const where = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const analytics = { capture: vi.fn() };
	const repository = new PagesRepository(
		{ select } as unknown as Database,
		analytics as unknown as AnalyticsService,
	);

	return { repository, select };
}

const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";

function repositoryWithAttemptUpdate(returned: unknown[]) {
	const returning = vi.fn().mockResolvedValue(returned);
	const where = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	const analytics = { capture: vi.fn() };
	const repository = new PagesRepository(
		{ update } as unknown as Database,
		analytics as unknown as AnalyticsService,
	);

	return { analytics, repository, returning, set, where };
}

function expectQueuedAttemptPredicate(where: ReturnType<typeof vi.fn>): void {
	expect(sqlParameterValues(where.mock.calls[0]?.[0])).toEqual([
		ATTEMPT_ID,
		"queued",
	]);
}

function sqlParameterValues(value: unknown): unknown[] {
	if (Array.isArray(value)) {
		return value.flatMap(sqlParameterValues);
	}

	if (typeof value !== "object" || value === null) {
		return [];
	}

	if (value.constructor.name === "Param" && "value" in value) {
		return [value.value];
	}

	if ("queryChunks" in value && Array.isArray(value.queryChunks)) {
		return value.queryChunks.flatMap(sqlParameterValues);
	}

	return [];
}

describe("PagesRepository.findLatestBuilderVersion", () => {
	it("skips newer edit rows and returns the newest explicit builder row", async () => {
		const { repository } = repositoryWithVersions([
			{ id: "v5", meta: { source: "theme" }, r2Key: "theme" },
			{ id: "v4", meta: { source: "restore" }, r2Key: "restore" },
			{ id: "v3", meta: { source: "ai-edit" }, r2Key: "ai" },
			{ id: "v2", meta: { source: "builder" }, r2Key: "builder-new" },
			{ id: "v1", meta: { source: "builder" }, r2Key: "builder-old" },
		]);

		await expect(
			repository.findLatestBuilderVersion("artifact-1"),
		).resolves.toEqual({ id: "v2", r2Key: "builder-new" });
	});

	it("treats absent or null source metadata as legacy builder origin", async () => {
		const { repository } = repositoryWithVersions([
			{ id: "v4", meta: { source: "inline" }, r2Key: "inline" },
			{ id: "v3", meta: { source: "invalid" }, r2Key: "invalid" },
			{ id: "v2", meta: {}, r2Key: "legacy" },
			{ id: "v1", meta: { source: "builder" }, r2Key: "builder" },
		]);

		await expect(
			repository.findLatestBuilderVersion("artifact-1"),
		).resolves.toEqual({ id: "v2", r2Key: "legacy" });
	});

	it("returns null when no builder-origin row exists", async () => {
		const { repository } = repositoryWithVersions([
			{ id: "v2", meta: { source: "theme" }, r2Key: "theme" },
			{ id: "v1", meta: { source: "ai-edit" }, r2Key: "ai" },
		]);

		await expect(
			repository.findLatestBuilderVersion("artifact-1"),
		).resolves.toBeNull();
	});
});

describe("PagesRepository page-attempt queue CAS", () => {
	it("links a Trigger run only while the attempt is still queued", async () => {
		const { repository, where } = repositoryWithAttemptUpdate([
			{ id: ATTEMPT_ID },
		]);

		await expect(
			repository.markAttemptTriggered(ATTEMPT_ID, "run_1"),
		).resolves.toBe(true);
		expectQueuedAttemptPredicate(where);
	});

	it("reports a lost run-id CAS without overwriting a claimed attempt", async () => {
		const { repository, where } = repositoryWithAttemptUpdate([]);

		await expect(
			repository.markAttemptTriggered(ATTEMPT_ID, "run_1"),
		).resolves.toBe(false);
		expectQueuedAttemptPredicate(where);
	});

	it("fails only a queued attempt after definitive Trigger rejection", async () => {
		const { repository, where } = repositoryWithAttemptUpdate([
			{ projectId: "project_1" },
		]);

		await expect(
			repository.markAttemptFailed(
				ATTEMPT_ID,
				"definitive rejection",
				"user_1",
			),
		).resolves.toBe(true);
		expectQueuedAttemptPredicate(where);
	});

	it("reports a lost failure CAS without emitting failure analytics", async () => {
		const { analytics, repository, where } = repositoryWithAttemptUpdate([]);

		await expect(
			repository.markAttemptFailed(
				ATTEMPT_ID,
				"definitive rejection",
				"user_1",
			),
		).resolves.toBe(false);
		expectQueuedAttemptPredicate(where);
		expect(analytics.capture).not.toHaveBeenCalled();
	});
});

describe("PagesRepository page-attempt stale windows", () => {
	it("keeps generating rows live for queue wait, runtime, and commit grace", () => {
		expect(PAGE_ATTEMPT_STALE_QUEUED_MS).toBe(
			PAGE_ATTEMPT_TRIGGER_TTL_MS + PAGE_ATTEMPT_STALE_GRACE_MS,
		);
		expect(PAGE_ATTEMPT_STALE_GENERATING_MS).toBe(
			PAGE_ATTEMPT_TRIGGER_TTL_MS +
				PAGE_ATTEMPT_MAX_RUNTIME_MS +
				PAGE_ATTEMPT_STALE_GRACE_MS,
		);
		expect(PAGE_ATTEMPT_STALE_GENERATING_MS).toBe(70 * 60 * 1000);
	});
});
