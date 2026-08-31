import { db } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

const sentryMocks = vi.hoisted(() => ({
	captureException: vi.fn(() => "sentry-event-id"),
	warn: vi.fn(),
}));

vi.mock("@wandit/observability/node", () => ({
	Sentry: {
		captureException: sentryMocks.captureException,
		logger: { info: vi.fn(), warn: sentryMocks.warn },
	},
}));

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	CONNECTOR_ATTEMPT_STALE_MS,
	ConnectorGenerationsRepository,
	PERSONAL_CLIPPER_ATTEMPT_STALE_MS,
} from "./connector-generations.repository";

const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";

it("keeps the normal and Personal Clipper stale windows tool-scoped", () => {
	expect(CONNECTOR_ATTEMPT_STALE_MS).toBe(38 * 60 * 1000);
	expect(PERSONAL_CLIPPER_ATTEMPT_STALE_MS).toBe(68 * 60 * 1000);
});

type Rendered = { params: unknown[]; sql: string };

function render(query: unknown): Rendered {
	const dialect = (
		db as unknown as { dialect: { sqlToQuery(query: unknown): Rendered } }
	).dialect;
	const rendered = dialect.sqlToQuery(query);

	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

describe("ConnectorGenerationsRepository stale attempt janitor", () => {
	it("protects a 60-minute clipper row while a 40-minute generate_video row is stale", async () => {
		const updateWheres: unknown[] = [];
		const updateValues: unknown[] = [];
		const update = vi.fn(() => ({
			set: vi.fn((values: unknown) => {
				updateValues.push(values);
				return {
					where: vi.fn((where: unknown) => {
						updateWheres.push(where);
						return {
							returning: vi.fn().mockResolvedValue([
								{
									id: ATTEMPT_ID,
									toolName: "generate_video",
									userId: "user-1",
								},
							]),
						};
					}),
				};
			}),
		}));
		const select = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
			})),
		}));
		const repository = new ConnectorGenerationsRepository(
			{ select, update } as unknown as Database,
			{ capture: vi.fn() } as unknown as AnalyticsService,
		);
		const now = Date.parse("2026-08-02T12:00:00.000Z");
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

		try {
			await repository.findAccessibleAttempt(
				{ kind: "personal", userId: "user-1" },
				ATTEMPT_ID,
			);
		} finally {
			nowSpy.mockRestore();
		}

		const where = render(updateWheres[0]);
		const clipperToolParam = where.params.indexOf("personal_clipper_create");
		const normalToolParam = where.params.indexOf(
			"personal_clipper_create",
			clipperToolParam + 1,
		);
		const clipperCutoff = Date.parse(
			String(where.params[clipperToolParam + 1]),
		);
		const normalCutoff = Date.parse(String(where.params[normalToolParam + 1]));

		expect(where.sql).toContain(
			'"connector_generation_attempts"."tool_name" = $4 and "connector_generation_attempts"."created_at" < $5',
		);
		expect(where.sql).toContain(
			'"connector_generation_attempts"."tool_name" <> $6 and "connector_generation_attempts"."created_at" < $7',
		);
		expect(where.sql).toContain(
			'"connector_generation_attempts"."created_at" < $5) or ("connector_generation_attempts"."tool_name" <> $6',
		);
		expect(clipperCutoff).toBe(now - PERSONAL_CLIPPER_ATTEMPT_STALE_MS);
		expect(normalCutoff).toBe(now - CONNECTOR_ATTEMPT_STALE_MS);

		const isStale = (toolName: string, ageMs: number) =>
			now - ageMs <
			(toolName === "personal_clipper_create" ? clipperCutoff : normalCutoff);

		expect(isStale("personal_clipper_create", 60 * 60_000)).toBe(false);
		expect(isStale("generate_video", 40 * 60_000)).toBe(true);
		expect(updateValues[0]).toEqual(
			expect.objectContaining({
				error: "The generation stopped before finishing.",
				failureKind: "internal",
				failureProvider: null,
				failureProviderMessage: null,
				failureSource: "ours",
			}),
		);
		expect(updateValues[1]).toEqual({ sentryEventId: "sentry-event-id" });
	});
});

function setup(returned: Array<{ id: string; userId: string }>): {
	analytics: { capture: ReturnType<typeof vi.fn> };
	repository: ConnectorGenerationsRepository;
	set: ReturnType<typeof vi.fn>;
} {
	const returning = vi.fn().mockResolvedValue(returned);
	const set = vi.fn(() => ({
		where: vi.fn(() => ({ returning })),
	}));
	const db = {
		update: vi.fn(() => ({
			set,
		})),
	};
	const analytics = { capture: vi.fn() };
	const repository = new ConnectorGenerationsRepository(
		db as unknown as Database,
		analytics as unknown as AnalyticsService,
	);

	return { analytics, repository, set };
}

describe("ConnectorGenerationsRepository.markAttemptFailed", () => {
	it("captures trigger rejection for the attempt's owning user", async () => {
		const { analytics, repository, set } = setup([
			{ id: ATTEMPT_ID, userId: "owning_user" },
		]);

		await expect(
			repository.markAttemptFailed(ATTEMPT_ID, "raw Trigger error"),
		).resolves.toBe(true);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				error: "Something went wrong on our side. Please try again.",
				failureKind: "internal",
				failureProvider: null,
				failureProviderMessage: null,
				failureSource: "ours",
			}),
		);
		expect(set).not.toHaveBeenCalledWith(
			expect.objectContaining({ error: "raw Trigger error" }),
		);
		expect(set).toHaveBeenCalledWith({ sentryEventId: "sentry-event-id" });
		expect(analytics.capture).toHaveBeenCalledWith(
			"owning_user",
			"generation_failed",
			{
				generationId: ATTEMPT_ID,
				kind: "connector",
				projectId: null,
				reason: "trigger_rejected",
			},
		);
	});

	it("does not capture when the queued-status CAS loses", async () => {
		const { analytics, repository } = setup([]);

		await expect(
			repository.markAttemptFailed(ATTEMPT_ID, "raw Trigger error"),
		).resolves.toBe(false);
		expect(analytics.capture).not.toHaveBeenCalled();
	});
});

describe("ConnectorGenerationsRepository.insertAttempt request idempotency", () => {
	function setupInsert(
		inserted: Array<{ id: string; status: string }>,
		existing: Array<{ id: string; status: string }>,
	) {
		const onConflictDoNothing = vi.fn(() => ({
			returning: vi.fn().mockResolvedValue(inserted),
		}));
		const values = vi.fn(() => ({ onConflictDoNothing }));
		const where = vi.fn(() => ({ limit: vi.fn().mockResolvedValue(existing) }));
		const db = {
			insert: vi.fn(() => ({ values })),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
		};
		const repository = new ConnectorGenerationsRepository(
			db as unknown as Database,
			{ capture: vi.fn() } as unknown as AnalyticsService,
		);

		return { db, onConflictDoNothing, repository, values, where };
	}

	const input = {
		args: { prompt: "a cat" },
		chatId: "chat-1",
		connectorSlug: "higgsfield",
		organizationId: null,
		requestKey: "b".repeat(64),
		toolName: "generate_image",
		userId: "user-1",
	};

	it("creates the attempt on the (chatId, requestKey) target", async () => {
		const { db, onConflictDoNothing, repository, values } = setupInsert(
			[{ id: ATTEMPT_ID, status: "queued" }],
			[],
		);

		await expect(repository.insertAttempt(input)).resolves.toEqual({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		expect(values).toHaveBeenCalledWith(input);
		expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
		expect(db.select).not.toHaveBeenCalled();
	});

	it("returns the existing attempt with created:false on a conflict", async () => {
		const { repository, where } = setupInsert(
			[],
			[{ id: ATTEMPT_ID, status: "succeeded" }],
		);

		await expect(repository.insertAttempt(input)).resolves.toEqual({
			created: false,
			id: ATTEMPT_ID,
			status: "succeeded",
		});
		expect(where).toHaveBeenCalledTimes(1);
	});

	it("looks the conflict row up with an IS NULL chat predicate when chatId is null", async () => {
		const { repository, where } = setupInsert(
			[],
			[{ id: ATTEMPT_ID, status: "queued" }],
		);

		await expect(
			repository.insertAttempt({ ...input, chatId: null }),
		).resolves.toMatchObject({ created: false, id: ATTEMPT_ID });
		expect(where).toHaveBeenCalledTimes(1);
	});
});
