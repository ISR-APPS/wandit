import { env } from "@wandit/env/server";
import { afterEach, describe, expect, it } from "vitest";

import { type MessageRow, mapMessageRow } from "./chat-message.mapper";

const originalNodeEnv = env.NODE_ENV;
afterEach(() => {
	Object.assign(env, { NODE_ENV: originalNodeEnv });
});

describe("mapMessageRow model privacy", () => {
	it.each([
		"production",
		"test",
	] as const)("hides stored system model details in %s without changing user content or credits", (nodeEnv) => {
		Object.assign(env, { NODE_ENV: nodeEnv });
		const row: MessageRow = {
			id: "message-1",
			chatId: "chat-1",
			role: "assistant",
			seq: 1,
			turnId: null,
			createdAt: new Date(0),
			failureKind: null,
			failureSource: null,
			failureProvider: null,
			failureProviderMessage: null,
			failureRequestId: null,
			sentryEventId: null,
			metadata: {
				model: "private/chat-model",
				provider: "private-provider",
				gatewayGenerationId: "private-generation",
				usage: { inputTokens: 20 },
			},
			parts: [
				{
					type: "text",
					text: "Compare OpenAI and Anthropic.",
					providerMetadata: { private: { model: "private/chat-model" } },
				},
				{
					type: "tool-generate_page",
					output: {
						status: "queued",
						message: "Queued",
						builderModel: "private/builder-model",
					},
				},
				{
					type: "tool-read_file",
					output: { model: "UserProduct", provider: "UserVendor" },
				},
				{
					type: "data-turn-done",
					data: {
						status: "succeeded",
						receipt: {
							modelId: "private/turn-model",
							credits: 125,
							balanceCredits: 300,
							inputTokens: 20,
							outputTokens: 10,
							cacheReadTokens: 0,
							cacheWriteTokens: 0,
						},
					},
				},
			],
		};
		const response = mapMessageRow(row);
		expect(JSON.stringify(response)).not.toContain("private/");
		expect(JSON.stringify(response)).not.toContain("private-provider");
		expect(JSON.stringify(response)).not.toContain("private-generation");
		expect(response.metadata).toEqual({ usage: { inputTokens: 20 } });
		expect(response.parts).toContainEqual({
			type: "text",
			text: "Compare OpenAI and Anthropic.",
		});
		expect(response.parts).toContainEqual({
			type: "tool-read_file",
			output: { model: "UserProduct", provider: "UserVendor" },
		});
		expect(response.parts.at(-1)).toMatchObject({
			data: {
				receipt: { modelId: "wandit", credits: 125, balanceCredits: 300 },
			},
		});
		expect(JSON.stringify(row)).toContain("private/chat-model");
	});
});
