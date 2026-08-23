import { describe, expect, it } from "vitest";

import {
	AI_CHAT_ESTIMATED_OUTPUT_TOKENS,
	AI_CHAT_TOOL_SCHEMA_ALLOWANCE_CHARS,
	estimateAiChatTokenUsage,
	projectCreationMeteringKey,
	projectCreationReservationAttemptRef,
	projectCreationStreamClaimAttemptRef,
} from "./chat-metering";
import {
	INSPECT_VIDEO_BRAIN_GUIDANCE,
	WANDIT_SYSTEM_PROMPT,
} from "./system-prompt";

describe("AI chat admission estimate", () => {
	it("includes model-bound messages, static context, and tool schema allowance", () => {
		const messages = [{ content: "hello", role: "user" }];
		const context = "request context";
		const usage = estimateAiChatTokenUsage(messages, context);
		const expectedInputTokens = Math.ceil(
			(JSON.stringify(messages).length +
				WANDIT_SYSTEM_PROMPT.length +
				INSPECT_VIDEO_BRAIN_GUIDANCE.length +
				context.length +
				AI_CHAT_TOOL_SCHEMA_ALLOWANCE_CHARS) /
				4,
		);

		expect(usage).toEqual({
			inputTokens: expectedInputTokens,
			outputTokens: AI_CHAT_ESTIMATED_OUTPUT_TOKENS,
		});
	});

	it("keeps the creation reservation key discoverable by the first stream", () => {
		expect(projectCreationMeteringKey("project-1")).toBe(
			"project-create:project-1",
		);
		expect(projectCreationReservationAttemptRef("project-1")).toBe(
			"bundled-pending:project:project-1",
		);
		expect(projectCreationStreamClaimAttemptRef("project-1", "request-1")).toBe(
			"bundled-pending:project-stream:project-1:request-1",
		);
	});
});
