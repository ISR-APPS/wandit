import { QueryClient } from "@tanstack/react-query";
import {
	aiChatMessageMetadataSchema,
	type ChatMessage,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { toUpgradeModalIntent } from "@/features/billing/lib/billing-error-dispatch";
import { creditsKeys } from "@/features/credits/api/credits.queries";
import {
	applyCreditsSettled,
	findLastTerminalAiErrorMessage,
	findRetryRequestMetadata,
	hydrateAiChatMessages,
	isAppliedPageEditPart,
	messageHasQueuedToolWork,
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
	const composer = {
		mode: "page" as const,
		output: "landing-page",
		options: { builderModel: "anthropic/claude-sonnet-4.5" },
	};

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

	it("accepts durable request context on a user message", () => {
		expect(
			aiChatMessageMetadataSchema.parse({
				composer,
				selectedWids: ["hero", "cta"],
			}),
		).toEqual({ composer, selectedWids: ["hero", "cta"] });
	});

	it("normalizes dashboard rows that stored composer metadata directly", () => {
		const [message] = hydrateAiChatMessages([
			chatRow("user", { mode: "page", skills: ["ads-meta"] }),
		]);

		expect(message?.metadata?.composer).toEqual({
			mode: "page",
			skills: ["ads-meta"],
		});
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

describe("AI error turn lookup", () => {
	function message(
		id: string,
		role: WanditUIMessage["role"],
		parts: unknown[],
	): WanditUIMessage {
		return { id, role, parts } as WanditUIMessage;
	}

	const terminalError = {
		type: "data-ai-error",
		data: {
			kind: "capacity",
			source: "gateway",
			providerLabel: null,
			retryable: true,
			terminal: true,
			refunded: null,
			moderationStage: null,
			providerMessage: null,
			requestId: null,
		},
	};

	it("selects the last assistant row with a whole-turn terminal part", () => {
		const first = message("assistant-1", "assistant", [terminalError]);
		const toolScoped = message("assistant-2", "assistant", [
			{
				...terminalError,
				data: { ...terminalError.data, toolCallId: "tool-1" },
			},
		]);
		const last = message("assistant-3", "assistant", [terminalError]);

		expect(findLastTerminalAiErrorMessage([first, toolScoped, last])?.id).toBe(
			"assistant-3",
		);
	});

	it("detects queued tool output on the failed row", () => {
		const failed = message("assistant-1", "assistant", [
			terminalError,
			{
				type: "tool-generate_image",
				toolCallId: "image-1",
				state: "output-available",
				input: {},
				output: { status: "queued", attemptId: "attempt-1" },
			},
		]);

		expect(messageHasQueuedToolWork(failed)).toBe(true);
		expect(
			messageHasQueuedToolWork(
				message("assistant-2", "assistant", [terminalError]),
			),
		).toBe(false);
	});

	it("restores composer and target ids before retrying a reloaded turn", () => {
		const composer = {
			mode: "page" as const,
			output: "landing-page",
			options: { builderModel: "anthropic/claude-sonnet-4.5" },
		};
		const user = {
			id: "user-1",
			role: "user",
			parts: [{ type: "text", text: "Build this page", state: "done" }],
			metadata: {
				composer,
				selectedWids: ["hero", "cta"],
				selectedTargets: [
					{ wid: "hero", tag: "section", excerpt: "Hero" },
					{ wid: "cta", tag: "button", excerpt: "Start" },
				],
			},
		} as WanditUIMessage;
		const failed = message("assistant-1", "assistant", [terminalError]);

		expect(findRetryRequestMetadata([user, failed], failed.id)).toEqual({
			composer,
			selectedWids: ["hero", "cta"],
		});
	});

	it("derives target ids from legacy selected-target snapshots", () => {
		const user = {
			id: "user-legacy",
			role: "user",
			parts: [{ type: "text", text: "Change these", state: "done" }],
			metadata: {
				selectedTargets: [
					{ wid: "hero", tag: "section", excerpt: null },
					{ wid: "cta", tag: "button", excerpt: null },
				],
			},
		} as WanditUIMessage;
		const failed = message("assistant-legacy", "assistant", [terminalError]);

		expect(findRetryRequestMetadata([user, failed], failed.id)).toEqual({
			selectedWids: ["hero", "cta"],
		});
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
