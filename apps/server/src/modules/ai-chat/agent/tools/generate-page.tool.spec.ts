import { auth, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { monographe } from "../worlds/monographe";
import { createGeneratePageTool } from "./generate-page.tool";

// Everything with side effects is replaced: env (credentials), storage
// (R2 check), the Trigger queue, and the builder prompt.
vi.mock("@wandit/env/server", () => ({
	env: {
		AI_PAGE_BUILDER_MODEL: "test-provider/test-builder-model",
		AI_PAGE_DESIGN_MODEL: "test-provider/legacy-builder-model",
		TRIGGER_SECRET_KEY: "tr_dev_test",
	},
}));

vi.mock("../../../../infrastructure/storage/r2", () => ({
	isR2Configured: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
	auth: { createPublicToken: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

vi.mock("../site-builder/builder-prompt", () => ({
	buildSiteBuilderSystemPrompt: vi
		.fn()
		.mockResolvedValue("builder prompt (test)"),
}));

const INPUT = {
	brief:
		"Arabic RTL landing page for handmade kabyle jewelry, Souk Heat direction, " +
		"COD form phone-first, prices in DZD, WhatsApp CTA.",
	title: "Kabyle jewelry page",
};

const mutableEnv = env as {
	AI_PAGE_BUILDER_MODEL?: string;
	AI_PAGE_DESIGN_MODEL: string;
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
	const execute = (input: typeof INPUT & { worldId?: string }) => {
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
	mutableEnv.AI_PAGE_BUILDER_MODEL = "test-provider/test-builder-model";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(tasks.trigger).mockReset();
	vi.mocked(auth.createPublicToken).mockReset();
	// Default: minting fails softly, like a server without Realtime access.
	vi.mocked(auth.createPublicToken).mockRejectedValue(new Error("no realtime"));
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
		vi.mocked(auth.createPublicToken).mockResolvedValue("tok_read");

		const output = await execute(INPUT);

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith({
			artifactId: "artifact_1",
			chatId: "chat_1",
			model: "test-provider/test-builder-model",
			projectId: "project_1",
			spec: {
				brief: INPUT.brief,
				designerSystemPrompt: "builder prompt (test)",
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
		expect(auth.createPublicToken).toHaveBeenCalledWith({
			expirationTime: "2h",
			scopes: { read: { runs: ["run_123"] } },
		});
		expect(output).toMatchObject({
			attemptId: "attempt_1",
			realtime: { publicAccessToken: "tok_read", runId: "run_123" },
			status: "queued",
			versionNumber: 1,
		});
	});

	it("still queues (without a realtime handle) when token minting fails", async () => {
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
		vi.mocked(auth.createPublicToken).mockRejectedValue(
			new Error("realtime down"),
		);

		const output = await execute(INPUT);

		expect(output).toMatchObject({ status: "queued", versionNumber: 1 });
		expect(output).not.toHaveProperty("realtime");
		expect(pagesRepository.markAttemptFailed).not.toHaveBeenCalled();
	});

	it("appends the chosen design world's doc to the prompt snapshot", async () => {
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

		await execute({ ...INPUT, worldId: "monographe" });

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: {
					brief: INPUT.brief,
					designerSystemPrompt: `builder prompt (test)\n\n${monographe.doc}`,
					title: INPUT.title,
				},
			}),
		);
	});

	it("falls back to a world-less snapshot on an unknown worldId", async () => {
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

		const output = await execute({ ...INPUT, worldId: "no-such-world" });

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: {
					brief: INPUT.brief,
					designerSystemPrompt: "builder prompt (test)",
					title: INPUT.title,
				},
			}),
		);
		expect(output).toMatchObject({ status: "queued" });
	});

	it("uses the legacy Builder model variable when the new one is unset", async () => {
		mutableEnv.AI_PAGE_BUILDER_MODEL = undefined;
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

		await execute(INPUT);

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				model: "test-provider/legacy-builder-model",
			}),
		);
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
