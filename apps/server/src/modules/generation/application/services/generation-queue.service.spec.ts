import { getQueueToken } from "@nestjs/bullmq";
import type { ModuleRef } from "@nestjs/core";
import { env } from "@wandit/env/server";
import type { AiGenerationJobData } from "@wandit/jobs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	GenerationQueueOutcomeUnknownError,
	GenerationQueueService,
} from "./generation-queue.service";

function setup() {
	const queue = {
		add: vi.fn(),
		getJob: vi.fn(),
	};
	const moduleRef = {
		get: vi.fn(() => queue),
	};
	const service = new GenerationQueueService(moduleRef as unknown as ModuleRef);

	return { moduleRef, queue, service };
}

beforeEach(() => {
	(env as { QUEUE_ENABLED: boolean }).QUEUE_ENABLED = true;
});

describe("GenerationQueueService", () => {
	it("uses the stable operation id for the BullMQ job", async () => {
		const { moduleRef, queue, service } = setup();
		queue.add.mockResolvedValue({ id: "job_1" });

		await expect(service.enqueueGenerateCopy(input())).resolves.toEqual({
			jobId: "job_1",
		});
		expect(moduleRef.get).toHaveBeenCalledWith(getQueueToken("ai-generation"), {
			strict: false,
		});
		expect(queue.add).toHaveBeenCalledWith("generate-copy", input(), {
			attempts: 1,
			jobId: "job_1",
			removeOnComplete: 1000,
			removeOnFail: 5000,
		});
	});

	it("treats an existing stable job as accepted after a lost add response", async () => {
		const { queue, service } = setup();
		queue.add.mockRejectedValue(new Error("connection reset"));
		queue.getJob.mockResolvedValue({ id: "job_1" });

		await expect(service.enqueueGenerateCopy(input())).resolves.toEqual({
			jobId: "job_1",
		});
	});

	it("allows compensation only after Redis proves the job absent", async () => {
		const { queue, service } = setup();
		const error = new Error("rejected before write");
		queue.add.mockRejectedValue(error);
		queue.getJob.mockResolvedValue(null);

		await expect(service.enqueueGenerateCopy(input())).rejects.toBe(error);
	});

	it("reports an unknown outcome when the follow-up lookup also fails", async () => {
		const { queue, service } = setup();
		queue.add.mockRejectedValue(new Error("connection reset"));
		queue.getJob.mockRejectedValue(new Error("redis unavailable"));

		await expect(service.enqueueGenerateCopy(input())).rejects.toBeInstanceOf(
			GenerationQueueOutcomeUnknownError,
		);
	});
});

function input(): AiGenerationJobData {
	return {
		action: "chatMessage",
		billingMode: "enforce",
		chatId: "chat_1",
		jobId: "job_1",
		messageId: "message_1",
		projectId: "project_1",
		prompt: "Hello",
		usageEventId: "usage_event_1",
		userId: "user_1",
	};
}
