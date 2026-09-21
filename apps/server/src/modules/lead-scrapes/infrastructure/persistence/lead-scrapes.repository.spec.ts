import { LEAD_SCRAPE_FAILED_REFUNDED_TEXT } from "@wandit/contracts";
import { sql } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { LeadScrapesRepository } from "./lead-scrapes.repository";

function setup(returned: Array<{ id: string }>) {
	const returning = vi.fn().mockResolvedValue(returned);
	const limit = vi.fn().mockResolvedValue([]);
	const set = vi.fn(() => ({
		where: vi.fn(() => ({ returning })),
	}));
	const db = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({ limit })),
				})),
				// The stale sweep's owned-projects subquery is never executed;
				// a SQL fragment is all inArray() needs to build the update.
				where: vi.fn(() => sql`"projects"."id"`),
			})),
		})),
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

	it("settles a dead run with a failed CAS write", async () => {
		const { repository, set } = setup([{ id: "attempt-1" }]);

		await expect(
			repository.settleDeadRun("attempt-1", "run-1", "run died"),
		).resolves.toBe(true);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				error: "run died",
				status: "failed",
			}),
		);
	});

	it("reports a lost dead-run CAS", async () => {
		const { repository } = setup([]);

		await expect(
			repository.settleDeadRun("attempt-1", "run-1", "run died"),
		).resolves.toBe(false);
	});
});

describe("LeadScrapesRepository stale-read self-heal", () => {
	it("fails stale attempts with the refunded sentence", async () => {
		const { repository, set } = setup([]);

		await expect(
			repository.findAccessibleAttempt(
				{ kind: "personal", userId: "user-1" },
				"attempt-1",
			),
		).resolves.toBeNull();
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				error: LEAD_SCRAPE_FAILED_REFUNDED_TEXT,
				status: "failed",
			}),
		);
	});
});

describe("LeadScrapesRepository.insertAttempt request idempotency", () => {
	function setupInsert(
		inserted: Array<{ id: string; status: string }>,
		existing: Array<{ id: string; status: string }>,
	) {
		const onConflictDoNothing = vi.fn(() => ({
			returning: vi.fn().mockResolvedValue(inserted),
		}));
		const values = vi.fn(() => ({ onConflictDoNothing }));
		const limit = vi.fn().mockResolvedValue(existing);
		const db = {
			insert: vi.fn(() => ({ values })),
			select: vi.fn(() => ({
				from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
			})),
		};
		const repository = new LeadScrapesRepository(db as unknown as Database);

		return { db, onConflictDoNothing, repository, values };
	}

	const input = {
		chatId: "chat-1",
		projectId: "project-1",
		requestKey: "a".repeat(64),
		spec: {
			countryCode: null,
			limit: 10,
			location: null,
			query: "plumbers",
			sources: ["google-maps" as const],
			version: 1 as const,
		},
	};

	it("creates the attempt on the (chatId, requestKey) target", async () => {
		const { db, onConflictDoNothing, repository, values } = setupInsert(
			[{ id: "attempt-1", status: "queued" }],
			[],
		);

		await expect(repository.insertAttempt(input)).resolves.toEqual({
			created: true,
			id: "attempt-1",
			status: "queued",
		});
		expect(values).toHaveBeenCalledWith(input);
		expect(onConflictDoNothing).toHaveBeenCalledWith({
			target: expect.arrayContaining([expect.anything(), expect.anything()]),
		});
		expect(db.select).not.toHaveBeenCalled();
	});

	it("returns the existing attempt with created:false on a conflict", async () => {
		const { repository } = setupInsert(
			[],
			[{ id: "attempt-existing", status: "running" }],
		);

		await expect(repository.insertAttempt(input)).resolves.toEqual({
			created: false,
			id: "attempt-existing",
			status: "running",
		});
	});

	it("fails loudly when the conflict row cannot be read back", async () => {
		const { repository } = setupInsert([], []);

		await expect(repository.insertAttempt(input)).rejects.toThrow(
			"Lead scrape idempotency conflict did not return an attempt",
		);
	});
});
