import type { InspectVideoOutput } from "@wandit/contracts";
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createLlmModel,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import {
	type AvailableVideo,
	createInspectVideoTool,
} from "./inspect-video.tool";

const mockEnv = vi.hoisted(() => ({
	AI_VIDEO_INSPECT_MODEL: "watcher/video-model",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("ai")>()),
	generateText: vi.fn(),
}));

vi.mock("../../../ai-provider/domain/llm-provider", () => ({
	createLlmModel: vi.fn(() => "watcher-model"),
	withLlmAttribution: vi.fn(() => ({})),
}));

const VIDEO_URL =
	"https://assets.example.com/uploads/user_1/uuid/reference.mp4";
const VIDEO: AvailableVideo = {
	filename: "reference.mp4",
	mediaType: "video/mp4",
	url: VIDEO_URL,
};

const WATCHER_RESPONSE = {
	brief:
		"VIDEO TYPE: polished product commercial. A running shoe lands in rain, then settles into a clean hero frame. Keep the clip silent.",
	suggested: {
		aspect: "9:16",
		durationSeconds: 10,
		multiShot: false,
		quality: "standard",
		talking: false,
	},
} as const;

function setup(availableVideos: AvailableVideo[] = [VIDEO]) {
	const meteringService = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({
				id: "generation_ref_1",
			}),
		),
	};
	const run = createInspectVideoTool({
		availableVideos,
		meteringService: meteringService as unknown as MeteringService,
		organizationId: "org_1",
		parentEventId: "event_1",
		userId: "user_1",
	}).execute;

	if (!run) {
		throw new Error("inspect_video tool must have execute");
	}

	return {
		execute: async (
			input: Parameters<typeof run>[0],
			abortSignal?: AbortSignal,
		): Promise<InspectVideoOutput> =>
			(await run(input, {
				abortSignal,
				messages: [],
				toolCallId: "call_1",
			} as unknown as Parameters<typeof run>[1])) as InspectVideoOutput,
		meteringService,
	};
}

function mockWatcherResponse(response: unknown = WATCHER_RESPONSE): void {
	vi.mocked(generateText).mockResolvedValue({
		finishReason: "stop",
		providerMetadata: { gateway: { generationId: "generation_1" } },
		text: JSON.stringify(response),
		usage: { inputTokens: 100, outputTokens: 80 },
	} as unknown as Awaited<ReturnType<typeof generateText>>);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(createLlmModel).mockReturnValue("watcher-model" as never);
	vi.mocked(withLlmAttribution).mockReturnValue({});
});

describe("inspect_video tool", () => {
	it("refuses a URL that is not a video attached to this conversation", async () => {
		const { execute } = setup();

		const output = await execute({
			focus: "motion",
			url: "https://evil.example.com/private.mp4",
		});

		expect(output).toEqual({
			message: "This URL is not a video attached in this conversation.",
			status: "unavailable",
		});
		expect(generateText).not.toHaveBeenCalled();
	});

	it("answers unavailable when the watcher throws", async () => {
		const { execute } = setup();
		vi.mocked(generateText).mockRejectedValue(new Error("gateway timeout"));

		const output = await execute({ focus: "style", url: VIDEO_URL });

		expect(output).toMatchObject({
			message: expect.stringContaining("could not be analyzed"),
			status: "unavailable",
		});
		expect(output).not.toHaveProperty("brief");
	});

	it("sends the attached video to the routed watcher and validates its brief", async () => {
		const { execute, meteringService } = setup();
		const abortController = new AbortController();
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			ignored: "drop me",
			suggested: {
				...WATCHER_RESPONSE.suggested,
				ignored: "drop me too",
			},
		});

		const output = await execute(
			{ focus: "product", url: VIDEO_URL },
			abortController.signal,
		);

		expect(output).toEqual({ status: "ok", ...WATCHER_RESPONSE });
		expect(createLlmModel).toHaveBeenCalledWith("watcher/video-model", {
			context: {
				operation: "chat",
				organizationId: "org_1",
				userId: "user_1",
			},
			task: "video_inspect",
		});
		expect(withLlmAttribution).toHaveBeenCalledWith(
			{},
			{
				operation: "chat",
				organizationId: "org_1",
				userId: "user_1",
			},
			"video_inspect",
		);
		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				abortSignal: abortController.signal,
				messages: [
					{
						content: [
							{
								data: VIDEO_URL,
								mediaType: "video/mp4",
								type: "file",
							},
							{
								text: expect.stringContaining("Primary focus: product"),
								type: "text",
							},
						],
						role: "user",
					},
				],
			}),
		);
		expect(meteringService.captureGeneration).toHaveBeenCalledWith("event_1", {
			providerMetadata: { gateway: { generationId: "generation_1" } },
			stepUsage: {
				metering: {
					customerBilling: "helper_billable",
					task: "video_inspect",
				},
				providerUsage: { inputTokens: 100, outputTokens: 80 },
			},
		});
	});

	it("clamps an unsupported duration to the nearest render duration", async () => {
		const { execute } = setup();
		const longBrief = `VIDEO TYPE: social teaser. ${"A".repeat(4_100)}`;
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			brief: longBrief,
			suggested: {
				...WATCHER_RESPONSE.suggested,
				durationSeconds: 13,
			},
		});

		const output = await execute({ focus: "structure", url: VIDEO_URL });

		expect(output).toMatchObject({
			status: "ok",
			suggested: { durationSeconds: 15, quality: "max" },
		});
		expect(output.status === "ok" ? output.brief : "").toHaveLength(4_000);
	});

	it("clamps an oversized voiceover script without discarding the brief", async () => {
		const { execute } = setup();
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			voiceoverLanguage: "en",
			voiceoverScript: "A".repeat(651),
		});

		const output = await execute({ focus: "structure", url: VIDEO_URL });

		expect(output).toMatchObject({
			status: "ok",
			suggested: { quality: "max" },
			voiceoverLanguage: "en",
			voiceoverScript: "A".repeat(600),
		});
	});

	it("drops both voiceover fields when the language is invalid", async () => {
		const { execute } = setup();
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			voiceoverLanguage: "es",
			voiceoverScript: "Run into the rain.",
		});

		const output = await execute({ focus: "structure", url: VIDEO_URL });

		expect(output).toEqual({ status: "ok", ...WATCHER_RESPONSE });
	});

	it.each([
		{ durationSeconds: 10, expectedQuality: "standard" },
		{ durationSeconds: 15, expectedQuality: "max" },
	])("repairs an unknown quality to $expectedQuality at $durationSeconds seconds", async ({
		durationSeconds,
		expectedQuality,
	}) => {
		const { execute } = setup();
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			suggested: {
				...WATCHER_RESPONSE.suggested,
				durationSeconds,
				quality: "ultra",
			},
		});

		const output = await execute({ focus: "style", url: VIDEO_URL });

		expect(output).toMatchObject({
			status: "ok",
			suggested: { quality: expectedQuality },
		});
	});

	it("preserves discretionary max quality", async () => {
		const { execute } = setup();
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			suggested: { ...WATCHER_RESPONSE.suggested, quality: "max" },
		});

		const output = await execute({ focus: "style", url: VIDEO_URL });

		expect(output).toMatchObject({
			status: "ok",
			suggested: { quality: "max" },
		});
	});

	it("parses accidental JSON code fences", async () => {
		const { execute } = setup();
		mockWatcherResponse();
		vi.mocked(generateText).mockResolvedValue({
			finishReason: "stop",
			providerMetadata: {},
			text: `\`\`\`json\n${JSON.stringify(WATCHER_RESPONSE)}\n\`\`\``,
			usage: {},
		} as unknown as Awaited<ReturnType<typeof generateText>>);

		const output = await execute({ focus: "motion", url: VIDEO_URL });

		expect(output).toEqual({ status: "ok", ...WATCHER_RESPONSE });
	});

	it("passes a long reference's timestamped shot list through", async () => {
		const { execute } = setup();
		const shotList = [
			{
				description: "A runner ties the shoe while speaking to camera.",
				endSeconds: 8,
				startSeconds: 0,
				talking: true,
			},
			{
				description: "The runner crosses a rain-lit street.",
				endSeconds: 24,
				startSeconds: 8,
				talking: false,
			},
		];
		mockWatcherResponse({ ...WATCHER_RESPONSE, shotList });

		const output = await execute({ focus: "structure", url: VIDEO_URL });

		expect(output).toMatchObject({ shotList, status: "ok" });
	});

	it("drops a shot list whose final beat ends within 15 seconds", async () => {
		const { execute } = setup();
		mockWatcherResponse({
			...WATCHER_RESPONSE,
			shotList: [
				{
					description: "A runner ties the shoe.",
					endSeconds: 6,
					startSeconds: 0,
					talking: false,
				},
				{
					description: "The runner crosses a rain-lit street.",
					endSeconds: 12,
					startSeconds: 6,
					talking: false,
				},
			],
		});

		const output = await execute({ focus: "structure", url: VIDEO_URL });

		expect(output).toEqual({ status: "ok", ...WATCHER_RESPONSE });
	});

	it("drops an empty shot list", async () => {
		const { execute } = setup();
		mockWatcherResponse({ ...WATCHER_RESPONSE, shotList: [] });

		const output = await execute({ focus: "structure", url: VIDEO_URL });

		expect(output).toEqual({ status: "ok", ...WATCHER_RESPONSE });
	});
});
