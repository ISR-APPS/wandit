import { describe, expect, it, vi } from "vitest";

import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";
import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { MediaGenerationsRepository } from "./media-generations.repository";

function setup(
	returnedRows: Array<{ kind: "video-edit"; projectId: string }>,
	actorUserId: string | null = "original_queue_actor_1",
) {
	const returning = vi.fn().mockResolvedValue(returnedRows);
	const updateWhere = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set }));
	const limit = vi
		.fn()
		.mockResolvedValue(actorUserId ? [{ userId: actorUserId }] : []);
	const selectWhere = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where: selectWhere }));
	const select = vi.fn(() => ({ from }));
	const transactionClient = { select, update };
	const transaction = vi.fn(
		async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
			callback(transactionClient),
	);
	const capture = vi.fn();
	const enqueue = vi.fn().mockResolvedValue(null);
	const repository = new MediaGenerationsRepository(
		{ transaction } as unknown as Database,
		{ capture } as unknown as AnalyticsService,
		{ enqueue } as unknown as LifecycleEventsService,
	);

	return { capture, enqueue, repository, transactionClient };
}

describe("MediaGenerationsRepository lifecycle recovery", () => {
	it("atomically enqueues video_generated for the durable queue actor", async () => {
		const projectId = "22222222-2222-4222-8222-222222222222";
		const { capture, enqueue, repository, transactionClient } = setup([
			{ kind: "video-edit", projectId },
		]);

		await expect(
			repository.markGeneratingAttemptSucceeded(
				"11111111-1111-4111-8111-111111111111",
				"https://assets.example.com/video.mp4",
				"video/mp4",
			),
		).resolves.toBe(true);

		expect(enqueue).toHaveBeenCalledExactlyOnceWith(
			{
				event: "video_generated",
				idempotencyKey: "video_generated:original_queue_actor_1",
				userId: "original_queue_actor_1",
			},
			transactionClient,
		);
		expect(capture).toHaveBeenCalledWith(
			"original_queue_actor_1",
			"generation_completed",
			{
				generationId: "11111111-1111-4111-8111-111111111111",
				kind: "video",
				projectId,
			},
		);
	});

	it("does not enqueue when the guarded success update loses", async () => {
		const { enqueue, repository } = setup([]);

		await expect(
			repository.markGeneratingAttemptSucceeded(
				"11111111-1111-4111-8111-111111111111",
				"https://assets.example.com/video.mp4",
				"video/mp4",
			),
		).resolves.toBe(false);

		expect(enqueue).not.toHaveBeenCalled();
	});

	it("never substitutes the poller or project creator when metering has no actor", async () => {
		const projectId = "22222222-2222-4222-8222-222222222222";
		const { capture, enqueue, repository } = setup(
			[{ kind: "video-edit", projectId }],
			null,
		);

		await expect(
			repository.markGeneratingAttemptSucceeded(
				"11111111-1111-4111-8111-111111111111",
				"https://assets.example.com/video.mp4",
				"video/mp4",
			),
		).resolves.toBe(true);

		expect(enqueue).not.toHaveBeenCalled();
		expect(capture).not.toHaveBeenCalled();
	});

	it("propagates an unexpected lifecycle failure without firing analytics", async () => {
		const projectId = "22222222-2222-4222-8222-222222222222";
		const { capture, enqueue, repository } = setup([
			{ kind: "video-edit", projectId },
		]);
		enqueue.mockRejectedValueOnce(new Error("lifecycle insert failed"));

		await expect(
			repository.markGeneratingAttemptSucceeded(
				"11111111-1111-4111-8111-111111111111",
				"https://assets.example.com/video.mp4",
				"video/mp4",
			),
		).rejects.toThrow("lifecycle insert failed");

		expect(capture).not.toHaveBeenCalled();
	});
});
