import {
	aiChatMessageMetadataSchema,
	type ChatMessage,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	hydrateAiChatMessages,
	isAppliedPageEditPart,
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

describe("page edit invalidation", () => {
	function part(value: unknown) {
		return value as WanditUIMessage["parts"][number];
	}

	it("recognizes applied section replacements and element-op batches", () => {
		expect(
			isAppliedPageEditPart(
				part({
					type: "tool-replace_section",
					toolCallId: "replace-1",
					state: "output-available",
					input: {},
					output: { status: "applied", message: "Done" },
				}),
			),
		).toBe(true);
		expect(
			isAppliedPageEditPart(
				part({
					type: "tool-apply_element_ops",
					toolCallId: "ops-1",
					state: "output-available",
					input: {},
					output: { status: "applied", message: "Done" },
				}),
			),
		).toBe(true);
	});

	it("ignores rejected and unfinished page edits", () => {
		expect(
			isAppliedPageEditPart(
				part({
					type: "tool-apply_element_ops",
					toolCallId: "ops-1",
					state: "output-available",
					input: {},
					output: { status: "rejected", message: "No change" },
				}),
			),
		).toBe(false);
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
