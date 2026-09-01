// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	AiCall,
	ChatMessage,
} from "@/features/conversations/api/conversations.dto";
import { groupCallsByMessageId } from "@/features/conversations/lib/conversation-usage";

import { Transcript } from "./transcript";

const createdAt = "2026-08-29T10:15:00.000Z";
const failure = {
	kind: "rate_limited" as const,
	source: "gateway" as const,
	providerLabel: "Vercel AI Gateway",
	retryable: true,
	terminal: true,
	refunded: null,
	moderationStage: null,
	providerMessage: "The provider asked this request to wait.",
	requestId: "request-1",
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let scrolledIds: string[] = [];

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.useFakeTimers();
	container = document.createElement("div");
	document.body.append(container);
	scrolledIds = [];
	Object.defineProperty(Element.prototype, "scrollIntoView", {
		configurable: true,
		value: vi.fn(function scrollIntoView(this: Element) {
			scrolledIds.push(this.id);
		}),
	});
	root = createRoot(container);
});

afterEach(async () => {
	if (root) {
		await act(async () => root?.unmount());
	}
	container?.remove();
	root = null;
	container = null;
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Transcript failure navigation", () => {
	it("shows failure controls only when the conversation has failures", () => {
		const messages = [chatMessage({ failure, id: "assistant-1" })];
		const withFailures = renderTranscript(messages, { failedTurnCount: 2 });
		const withoutFailures = renderTranscript(messages, { failedTurnCount: 0 });

		expect(withFailures).toContain("1 messages");
		expect(withFailures).toContain("2 failed");
		expect(withFailures).toContain('aria-label="Previous failed message"');
		expect(withFailures).toContain('aria-label="Next failed message"');
		expect(withoutFailures).not.toContain("Previous failed message");
		expect(withoutFailures).not.toContain("Next failed message");
	});

	it("cycles failures and removes the temporary highlight", async () => {
		const messages = [
			chatMessage({ failure, id: "assistant-1", seq: 1 }),
			chatMessage({ failure, id: "assistant-2", seq: 2 }),
		];

		await act(async () => {
			root?.render(
				createElement(Transcript, {
					failedTurnCount: 2,
					messages,
					onPageChange: vi.fn(),
					page: 1,
					pageSize: 50,
					total: 2,
				}),
			);
		});

		const next = container?.querySelector<HTMLButtonElement>(
			'button[aria-label="Next failed message"]',
		);
		const previous = container?.querySelector<HTMLButtonElement>(
			'button[aria-label="Previous failed message"]',
		);
		expect(next).not.toBeNull();
		expect(previous).not.toBeNull();

		await act(async () => next?.click());
		expect(scrolledIds).toEqual(["message-assistant-1"]);
		expect(
			container?.querySelector("#message-assistant-1")?.className,
		).toContain("ring-2");

		await act(async () => next?.click());
		await act(async () => previous?.click());
		expect(scrolledIds).toEqual([
			"message-assistant-1",
			"message-assistant-2",
			"message-assistant-1",
		]);

		await act(async () => vi.advanceTimersByTime(1_600));
		expect(
			container?.querySelector("#message-assistant-1")?.className,
		).not.toContain("ring-2");
	});
});

describe("Transcript usage", () => {
	it("aggregates matching calls and ignores calls without a message ID", () => {
		const grouped = groupCallsByMessageId([
			aiCall({
				costUsd: 0.012,
				gatewayGenerationId: "generation-1",
				inputTokens: 120,
				messageId: "user-1",
				outputTokens: 30,
			}),
			aiCall({
				costUsd: 0.018,
				gatewayGenerationId: "generation-2",
				id: "22222222-2222-4222-8222-222222222222",
				inputTokens: 180,
				messageId: "user-1",
				outputTokens: 20,
			}),
			aiCall({
				id: "33333333-3333-4333-8333-333333333333",
				messageId: null,
			}),
		]);

		expect(grouped.size).toBe(1);
		expect(grouped.get("user-1")).toMatchObject({
			callCount: 2,
			costUsd: 0.03,
			gatewayGenerationIds: ["generation-1", "generation-2"],
			inputTokens: 300,
			outputTokens: 50,
		});
	});

	it("joins user-keyed usage to the final assistant message in its turn", () => {
		const messages = [
			chatMessage({ id: "user-1", role: "user", seq: 1 }),
			chatMessage({ id: "assistant-1", role: "assistant", seq: 2 }),
		];
		const calls = [
			aiCall({
				costUsd: 0.012,
				inputTokens: 120,
				messageId: "user-1",
				outputTokens: 30,
			}),
			aiCall({
				costUsd: 0.018,
				id: "22222222-2222-4222-8222-222222222222",
				inputTokens: 180,
				messageId: "user-1",
				outputTokens: 20,
			}),
		];

		const html = renderTranscript(messages, { calls });

		expect(html).toContain("300 in / 50 out tokens");
		expect(html).toContain("$0.03");
		expect(html).toContain("2 calls");
	});
});

describe("Transcript content", () => {
	it("formats assistant markdown without interpreting raw HTML", () => {
		const html = renderTranscript([
			chatMessage({
				parts: [
					{
						text: [
							"A **clear** answer with `code`.",
							"",
							"- First item",
							"- <script>unsafe()</script>",
							"",
							"```ts",
							"const safe = true;",
							"```",
						].join("\n"),
						type: "text",
					},
				],
			}),
		]);

		expect(html).toContain("<strong");
		expect(html).toContain("<code");
		expect(html).toContain("<ul");
		expect(html).toContain("<pre");
		expect(html).toContain("&lt;script&gt;unsafe()&lt;/script&gt;");
		expect(html).not.toContain("<script>unsafe()</script>");
	});

	it("collapses system prompts into a character-count row", () => {
		const html = renderTranscript([
			chatMessage({
				id: "system-1",
				parts: [{ text: "Keep answers brief.", type: "text" }],
				role: "system",
			}),
		]);

		expect(html).toContain("System prompt");
		expect(html).toContain("19 chars");
		expect(html).toContain("<details");
		expect(html).not.toContain("<details open");
	});
});

function renderTranscript(
	messages: ChatMessage[],
	overrides: Partial<Parameters<typeof Transcript>[0]> = {},
) {
	return renderToStaticMarkup(
		createElement(Transcript, {
			messages,
			onPageChange: vi.fn(),
			page: 1,
			pageSize: 50,
			total: messages.length,
			...overrides,
		}),
	);
}

function chatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		createdAt,
		failure: null,
		id: "assistant-1",
		metadata: null,
		parts: [{ text: "Assistant response", type: "text" }],
		role: "assistant",
		sentryEventId: null,
		seq: 1,
		...overrides,
	};
}

function aiCall(overrides: Partial<AiCall> = {}): AiCall {
	return {
		costUsd: null,
		createdAt,
		gatewayGenerationId: null,
		id: "11111111-1111-4111-8111-111111111111",
		inputTokens: null,
		messageId: "user-1",
		model: "anthropic/claude-sonnet",
		operation: "chat",
		outputTokens: null,
		provider: "anthropic",
		totalTokens: null,
		...overrides,
	};
}
