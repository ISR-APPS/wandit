import { supportRoutes } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	ApiService: { get: vi.fn() },
}));

import { ApiService } from "@/lib/api-client";

import { getChatIdentity } from "./support.services";

const mockedGet = vi.mocked(ApiService.get);

describe("getChatIdentity", () => {
	beforeEach(() => {
		mockedGet.mockReset();
	});

	it("calls the chat-identity route and parses the payload", async () => {
		mockedGet.mockResolvedValueOnce({
			identifier: "user_1",
			identifierHash: "a".repeat(64),
			name: "Zack",
			email: "zack@example.com",
			avatarUrl: null,
		});

		const identity = await getChatIdentity();

		expect(mockedGet).toHaveBeenCalledWith(supportRoutes.chatIdentity);
		expect(identity.identifier).toBe("user_1");
		expect(identity.identifierHash).toHaveLength(64);
	});

	it("rejects a malformed hash", async () => {
		mockedGet.mockResolvedValueOnce({
			identifier: "user_1",
			identifierHash: "short",
			name: null,
			email: null,
			avatarUrl: null,
		});

		await expect(getChatIdentity()).rejects.toThrow();
	});
});
