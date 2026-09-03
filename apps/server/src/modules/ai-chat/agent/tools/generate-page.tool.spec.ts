import { Logger } from "@nestjs/common";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	generatePageInputSchema,
	generatePageOutputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import type { ConversationGeneratedAsset } from "../annotate-generated-assets";
import { argan } from "../worlds/cod/argan";
import { atay } from "../worlds/cod/atay";
import { COD_GENRE_DOC, FUSION_CONTRACT } from "../worlds/cod/genre";
import { hammam } from "../worlds/cod/hammam";
import { monographe } from "../worlds/monographe";
import { vitrine } from "../worlds/vitrine";
import {
	appendReadyMediaAssets,
	appendUserLinks,
	createGeneratePageTool,
} from "./generate-page.tool";

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

vi.mock("../site-builder/simple-cod-builder-prompt", () => ({
	buildSimpleCodSiteBuilderSystemPrompt: vi
		.fn()
		.mockResolvedValue("SIMPLE COD builder prompt (test)"),
}));

vi.mock("../site-builder/simple-cod-recipe", () => ({
	SIMPLE_COD_STYLE_DOC: "# SIMPLE COD STYLE (test)",
	sampleSimpleCodRecipe: vi.fn(() => "# THIS BUILD'S RECIPE (test)"),
}));

const INPUT = {
	brief:
		"Arabic RTL landing page for handmade kabyle jewelry, Bazar Heat direction, " +
		"COD form phone-first, prices in DZD, WhatsApp CTA.",
	title: "Kabyle jewelry page",
};
const COD_SKU = "KBL-JWL-001";

const mutableEnv = env as {
	AI_PAGE_BUILDER_MODEL?: string;
	AI_PAGE_DESIGN_MODEL: string;
};

function setup(
	options: {
		builderReasoning?: "auto" | "minimal" | "low" | "medium" | "high" | "xhigh";
		parentEventId?: string;
		conversationAssets?: ConversationGeneratedAsset[];
		conversationUserLinks?: string[];
	} = {},
) {
	const pagesRepository = {
		findOrCreateLandingArtifact: vi.fn(),
		insertAttempt: vi.fn(),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn().mockResolvedValue(true),
		nextVersionNumber: vi.fn(),
	};
	const generatePageTool = createGeneratePageTool({
		...(options.builderReasoning
			? { builderReasoning: options.builderReasoning }
			: {}),
		chatId: "chat_1",
		...(options.conversationAssets
			? { conversationAssets: options.conversationAssets }
			: {}),
		...(options.conversationUserLinks
			? { conversationUserLinks: options.conversationUserLinks }
			: {}),
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
			codMode?: "simple" | "max";
			pageKind?: "cod" | "website";
			productSku?: string;
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
	it("keeps historical inputs valid while trimming and validating productSku", () => {
		expect(generatePageInputSchema.safeParse(INPUT).success).toBe(true);
		expect(
			generatePageInputSchema.parse({ ...INPUT, productSku: "  SKU-01  " })
				.productSku,
		).toBe("SKU-01");
		expect(
			generatePageInputSchema.safeParse({
				...INPUT,
				productSku: "\tSKU-01 ",
			}).success,
		).toBe(false);
		expect(
			generatePageInputSchema.safeParse({
				...INPUT,
				productSku: "S".repeat(101),
			}).success,
		).toBe(false);
	});

	it("accepts the distinct needs-input output status", () => {
		expect(
			generatePageOutputSchema.safeParse({
				message: "Ask the user for the missing SKU.",
				status: "needs-input",
			}).success,
		).toBe(true);
	});

	it("reports configuration before a missing-SKU refusal", async () => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(false);

		const output = await execute({ ...INPUT, pageKind: "cod" });

		expect(output).toMatchObject({
			message: expect.stringContaining("isn't configured"),
			status: "unavailable",
		});
		expect(output).not.toMatchObject({
			message: expect.stringContaining("productSku is missing"),
		});
		expect(isR2Configured).toHaveBeenCalledOnce();
		expect(pagesRepository.findOrCreateLandingArtifact).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it.each([
		["pageKind", { pageKind: "cod" as const }],
		["COD world", { worldIds: [argan.id] }],
	])("requests the missing SKU for a configured COD build identified by %s", async (_source, codInput) => {
		const { execute, pagesRepository } = setup();
		vi.mocked(isR2Configured).mockReturnValue(true);

		const output = await execute({ ...INPUT, ...codInput });

		expect(output).toEqual({
			message: expect.stringContaining(
				"Ask the user for the merchant's exact product SKU first",
			),
			status: "needs-input",
		});
		expect(isR2Configured).toHaveBeenCalledOnce();
		expect(pagesRepository.findOrCreateLandingArtifact).not.toHaveBeenCalled();
		expect(pagesRepository.insertAttempt).not.toHaveBeenCalled();
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("does not let codMode reclassify an explicit website build", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		const output = await execute({
			...INPUT,
			codMode: "simple",
			pageKind: "website",
		});

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

	it("assembles inferred max COD worldIds as genre law, fusion contract, base, then donors", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({
			...INPUT,
			productSku: COD_SKU,
			worldIds: [argan.id, hammam.id, atay.id],
		});

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: {
					brief: INPUT.brief,
					codMode: "max",
					designerSystemPrompt: [
						"COD builder prompt (test)",
						COD_GENRE_DOC,
						FUSION_CONTRACT([argan, hammam, atay]),
						argan.doc,
						hammam.doc,
						atay.doc,
					].join("\n\n"),
					pageKind: "cod",
					productSku: COD_SKU,
					title: INPUT.title,
				},
			}),
		);
	});

	it("uses the simple composition when COD explicitly requests simple", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({
			...INPUT,
			codMode: "simple",
			pageKind: "cod",
			productSku: COD_SKU,
		});

		const spec = pagesRepository.insertAttempt.mock.calls[0]?.[0]?.spec as {
			codMode: string;
			designerSystemPrompt: string;
		};
		expect(spec.codMode).toBe("simple");
		expect(spec.designerSystemPrompt).toContain("SIMPLE COD STYLE");
		expect(spec.designerSystemPrompt).toContain("THIS BUILD'S RECIPE");
		expect(spec.designerSystemPrompt).not.toContain("WORLD FUSION CONTRACT");
	});

	it("drops worlds from an explicitly simple COD composition", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({
			...INPUT,
			codMode: "simple",
			pageKind: "cod",
			productSku: COD_SKU,
			worldIds: [argan.id, atay.id],
		});

		const spec = pagesRepository.insertAttempt.mock.calls[0]?.[0]?.spec as {
			codMode: string;
			designerSystemPrompt: string;
		};
		expect(spec.codMode).toBe("simple");
		expect(spec.designerSystemPrompt).toContain("SIMPLE COD STYLE");
		expect(spec.designerSystemPrompt).toContain("THIS BUILD'S RECIPE");
		expect(spec.designerSystemPrompt).not.toContain("WORLD FUSION CONTRACT");
		expect(spec.designerSystemPrompt).not.toContain(argan.doc);
		expect(spec.designerSystemPrompt).not.toContain(atay.doc);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("dropping world docs"),
		);

		warn.mockRestore();
	});

	it("infers simple for a world-less COD call", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({ ...INPUT, pageKind: "cod", productSku: COD_SKU });

		const spec = pagesRepository.insertAttempt.mock.calls[0]?.[0]?.spec as {
			codMode: string;
			designerSystemPrompt: string;
		};
		expect(spec.codMode).toBe("simple");
		expect(spec.designerSystemPrompt).toContain("SIMPLE COD STYLE");
		expect(spec.designerSystemPrompt).toContain("THIS BUILD'S RECIPE");
		expect(spec.designerSystemPrompt).not.toContain("WORLD FUSION CONTRACT");
	});

	it("defaults COD builds to the COD builder model, not the landing one", async () => {
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({ ...INPUT, pageKind: "cod", productSku: COD_SKU });

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({ model: "openai/gpt-5.6-luna" }),
		);
	});

	it("snapshots a real composer reasoning pick and skips 'auto'", async () => {
		const { execute, pagesRepository } = setup({ builderReasoning: "xhigh" });
		prepareSuccessfulQueue(pagesRepository);

		await execute({ ...INPUT, pageKind: "cod", productSku: COD_SKU });

		expect(pagesRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({
				spec: expect.objectContaining({ reasoningEffort: "xhigh" }),
			}),
		);

		const { execute: executeAuto, pagesRepository: autoRepository } = setup({
			builderReasoning: "auto",
		});
		prepareSuccessfulQueue(autoRepository);

		await executeAuto({ ...INPUT, pageKind: "cod", productSku: COD_SKU });

		const [attempt] = autoRepository.insertAttempt.mock.calls.at(-1) ?? [];
		expect(attempt.spec).not.toHaveProperty("reasoningEffort");
	});

	it("warns and drops unknown ids while preserving resolved fusion order", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { execute, pagesRepository } = setup();
		prepareSuccessfulQueue(pagesRepository);

		await execute({
			...INPUT,
			productSku: COD_SKU,
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

describe("appendReadyMediaAssets", () => {
	const IMAGE = "https://assets.example.com/images/p1/a1/img-1.png";
	const VIDEO = "https://assets.example.com/sites/p1/assets/a2/vid-1.mp4";

	it("appends a READY MEDIA ASSETS section for URLs the brief forgot", () => {
		const brief = appendReadyMediaAssets("Build the page.", [
			{ kind: "image", url: IMAGE },
			{ kind: "video", url: VIDEO },
		]);

		expect(brief).toContain("READY MEDIA ASSETS");
		expect(brief).toContain(`- image: ${IMAGE}`);
		expect(brief).toContain(`- video: ${VIDEO}`);
		expect(brief.startsWith("Build the page.")).toBe(true);
	});

	it("returns the brief unchanged when every asset URL is already listed", () => {
		const diligent = `Build the page.\nMEDIA ASSETS:\n- hero shot: ${IMAGE}`;

		expect(
			appendReadyMediaAssets(diligent, [{ kind: "image", url: IMAGE }]),
		).toBe(diligent);
	});

	it("returns the brief unchanged when the conversation has no assets", () => {
		expect(appendReadyMediaAssets("Build the page.", [])).toBe(
			"Build the page.",
		);
	});

	it("bounds the appended section to 16 asset lines", () => {
		const assets = Array.from({ length: 20 }, (_, index) => ({
			kind: "image",
			url: `https://assets.example.com/img-${index}.png`,
		}));

		const brief = appendReadyMediaAssets("Build the page.", assets);

		expect(brief.match(/^- image: /gm)).toHaveLength(16);
	});
});

describe("appendUserLinks", () => {
	it("appends each missing link once in first-seen order", () => {
		const first = "https://example.com/first";
		const second = "https://example.com/second";

		const brief = appendUserLinks("Build the page.", [first, second, first]);

		expect(brief).toBe(
			[
				"Build the page.",
				"",
				"USER LINKS (URLs the user shared in this conversation — use the ones that belong on this page; ignore any that were only references):",
				`- ${first}`,
				`- ${second}`,
			].join("\n"),
		);
	});

	it("skips links the brief already contains", () => {
		const included = "https://example.com/included";
		const diligent = `Build around **${included}**.`;

		expect(appendUserLinks(diligent, [included])).toBe(diligent);
	});

	it("does not treat a longer URL in the brief as containing its prefix", () => {
		const prefix = "https://instagram.com/acme";
		const longer = "https://instagram.com/acmestore";

		const brief = appendUserLinks(`Use ${longer} as inspiration.`, [prefix]);

		expect(brief).toContain(`- ${prefix}`);
	});

	it("bounds the appended section to the newest 16 unique links", () => {
		const links = Array.from(
			{ length: 20 },
			(_, index) => `https://example.com/link-${index}`,
		);

		const brief = appendUserLinks("Build the page.", links);

		expect(brief.match(/^- https:\/\/example\.com\/link-\d+$/gm)).toEqual(
			links.slice(-16).map((link) => `- ${link}`),
		);
	});
});

describe("generate_page with conversation assets", () => {
	const IMAGE = "https://assets.example.com/images/p1/a1/img-1.png";

	it("snapshots the brief with the appended conversation assets", async () => {
		const { execute, pagesRepository } = setup({
			conversationAssets: [{ kind: "image", url: IMAGE }],
		});
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

		const spec = pagesRepository.insertAttempt.mock.calls[0]?.[0]?.spec as {
			brief: string;
		};
		expect(spec.brief.startsWith(INPUT.brief)).toBe(true);
		expect(spec.brief).toContain("READY MEDIA ASSETS");
		expect(spec.brief).toContain(`- image: ${IMAGE}`);
	});
});

describe("generate_page with conversation user links", () => {
	const USER_LINK = "https://www.youtube.com/watch?v=demo123";

	it("snapshots the brief with the appended conversation links", async () => {
		const { execute, pagesRepository } = setup({
			conversationUserLinks: [USER_LINK],
		});
		prepareSuccessfulQueue(pagesRepository);

		await execute(INPUT);

		const spec = pagesRepository.insertAttempt.mock.calls[0]?.[0]?.spec as {
			brief: string;
		};
		expect(spec.brief.startsWith(INPUT.brief)).toBe(true);
		expect(spec.brief).toContain("USER LINKS");
		expect(spec.brief).toContain(`- ${USER_LINK}`);
	});
});
