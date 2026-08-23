import { QueryClient } from "@tanstack/react-query";
import {
	aiChatMessageMetadataSchema,
	type ChatMessage,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { toUpgradeModalIntent } from "@/features/billing/lib/billing-error-dispatch";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import { ApiClientError } from "@/lib/api-client";
import {
	applyCreditsSettled,
	chatStreamErrorKey,
	hydrateAiChatMessages,
	isAppliedPageEditPart,
	nextBillingErrorInTurn,
	type WanditUIMessage,
} from "./use-ai-chat";

function chatRow(
	role: ChatMessage["role"],
	metadata: ChatMessage["metadata"],
): ChatMessage {
	return {
		id: `message-${role}`,
		chatId: "11111111-1111-4111-8111-111111111111",
		role,
		parts: [{ type: "text", text: "Change this" }],
		metadata,
		seq: 1,
		createdAt: "2026-08-01T10:00:00.000Z",
	};
}

describe("AI chat target metadata", () => {
	it("accepts ordered target descriptors", () => {
		expect(
			aiChatMessageMetadataSchema.parse({
				selectedTargets: [
					{
						wid: "e-24",
						tag: "h2",
						excerpt: "A better headline",
					},
					{ wid: "cta", tag: "a", excerpt: "Try it now" },
				],
			}),
		).toEqual({
			selectedTargets: [
				{
					wid: "e-24",
					tag: "h2",
					excerpt: "A better headline",
				},
				{ wid: "cta", tag: "a", excerpt: "Try it now" },
			],
		});
	});

	it("hydrates persisted ordered target metadata on user rows", () => {
		const [message] = hydrateAiChatMessages([
			chatRow("user", {
				selectedTargets: [
					{
						wid: "hero",
						tag: "section",
						excerpt: "Built for independent teams",
					},
					{ wid: "cta", tag: "button", excerpt: "Start now" },
				],
			}),
		]);

		expect(message?.metadata?.selectedTargets).toEqual([
			{
				wid: "hero",
				tag: "section",
				excerpt: "Built for independent teams",
			},
			{ wid: "cta", tag: "button", excerpt: "Start now" },
		]);
	});

	it("continues to hydrate a legacy single target", () => {
		const [message] = hydrateAiChatMessages([
			chatRow("user", {
				selectedTarget: {
					wid: "hero",
					tag: "section",
					excerpt: "Built for independent teams",
				},
			}),
		]);

		expect(message?.metadata?.selectedTarget).toEqual({
			wid: "hero",
			tag: "section",
			excerpt: "Built for independent teams",
		});
	});

	it("keeps old user rows without typed metadata unchanged", () => {
		const [message] = hydrateAiChatMessages([
			chatRow("user", { composer: { mode: "build" } }),
		]);

		expect(message?.metadata?.selectedTarget).toBeUndefined();
	});
});

describe("billing error turn state", () => {
	it("stays set when a billing data part is followed by a generic error", () => {
		const billingPartIntent = toUpgradeModalIntent({
			type: "data-billing-error",
			data: {
				code: "INSUFFICIENT_CREDITS",
				statusCode: 402,
				details: { requiredCredits: 25, availableCredits: 7 },
			},
		});
		const afterBillingPart = nextBillingErrorInTurn(false, billingPartIntent);
		const afterGenericError = nextBillingErrorInTurn(
			afterBillingPart,
			toUpgradeModalIntent(new Error("Insufficient credits.")),
		);

		expect(afterBillingPart).toBe(true);
		expect(afterGenericError).toBe(true);
	});
});

describe("credits-settled data part", () => {
	const settled = {
		credits: 0.37,
		settledBalance: 12.63,
		usageEventId: "usage-event-1",
	};

	it("seeds the cached settled balance once, then refetches all credits queries", () => {
		const queryClient = new QueryClient();
		const invalidate = vi
			.spyOn(queryClient, "invalidateQueries")
			.mockResolvedValue(undefined);
		queryClient.setQueryData(creditsKeys.balance(), {
			balance: 12,
			plan: 12,
			promo: 0,
			settledBalance: 13,
			settledPlan: 13,
			settledPromo: 0,
			settledTopup: 0,
			topup: 0,
		});

		applyCreditsSettled(queryClient, settled);

		expect(queryClient.getQueryData(creditsKeys.balance())).toEqual(
			expect.objectContaining({ balance: 12, settledBalance: 12.63 }),
		);
		expect(invalidate).toHaveBeenCalledWith({ queryKey: creditsKeys.all });
	});

	it("does not create a partial balance row when nothing is cached", () => {
		const queryClient = new QueryClient();
		vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

		applyCreditsSettled(queryClient, settled);

		expect(queryClient.getQueryData(creditsKeys.balance())).toBeUndefined();
	});
});

describe("replay conflict detection", () => {
	function apiError(code: string, statusCode: number) {
		return new ApiClientError({
			code,
			message: "conflict",
			path: "/v1/chats/chat-1/ai-stream",
			requestId: "req-1",
			statusCode,
			timestamp: "2026-08-04T19:16:58.000Z",
		});
	}

	it("maps each server refusal to its own copy and everything else to generic", () => {
		expect(
			chatStreamErrorKey(apiError("AI_CHAT_OPERATION_REPLAYED", 409)),
		).toBe("workspace.chat.errors.replayed");
		expect(chatStreamErrorKey(apiError("AI_CHAT_TURN_ACTIVE", 409))).toBe(
			"workspace.chat.errors.busy",
		);
		expect(chatStreamErrorKey(apiError("INSUFFICIENT_CREDITS", 402))).toBe(
			"workspace.chat.errors.stream",
		);
		expect(chatStreamErrorKey(new Error("stream died"))).toBe(
			"workspace.chat.errors.stream",
		);
		expect(chatStreamErrorKey(undefined)).toBe("workspace.chat.errors.stream");
	});
});

describe("page edit invalidation", () => {
	function part(value: unknown) {
		return value as WanditUIMessage["parts"][number];
	}

	it.each([
		["section replacement", "tool-replace_section"],
		["element-op batch", "tool-apply_element_ops"],
		["section insertion", "tool-insert_section"],
	])("recognizes an applied %s", (_label, type) => {
		expect(
			isAppliedPageEditPart(
				part({
					type,
					toolCallId: "edit-1",
					state: "output-available",
					input: {},
					output: { status: "applied", message: "Done" },
				}),
			),
		).toBe(true);
	});

	it.each([
		["rejected element-op batch", "tool-apply_element_ops"],
		["rejected section insertion", "tool-insert_section"],
	])("ignores a %s", (_label, type) => {
		expect(
			isAppliedPageEditPart(
				part({
					type,
					toolCallId: "edit-1",
					state: "output-available",
					input: {},
					output: { status: "rejected", message: "No change" },
				}),
			),
		).toBe(false);
	});

	it("ignores an unfinished page edit", () => {
		expect(
			isAppliedPageEditPart(
				part({
					type: "tool-replace_section",
					toolCallId: "replace-1",
					state: "input-available",
					input: {},
				}),
			),
		).toBe(false);
	});
});
