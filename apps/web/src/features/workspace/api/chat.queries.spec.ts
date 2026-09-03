import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/use-token-usage-visible", () => ({
	useTokenUsageVisible: vi.fn(),
}));

vi.mock("./chat.services", () => ({
	getChatByProject: vi.fn(),
	getChatMessages: vi.fn(),
	getChatUsage: vi.fn(),
}));

import { chatKeys, createChatUsageQueryOptions } from "./chat.queries";
import { getChatUsage } from "./chat.services";

const chatId = "11111111-1111-4111-8111-111111111111";

describe("useChatUsageQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getChatUsage).mockResolvedValue({
			inputTokens: 10,
			outputTokens: 2,
			cacheReadTokens: null,
			cacheWriteTokens: null,
			costUsdMicros: 100,
			creditsCenti: 1,
		});
	});

	it("stays disabled without staff visibility or a chat id", () => {
		expect(createChatUsageQueryOptions(chatId, 1, false).enabled).toBe(false);
		expect(createChatUsageQueryOptions(undefined, 1, true).enabled).toBe(false);
	});

	it("changes keys when another assistant turn completes", async () => {
		const firstTurn = createChatUsageQueryOptions(chatId, 1, true);
		const secondTurn = createChatUsageQueryOptions(chatId, 2, true);

		expect(firstTurn.enabled).toBe(true);
		expect(firstTurn.queryKey).not.toEqual(secondTurn.queryKey);
		expect(chatKeys.usage(chatId, 2)).toEqual(["chat", "usage", chatId, 2]);
		await secondTurn.queryFn();
		expect(getChatUsage).toHaveBeenCalledWith(chatId);
	});

	it("does not retry a denied staff-only request", async () => {
		vi.mocked(getChatUsage).mockRejectedValue(new Error("not found"));
		const options = createChatUsageQueryOptions(chatId, 1, true);

		await expect(options.queryFn()).rejects.toThrow("not found");
		expect(getChatUsage).toHaveBeenCalledOnce();
		expect(options.retry).toBe(false);
		expect(options.refetchOnReconnect).toBe(false);
		expect(options.refetchOnWindowFocus).toBe(false);
	});
});
