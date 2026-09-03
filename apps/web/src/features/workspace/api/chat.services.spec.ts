import { chatsRoutes } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
	},
}));

import { apiClient } from "@/lib/api-client";
import { getChatUsage } from "./chat.services";

describe("getChatUsage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches and validates the staff conversation aggregate", async () => {
		const chatId = "11111111-1111-4111-8111-111111111111";
		const response = {
			inputTokens: 190_000,
			outputTokens: 4_000,
			cacheReadTokens: 120_000,
			cacheWriteTokens: null,
			costUsdMicros: 130_000,
			creditsCenti: 123,
		};
		vi.mocked(apiClient.get).mockResolvedValue(response);

		await expect(getChatUsage(chatId)).resolves.toEqual(response);
		expect(apiClient.get).toHaveBeenCalledWith(chatsRoutes.usage(chatId));
	});

	it("rejects a malformed aggregate", async () => {
		vi.mocked(apiClient.get).mockResolvedValue({ costUsdMicros: "0.13" });

		await expect(getChatUsage("chat-1")).rejects.toThrow();
	});
});
