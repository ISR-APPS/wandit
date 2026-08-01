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
