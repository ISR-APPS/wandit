import { db } from "@wandit/db";
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
const VERSION_SCOPE = { kind: "personal", userId: "user_1" } as const;

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

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

function repositoryWithReceipt(row: { number: number } | null) {
	const limit = vi.fn().mockResolvedValue(row ? [row] : []);
	const orderBy = vi.fn(() => ({ limit }));
	const where = vi.fn(() => ({ orderBy }));
	const innerJoin = vi.fn(() => ({ where }));
	const from = vi.fn(() => ({ innerJoin }));
	const select = vi.fn(() => ({ from }));
	const repository = new PagesRepository({ select } as unknown as Database, {
		capture: vi.fn(),
	});

	return { limit, repository };
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

describe("PagesRepository paginated version history", () => {
	it("compiles artifact-indexed descending pagination and its matching count", () => {
		const repository = new PagesRepository(db as Database, {
			capture: vi.fn(),
		});
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builders private.
		const page = repository["buildVersionPageQuery"]("artifact_1", {
			limit: 8,
			offset: 16,
		});
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builders private.
		const count = repository["buildVersionCountQuery"]("artifact_1");
		const pageSql = page.toSQL();
		const countSql = count.toSQL();
		const normalizedPageSql = normalizeSql(pageSql.sql);
		const normalizedCountSql = normalizeSql(countSql.sql);

		expect(normalizedPageSql).toContain('from "versions"');
		expect(normalizedPageSql).toContain('where "versions"."artifact_id" =');
		expect(normalizedPageSql).toContain(
			'order by "versions"."number" desc limit',
		);
		expect(normalizedPageSql).toContain("offset");
		expect(normalizedPageSql).not.toContain("r2_key");
		expect(pageSql.params).toEqual(["artifact_1", 8, 16]);

		expect(normalizedCountSql).toContain(
			'select count(*)::int from "versions"',
		);
		expect(normalizedCountSql).toContain('where "versions"."artifact_id" =');
		expect(countSql.params).toEqual(["artifact_1"]);
	});

	it("filters the resolved artifact, paginates, and maps draft/live pointers", async () => {
		const projectLimit = vi.fn().mockResolvedValue([{ id: "project_1" }]);
		const artifactLimit = vi
			.fn()
			.mockResolvedValue([{ activeVersionId: "version_9", id: "artifact_1" }]);
		const deploymentLimit = vi
			.fn()
			.mockResolvedValue([{ versionId: "version_8" }]);
		const offset = vi.fn().mockResolvedValue([
			{
				createdAt: new Date("2026-08-08T12:00:00.000Z"),
				id: "version_9",
				meta: { source: "inline" },
				number: 9,
			},
			{
				createdAt: new Date("2026-08-07T12:00:00.000Z"),
				id: "version_8",
				meta: { source: "builder" },
				number: 8,
			},
		]);
		const pageLimit = vi.fn(() => ({ offset }));
		const pageOrderBy = vi.fn(() => ({ limit: pageLimit }));
		const pageWhere = vi.fn((_predicate: unknown) => ({
			orderBy: pageOrderBy,
		}));
		const select = vi
			.fn()
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: projectLimit })),
				})),
			})
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: artifactLimit })),
				})),
			})
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: deploymentLimit })),
				})),
			})
			.mockReturnValueOnce({
				from: vi.fn(() => ({ where: pageWhere })),
			})
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn().mockResolvedValue([{ total: 19 }]),
				})),
			});
		const repository = new PagesRepository({ select } as unknown as Database, {
			capture: vi.fn(),
		});

		await expect(
			repository.listVersionsForProjectPaginated(VERSION_SCOPE, "project_1", {
				limit: 8,
				offset: 16,
			}),
		).resolves.toEqual({
			rows: [
				{
					createdAt: new Date("2026-08-08T12:00:00.000Z"),
					id: "version_9",
					isActive: true,
					isLive: false,
					meta: { source: "inline" },
					number: 9,
				},
				{
					createdAt: new Date("2026-08-07T12:00:00.000Z"),
					id: "version_8",
					isActive: false,
					isLive: true,
					meta: { source: "builder" },
					number: 8,
				},
			],
			total: 19,
		});
		expect(pageLimit).toHaveBeenCalledWith(8);
		expect(offset).toHaveBeenCalledWith(16);
		expect(sqlParameterValues(pageWhere.mock.calls[0]?.[0])).toEqual([
			"artifact_1",
		]);
		expect(select.mock.calls[3]?.[0]).not.toHaveProperty("r2Key");
		expect(select).toHaveBeenCalledTimes(5);
	});

	it("returns an empty list and zero count when no landing artifact exists", async () => {
		const selectResult = (rows: unknown[]) => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn().mockResolvedValue(rows),
				})),
			})),
		});
		const select = vi
			.fn()
			.mockReturnValueOnce(selectResult([{ id: "project_1" }]))
			.mockReturnValueOnce(selectResult([]))
			.mockReturnValueOnce(selectResult([{ id: "project_1" }]))
			.mockReturnValueOnce(selectResult([]));
		const repository = new PagesRepository({ select } as unknown as Database, {
			capture: vi.fn(),
		});

		await expect(
			repository.listVersionsForProjectPaginated(VERSION_SCOPE, "project_1", {
				limit: 8,
				offset: 0,
			}),
		).resolves.toEqual({ rows: [], total: 0 });
		await expect(
			repository.countVersionsForProject(VERSION_SCOPE, "project_1"),
		).resolves.toBe(0);
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

describe("PagesRepository.findAiEditVersionByReceipt", () => {
	it("returns the historical placement version", async () => {
		const { limit, repository } = repositoryWithReceipt({ number: 7 });

		await expect(
			repository.findAiEditVersionByReceipt("project-1", "attempt-1"),
		).resolves.toEqual({ number: 7 });
		expect(limit).toHaveBeenCalledWith(1);
	});

	it("returns null when no placement receipt exists", async () => {
		const { repository } = repositoryWithReceipt(null);

		await expect(
			repository.findAiEditVersionByReceipt("project-1", "attempt-1"),
		).resolves.toBeNull();
	});
});

describe("PagesRepository.insertVersionAndActivate placement receipt", () => {
	it("returns the original version under the artifact lock without inserting", async () => {
		const locked = vi
			.fn()
			.mockResolvedValue([{ activeVersionId: "newer-active-version" }]);
		const artifactLimit = vi.fn(() => ({ for: locked }));
		const receiptLimit = vi.fn().mockResolvedValue([
			{
				createdAt: new Date("2026-08-01T12:00:00.000Z"),
				id: "original-placement-version",
				number: 7,
			},
		]);
		const receiptOrderBy = vi.fn(() => ({ limit: receiptLimit }));
		const select = vi
			.fn()
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: artifactLimit })),
				})),
			})
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ orderBy: receiptOrderBy })),
				})),
			});
		const tx = {
			insert: vi.fn(),
			select,
			update: vi.fn(),
		};
		const transaction = vi.fn(
			(callback: (transactionTx: typeof tx) => unknown) => callback(tx),
		);
		const repository = new PagesRepository(
			{ transaction } as unknown as Database,
			{ capture: vi.fn() },
		);

		await expect(
			repository.insertVersionAndActivate({
				artifactId: "artifact-1",
				expectedActiveVersionId: "older-active-version",
				meta: {
					receipt: {
						attemptId: "attempt-1",
						kind: "image-generation-placement",
					},
					source: "ai-edit",
				},
				projectId: "project-1",
				receipt: {
					attemptId: "attempt-1",
					kind: "image-generation-placement",
				},
				r2Key: "pages/duplicate.html",
				versionId: "duplicate-version",
			}),
		).resolves.toEqual({
			createdAt: new Date("2026-08-01T12:00:00.000Z"),
			existingVersionId: "original-placement-version",
			number: 7,
		});

		expect(locked).toHaveBeenCalledWith("update");
		expect(receiptLimit).toHaveBeenCalledWith(1);
		expect(tx.insert).not.toHaveBeenCalled();
		expect(tx.update).not.toHaveBeenCalled();
	});
});
