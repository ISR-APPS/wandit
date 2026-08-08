import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { argan } from "../worlds/cod/argan";
import { atay } from "../worlds/cod/atay";
import { COD_GENRE_DOC, FUSION_CONTRACT } from "../worlds/cod/genre";
import { hammam } from "../worlds/cod/hammam";
import { monographe } from "../worlds/monographe";
import { vitrine } from "../worlds/vitrine";
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
	idempotencyKeys: { create: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

vi.mock("../site-builder/builder-prompt", () => ({
	WORLD_DEPARTURE_POINT_HEADING: "departure-point heading (test)",
	buildSiteBuilderSystemPrompt: vi
		.fn()
		.mockResolvedValue("builder prompt (test)"),
}));

vi.mock("../site-builder/cod-builder-prompt", () => ({
	buildCodSiteBuilderSystemPrompt: vi
		.fn()
		.mockResolvedValue("COD builder prompt (test)"),
}));

const INPUT = {
	brief:
		"Arabic RTL landing page for handmade kabyle jewelry, Bazar Heat direction, " +
		"COD form phone-first, prices in DZD, WhatsApp CTA.",
	title: "Kabyle jewelry page",
};

const mutableEnv = env as {
	AI_PAGE_BUILDER_MODEL?: string;
	AI_PAGE_DESIGN_MODEL: string;
};

function setup(options: { parentEventId?: string } = {}) {
	const pagesRepository = {
		findOrCreateLandingArtifact: vi.fn(),
		insertAttempt: vi.fn(),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn().mockResolvedValue(true),
		nextVersionNumber: vi.fn(),
	};
	const generatePageTool = createGeneratePageTool({
		chatId: "chat_1",
		pagesRepository: pagesRepository as unknown as PagesRepository,
		...(options.parentEventId ? { parentEventId: options.parentEventId } : {}),
		projectId: "project_1",
		subject: { actorUserId: "user_1" },
		userId: "user_1",
	});

	// The AI SDK calls execute with (input, callOptions); the tool ignores
	// the call options, so a stub second argument is enough here.
	const execute = (
		input: typeof INPUT & {
			pageKind?: "cod" | "website";
			worldId?: string;
			worldIds?: string[];
		},
	) => {
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

function prepareSuccessfulQueue(
	pagesRepository: ReturnType<typeof setup>["pagesRepository"],
) {
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
}

beforeEach(() => {
	mutableEnv.AI_PAGE_BUILDER_MODEL = "test-provider/test-builder-model";
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(tasks.trigger).mockReset();
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-page-build-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
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
				pageKind: "website",
				title: INPUT.title,
			},
		});
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			"page-build:attempt_1",
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"generate-page",
			{ actorUserId: "user_1", attemptId: "attempt_1" },
			{
				idempotencyKey: "global-page-build-key",
				idempotencyKeyTTL: "14d",
				tags: ["page-build-attempt:attempt_1", "project:project_1"],
				ttl: "35m",
			},
		);
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
			builderModel: "test-provider/test-builder-model",
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

	it("forwards the parent metering event to the background build", async () => {
		const { execute, pagesRepository } = setup({
			parentEventId: "44444444-4444-4444-8444-444444444444",
		});
		prepareSuccessfulQueue(pagesRepository);

		await execute(INPUT);

		expect(tasks.trigger).toHaveBeenCalledWith(
			"generate-page",
			{
				actorUserId: "user_1",
				attemptId: "attempt_1",
				parentEventId: "44444444-4444-4444-8444-444444444444",
			},
			expect.objectContaining({
				idempotencyKey: "global-page-build-key",
			}),
		);
	});

	it("appends a website world behind the departure-point heading", async () => {
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
					designerSystemPrompt:
						"builder prompt (test)\n\n" +
						`departure-point heading (test)\n\n${monographe.doc}`,
					pageKind: "website",
					title: INPUT.title,
				},
			}),
		);
	});

	it("appends a product dossier world bare — a bare doc stays law", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({ ...INPUT, worldId: "vitrine" });

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({
					designerSystemPrompt: `builder prompt (test)\n\n${vitrine.doc}`,
				}),
			}),
		);
	});

	it("assembles COD worldIds as genre law, fusion contract, base, then donors", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({
			...INPUT,
			worldIds: [argan.id, hammam.id, atay.id],
		});

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: {
					brief: INPUT.brief,
					designerSystemPrompt: [
						"COD builder prompt (test)",
						COD_GENRE_DOC,
						FUSION_CONTRACT([argan, hammam, atay]),
						argan.doc,
						hammam.doc,
						atay.doc,
					].join("\n\n"),
					pageKind: "cod",
					title: INPUT.title,
				},
			}),
		);
	});

	it("builds with COD genre law alone and persists pageKind", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({ ...INPUT, pageKind: "cod" });

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: {
					brief: INPUT.brief,
					designerSystemPrompt: `COD builder prompt (test)\n\n${COD_GENRE_DOC}`,
					pageKind: "cod",
					title: INPUT.title,
				},
			}),
		);
	});

	it("warns and drops unknown ids while preserving resolved fusion order", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({
			...INPUT,
			worldIds: [argan.id, "no-such-world", atay.id],
		});

		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Unknown worldId "no-such-world"'),
		);
		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({
					designerSystemPrompt: [
						"COD builder prompt (test)",
						COD_GENRE_DOC,
						FUSION_CONTRACT([argan, atay]),
						argan.doc,
						atay.doc,
					].join("\n\n"),
					pageKind: "cod",
				}),
			}),
		);

		warn.mockRestore();
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
					pageKind: "website",
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

	it("keeps an ambiguous handoff queued across three stable-key retries", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);
		pagesRepository.findOrCreateLandingArtifact.mockResolvedValue({
			activeVersionId: null,
			id: "artifact_1",
		});
		pagesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockRejectedValue(new Error("trigger is down"));

		const output = await execute(INPUT);

		expect(tasks.trigger).toHaveBeenCalledTimes(3);
		expect(idempotencyKeys.create).toHaveBeenCalledOnce();
		for (const call of vi.mocked(tasks.trigger).mock.calls) {
			expect(call[2]).toMatchObject({
				idempotencyKey: "global-page-build-key",
			});
		}
		expect(pagesRepository.markAttemptFailed).not.toHaveBeenCalled();
		expect(output).toMatchObject({
			attemptId: "attempt_1",
			status: "queued",
		});
		expect(pagesRepository.nextVersionNumber).not.toHaveBeenCalled();
	});

	it("closes a still-queued attempt after definitive Trigger rejection", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);
		pagesRepository.findOrCreateLandingArtifact.mockResolvedValue({
			activeVersionId: null,
			id: "artifact_1",
		});
		pagesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		vi.mocked(tasks.trigger).mockRejectedValue(
			Object.assign(new Error("invalid credentials"), {
				name: "TriggerApiError",
				status: 401,
			}),
		);

		const output = await execute(INPUT);

		expect(tasks.trigger).toHaveBeenCalledTimes(1);
		expect(pagesRepository.markAttemptFailed).toHaveBeenCalledWith(
			"attempt_1",
			"The background page builder rejected this request. Please try again.",
			"user_1",
		);
		expect(output).toMatchObject({ status: "unavailable" });
		expect(pagesRepository.nextVersionNumber).not.toHaveBeenCalled();
	});

	it("preserves a live attempt when the definitive-rejection CAS loses", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);
		pagesRepository.findOrCreateLandingArtifact.mockResolvedValue({
			activeVersionId: null,
			id: "artifact_1",
		});
		pagesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		pagesRepository.markAttemptFailed.mockResolvedValue(false);
		vi.mocked(tasks.trigger).mockRejectedValue(
			Object.assign(new Error("invalid request"), {
				name: "TriggerApiError",
				status: 422,
			}),
		);

		const output = await execute(INPUT);

		expect(output).toMatchObject({
			attemptId: "attempt_1",
			status: "queued",
		});
		expect(pagesRepository.nextVersionNumber).not.toHaveBeenCalled();
	});

	it("does not fail accepted work when the queued run-id CAS loses", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);
		pagesRepository.findOrCreateLandingArtifact.mockResolvedValue({
			activeVersionId: null,
			id: "artifact_1",
		});
		pagesRepository.insertAttempt.mockResolvedValue({ id: "attempt_1" });
		pagesRepository.markAttemptTriggered.mockResolvedValue(false);
		pagesRepository.nextVersionNumber.mockResolvedValue(1);
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_accepted",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		const output = await execute(INPUT);

		expect(pagesRepository.markAttemptFailed).not.toHaveBeenCalled();
		expect(auth.createPublicToken).toHaveBeenCalledWith({
			expirationTime: "2h",
			scopes: { read: { runs: ["run_accepted"] } },
		});
		expect(output).toMatchObject({
			attemptId: "attempt_1",
			status: "queued",
		});
	});
});
