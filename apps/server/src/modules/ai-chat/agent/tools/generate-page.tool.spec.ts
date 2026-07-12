import { tasks } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { createGeneratePageTool } from "./generate-page.tool";

// Everything with side effects is replaced: env (credentials), storage
// (R2 check), the Trigger queue, and the designer prompt (reads a file).
vi.mock("@wandit/env/server", () => ({
	env: {
		AI_PAGE_DESIGN_MODEL: "test-provider/test-design-model",
		TRIGGER_SECRET_KEY: "tr_dev_test",
	},
}));

vi.mock("../../../../infrastructure/storage/r2", () => ({
	isR2Configured: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
	tasks: { trigger: vi.fn() },
}));

vi.mock("../designer-prompt", () => ({
	buildDesignerSystemPrompt: vi
		.fn()
		.mockResolvedValue("designer prompt (test)"),
}));

const INPUT = {
	brief:
		"Arabic RTL landing page for handmade kabyle jewelry, Souk Heat direction, " +
		"COD form phone-first, prices in DZD, WhatsApp CTA.",
	title: "Kabyle jewelry page",
};

function setup() {
	const pagesRepository = {
		findOrCreateLandingArtifact: vi.fn(),
		insertAttempt: vi.fn(),
		markAttemptFailed: vi.fn(),
		markAttemptTriggered: vi.fn(),
		nextVersionNumber: vi.fn(),
	};
	const generatePageTool = createGeneratePageTool({
		chatId: "chat_1",
		pagesRepository: pagesRepository as unknown as PagesRepository,
		projectId: "project_1",
	});

	// The AI SDK calls execute with (input, callOptions); the tool ignores
	// the call options, so a stub second argument is enough here.
	const execute = (input: typeof INPUT) => {
		const run = generatePageTool.execute;

		if (!run) {
			throw new Error("generate_page tool must have execute");
		}

		return run(input, {
			messages: [],
			toolCallId: "call_1",
		} as unknown as Parameters<typeof run>[1]);
	};

	return { execute, pagesRepository };
}

beforeEach(() => {
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(tasks.trigger).mockReset();
});

describe("generate_page tool", () => {
	it("answers unavailable without touching the database when unconfigured", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(false);

		const output = await execute(INPUT);

		expect(output).toMatchObject({ status: "unavailable" });
		expect(pagesRepository.findOrCreateLandingArtifact).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("queues an attempt with a snapshotted spec and reports the version number", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);
		pagesRepository.findOrCreateLandingArtifact.mockResolvedValue({
			activeVersionId: null,
			id: "artifact_1",
		});
		pagesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		pagesRepository.nextVersionNumber.mockResolvedValue(1);
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute(INPUT);

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith({
			artifactId: "artifact_1",
			chatId: "chat_1",
			model: "test-provider/test-design-model",
			projectId: "project_1",
			spec: {
				brief: INPUT.brief,
				designerSystemPrompt: "designer prompt (test)",
				title: INPUT.title,
			},
		});
		expect(tasks.trigger).toHaveBeenCalledWith("generate-page", {
			attemptId: "attempt_1",
		});
		expect(pagesRepository.markAttemptTriggered).toHaveBeenCalledWith(
			"attempt_1",
			"run_123",
		);
		expect(output).toMatchObject({
			attemptId: "attempt_1",
			status: "queued",
			versionNumber: 1,
		});
	});

	it("marks the attempt failed and answers unavailable when queueing throws", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);
		pagesRepository.findOrCreateLandingArtifact.mockResolvedValue({
			activeVersionId: null,
			id: "artifact_1",
		});
		pagesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockRejectedValue(new Error("trigger is down"));

		const output = await execute(INPUT);

		expect(pagesRepository.markAttemptFailed).toHaveBeenCalledWith(
			"attempt_1",
			"trigger is down",
		);
		expect(output).toMatchObject({ status: "unavailable" });
		expect(pagesRepository.nextVersionNumber).not.toHaveBeenCalled();
	});
});
