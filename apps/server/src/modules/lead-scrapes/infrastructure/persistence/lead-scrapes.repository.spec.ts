import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { LeadScrapesRepository } from "./lead-scrapes.repository";

function setup(returned: Array<{ id: string }>) {
	const returning = vi.fn().mockResolvedValue(returned);
	const set = vi.fn(() => ({
		where: vi.fn(() => ({ returning })),
	}));
	const db = {
		update: vi.fn(() => ({ set })),
	};
	const repository = new LeadScrapesRepository(db as unknown as Database);

	return { repository, set };
}

describe("LeadScrapesRepository queue handoff transitions", () => {
	it("reports a queued-to-triggered run-id link", async () => {
		const { repository, set } = setup([{ id: "attempt-1" }]);

		await expect(
			repository.markAttemptTriggered("attempt-1", "run-1"),
		).resolves.toBe(true);
		expect(set).toHaveBeenCalledWith({ triggerRunId: "run-1" });
	});

	it("reports a lost run-id CAS without overwriting a live attempt", async () => {
		const { repository } = setup([]);

		await expect(
			repository.markAttemptTriggered("attempt-1", "run-1"),
		).resolves.toBe(false);
	});

	it("reports a queued-to-failed transition", async () => {
		const { repository, set } = setup([{ id: "attempt-1" }]);

		await expect(
			repository.markAttemptFailed("attempt-1", "Trigger rejected request"),
		).resolves.toBe(true);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				error: "Trigger rejected request",
				status: "failed",
			}),
		);
	});

	it("reports a lost failure CAS without overwriting running or succeeded", async () => {
		const { repository } = setup([]);

		await expect(
			repository.markAttemptFailed("attempt-1", "Trigger rejected request"),
		).resolves.toBe(false);
	});
});
