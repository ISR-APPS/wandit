import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";
import { ConnectorGenerationsRepository } from "./connector-generations.repository";

const ATTEMPT_ID = "55555555-5555-4555-8555-555555555555";

function setup(returned: Array<{ id: string; userId: string }>): {
	analytics: { capture: ReturnType<typeof vi.fn> };
	repository: ConnectorGenerationsRepository;
} {
	const returning = vi.fn().mockResolvedValue(returned);
	const db = {
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({ returning })),
			})),
		})),
	};
	const analytics = { capture: vi.fn() };
	const repository = new ConnectorGenerationsRepository(
		db as unknown as Database,
		analytics as unknown as AnalyticsService,
	);

	return { analytics, repository };
}

describe("ConnectorGenerationsRepository.markAttemptFailed", () => {
	it("captures trigger rejection for the attempt's owning user", async () => {
		const { analytics, repository } = setup([
			{ id: ATTEMPT_ID, userId: "owning_user" },
		]);

		await expect(
			repository.markAttemptFailed(ATTEMPT_ID, "raw Trigger error"),
		).resolves.toBe(true);
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
