import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api-client";
import { createStatusPreservingChatFetch } from "./status-preserving-chat-transport";

describe("status-preserving chat transport fetch", () => {
	it("preserves HTTP status, server code, and billing details", async () => {
		const response = new Response(
			JSON.stringify({
				error: {
					code: "INSUFFICIENT_CREDITS",
					details: { requiredCredits: 10, availableCredits: 3 },
					message: "Not enough credits",
					path: "/api/v1/ai-chat/chats/chat-1/stream",
					requestId: "request-402",
					statusCode: 402,
					timestamp: "2026-08-02T10:00:00.000Z",
				},
			}),
			{
				status: 402,
				statusText: "Payment Required",
				headers: { "content-type": "application/json" },
			},
		);
		const wrappedFetch = createStatusPreservingChatFetch(
			vi.fn().mockResolvedValue(response),
		);

		const promise = wrappedFetch("https://api.example.test/chat", {});
		await expect(promise).rejects.toMatchObject({
			statusCode: 402,
			code: "INSUFFICIENT_CREDITS",
			details: { requiredCredits: 10, availableCredits: 3 },
		});
		await promise.catch((error: unknown) => {
			expect(error).toBeInstanceOf(ApiClientError);
		});
	});

	it("keeps status on non-enveloped responses", async () => {
		const wrappedFetch = createStatusPreservingChatFetch(
			vi.fn().mockResolvedValue(
				new Response("upstream unavailable", {
					status: 503,
					statusText: "Service Unavailable",
				}),
			),
		);

		await expect(
			wrappedFetch("https://api.example.test/chat", {}),
		).rejects.toMatchObject({
			statusCode: 503,
			code: "HTTP_503",
		});
	});
});
