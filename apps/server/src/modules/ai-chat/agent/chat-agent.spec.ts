import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({
	settings: undefined as Record<string, unknown> | undefined,
	stopCondition: { maxSteps: 12 },
}));

vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();

	return {
		...actual,
		isStepCount: vi.fn(() => aiMocks.stopCondition),
		ToolLoopAgent: class ToolLoopAgent {
			constructor(settings: Record<string, unknown>) {
				aiMocks.settings = settings;
			}
		},
	};
});

import { createChatAgent } from "./chat-agent";
import { AI_CHAT_MAX_OUTPUT_TOKENS, AI_CHAT_MAX_STEPS } from "./chat-metering";

describe("chat agent cost bounds and gateway attribution", () => {
	beforeEach(() => {
		aiMocks.settings = undefined;
	});

	it("sets explicit output, step, and per-user gateway bounds", () => {
		createChatAgent({
			availableImages: [],
			chatId: "chat-1",
			imageGenerationsRepository: {},
			leadScrapesRepository: {},
			marketingAssetsRepository: {},
			mediaGenerationsRepository: {},
			meteringService: {},
			pageEditsService: {},
			pagesRepository: {},
			projectId: "project-1",
			requestCountryCode: null,
			subject: { actorUserId: "user-1" },
			userId: "user-1",
		} as never);

		expect(aiMocks.settings).toMatchObject({
			maxOutputTokens: AI_CHAT_MAX_OUTPUT_TOKENS,
			providerOptions: {
				gateway: {
					quotaEntityId: "user-1",
					tags: ["op:chat", "ws:personal"],
					user: "user-1",
				},
			},
			stopWhen: aiMocks.stopCondition,
		});
		expect(AI_CHAT_MAX_STEPS).toBe(12);
	});
});
