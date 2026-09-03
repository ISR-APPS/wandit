import type { ChatMessage } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	hydrateAiChatMessages,
	type WanditUIMessage,
} from "../../../lib/use-ai-chat";
import { ConversationContextMeter, ConversationCost } from "../token-usage";
import {
	coalesceMessageParts,
	isTransparentMessagePart,
	MessageParts,
	orderMessagePartEntries,
} from "./message-parts";
import { isVisibleAssistantReplyPart } from "./visible-reply-part";

vi.mock("@/lib/i18n", () => ({
	formatNumber: (value: number) => new Intl.NumberFormat("en").format(value),
	useTranslation: () => ({
		locale: "en",
		t: (key: string, params?: Record<string, unknown>) => {
			const values: Record<string, string> = {
				"errors.ai.capacity":
					"{provider} is over capacity right now. Please try again in a minute.",
				"workspace.chat.aiError.attribution.viaGateway":
					"{provider} via Vercel AI Gateway",
				"workspace.chat.aiError.kicker.provider": "Provider issue",
				"workspace.chat.aiError.queuedHint":
					"Generations already started will finish on their own.",
				"workspace.chat.aiError.retry": "Retry",
				"workspace.chat.aiError.retryHint": "Retry starts a new attempt.",
				"workspace.chat.pageEdit.editing": "Editing the page",
				"workspace.chat.pageEdit.inspected": "Inspected the page",
				"workspace.chat.pageEdit.receiptUpdatedSingle":
					"Page updated - v{n} · 1 edit",
				"workspace.chat.pageEdit.labels.insertSection":
					"Adding a section {position} {wid}",
				"workspace.chat.pageEdit.positions.after": "after",
				"workspace.chat.generateImage.queueing": "Queueing the generation…",
				"workspace.chat.usage.message":
					"Input {input} · Output {output} · Total {total} tokens",
				"workspace.chat.usage.messageWithSteps": "Σ {count} steps · {message}",
				"workspace.chat.usage.cached": "({tokens} cached)",
				"workspace.chat.usage.reasoning": "({tokens} reasoning)",
				"workspace.chat.usage.messageBreakdown":
					"No-cache tokens {noCache} · Cache-read tokens {cacheRead} · Cache-write tokens {cacheWrite} · Text tokens {text} · Reasoning tokens {reasoning}",
				"workspace.chat.usage.context": "Context",
				"workspace.chat.usage.conversationTotal":
					"{total} tokens total spent this conversation",
				"workspace.chat.usage.conversationCumulative":
					"Cumulative input {input} · Cumulative output {output}",
				"workspace.chat.usage.latestCacheReadShare":
					"Latest-turn cache-read share {share}",
				"workspace.chat.usage.conversationCost": "Cost {cost}",
				"workspace.chat.usage.conversationCredits": "{credits} credits",
			};
			const value = values[key] ?? key;

			return value.replace(/\{(\w+)\}/g, (_, name: string) =>
				String(params?.[name] ?? `{${name}}`),
			);
		},
	}),
	useDictionary: () => ({
		workspace: {
			chat: {
				mcpTool: {
					toolLabels: {},
					genericLabels: {
						fetch: { active: "Fetching data", past: "Fetched data" },
						create: { active: "Creating", past: "Created" },
						update: { active: "Updating", past: "Updated" },
						delete: { active: "Deleting", past: "Deleted" },
						publish: { active: "Publishing", past: "Published" },
						send: { active: "Sending", past: "Sent" },
						generate: { active: "Generating", past: "Generated" },
						other: { active: "Running an action", past: "Action completed" },
					},
				},
			},
		},
	}),
}));

vi.mock("../../../lib/ai-chat-context", () => ({
	useSharedAiChat: () => ({ prefillComposer: vi.fn() }),
}));

function asMessageParts(parts: unknown[]): WanditUIMessage["parts"] {
	return parts as WanditUIMessage["parts"];
}

function dynamicPart(toolCallId: string) {
	return {
		type: "dynamic-tool",
		toolName: "mcp_meta-ads_ads_get_ad_accounts",
		toolCallId,
		state: "input-available",
		input: {},
	};
}

function askPart(toolCallId: string, question: string) {
	return {
		type: "tool-ask_user",
		toolCallId,
		state: "input-available",
		input: { question },
	};
}

function imagePart(name: string) {
	return {
		type: "file",
		url: `https://example.com/${name}.png`,
		mediaType: "image/png",
		filename: `${name}.png`,
	};
}

function documentPart(name: string) {
	return {
		type: "file",
		url: `https://example.com/${name}.pdf`,
		mediaType: "application/pdf",
		filename: `${name}.pdf`,
	};
}

describe("coalesceMessageParts", () => {
	it.each([
		1, 2, 3, 4,
	])("groups %i consecutive image file part(s) into one image run", (count) => {
		const entries = coalesceMessageParts(
			asMessageParts(
				Array.from({ length: count }, (_, index) =>
					imagePart(`image-${index + 1}`),
				),
			),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("image-run");
		if (entries[0]?.kind !== "image-run") {
			throw new Error("Expected image run");
		}
		expect(entries[0].parts).toHaveLength(count);
		expect(entries[0].parts.map((part) => part.filename)).toEqual(
			Array.from({ length: count }, (_, index) => `image-${index + 1}.png`),
		);
	});

	it("splits image runs around a document file", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				imagePart("before"),
				documentPart("brief"),
				imagePart("after-1"),
				imagePart("after-2"),
			]),
		);

		expect(entries.map((entry) => entry.kind)).toEqual([
			"image-run",
			"part",
			"image-run",
		]);
		if (
			entries[0]?.kind !== "image-run" ||
			entries[1]?.kind !== "part" ||
			entries[2]?.kind !== "image-run"
		) {
			throw new Error("Expected image, document, image ordering");
		}
		expect(entries[0].parts.map((part) => part.filename)).toEqual([
			"before.png",
		]);
		expect(entries[1].part).toMatchObject({ filename: "brief.pdf" });
		expect(entries[2].parts.map((part) => part.filename)).toEqual([
			"after-1.png",
			"after-2.png",
		]);
	});

	it("preserves image, text, document, and image chronology", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				imagePart("first"),
				{ type: "text", text: "Between files", state: "done" },
				documentPart("notes"),
				imagePart("last"),
			]),
		);

		expect(entries.map(entryLabel)).toEqual([
			"image-run",
			"text",
			"file",
			"image-run",
		]);
	});

	it("groups consecutive dynamic tool calls under the first call", () => {
		const entries = coalesceMessageParts(
			asMessageParts([dynamicPart("mcp-1"), dynamicPart("mcp-2")]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("mcp-run");
		if (entries[0]?.kind !== "mcp-run") throw new Error("Expected MCP run");
		expect(entries[0].parts.map((part) => part.toolCallId)).toEqual([
			"mcp-1",
			"mcp-2",
		]);
		expect(entries[0].parts[0]?.toolCallId).toBe("mcp-1");
	});

	it("keeps a dynamic run together across step-start parts", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{ type: "step-start" },
				{ type: "step-start" },
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("mcp-run");
		if (entries[0]?.kind !== "mcp-run") throw new Error("Expected MCP run");
		expect(entries[0].parts).toHaveLength(2);
	});

	it("keeps a dynamic run together across step-start and reasoning parts", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{ type: "step-start" },
				{ type: "reasoning", text: "Thinking" },
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("mcp-run");
		if (entries[0]?.kind !== "mcp-run") throw new Error("Expected MCP run");
		expect(entries[0].parts).toHaveLength(2);
	});

	it("keeps a dynamic run together across reasoning parts", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{ type: "reasoning", text: "Thinking" },
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("mcp-run");
		if (entries[0]?.kind !== "mcp-run") throw new Error("Expected MCP run");
		expect(entries[0].parts).toHaveLength(2);
	});

	it("keeps one MCP receipt across a tool-scoped AI error part", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{
					type: "data-ai-error",
					data: {
						kind: "connector_rejected",
						source: "higgsfield",
						providerLabel: "Higgsfield",
						retryable: false,
						terminal: true,
						refunded: true,
						moderationStage: null,
						providerMessage: null,
						requestId: "request-1",
						toolCallId: "mcp-1",
					},
				},
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("mcp-run");
		if (entries[0]?.kind !== "mcp-run") throw new Error("Expected MCP run");
		expect(entries[0].parts.map((part) => part.toolCallId)).toEqual([
			"mcp-1",
			"mcp-2",
		]);
	});

	it("starts a new dynamic run after non-empty text", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{ type: "text", text: "A useful summary", state: "done" },
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries.map((entry) => entry.kind)).toEqual([
			"mcp-run",
			"part",
			"mcp-run",
		]);
	});

	it("starts a new dynamic run after empty text", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{ type: "text", text: "", state: "streaming" },
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries.map((entry) => entry.kind)).toEqual([
			"mcp-run",
			"part",
			"mcp-run",
		]);
	});

	it("keeps ask_user calls between dynamic runs", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				askPart("ask-1", "What is your audience?"),
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries.map((entry) => entry.kind)).toEqual([
			"mcp-run",
			"ask-run",
			"mcp-run",
		]);
	});

	it("keeps a dynamic run together across transparent hidden tools", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				{
					type: "tool-read_skill",
					toolCallId: "read-skill-1",
					state: "output-available",
					input: {},
					output: {},
				},
				dynamicPart("mcp-2"),
			]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("mcp-run");
		if (entries[0]?.kind !== "mcp-run") throw new Error("Expected MCP run");
		expect(entries[0].parts).toHaveLength(2);
	});

	it("renders page tools as their own run instead of bridging MCP receipts", () => {
		const insertSectionPart = {
			type: "tool-insert_section",
			toolCallId: "insert-section-1",
			state: "output-available",
			input: {
				anchorWid: "hero",
				position: "after",
				html: "<section><h2>New section</h2></section>",
			},
			output: { status: "applied", versionNumber: 3, message: "Done" },
		};

		expect(
			isTransparentMessagePart(
				insertSectionPart as WanditUIMessage["parts"][number],
			),
		).toBe(false);

		const entries = coalesceMessageParts(
			asMessageParts([
				dynamicPart("mcp-1"),
				insertSectionPart,
				dynamicPart("mcp-2"),
			]),
		);
		expect(entries.map((entry) => entry.kind)).toEqual([
			"mcp-run",
			"page-edit-run",
			"mcp-run",
		]);
		if (entries[1]?.kind !== "page-edit-run") {
			throw new Error("Expected page-edit run");
		}
		expect(entries[1].parts).toHaveLength(1);

		const html = renderMessage("assistant", [
			insertSectionPart,
			{ type: "text", text: "Section added.", state: "done" },
		]);
		expect(html).toContain("Section added.");
		expect(html).toContain("Page updated - v3 · 1 edit");
	});

	it("coalesces consecutive page tools across stream markers", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				{
					type: "tool-get_page_outline",
					toolCallId: "outline-1",
					state: "output-available",
					input: {},
					output: { status: "ok", versionNumber: 2 },
				},
				{ type: "step-start" },
				{
					type: "tool-replace_section",
					toolCallId: "replace-1",
					state: "input-available",
					input: {
						wid: "hero",
						html: "<section>Updated hero content</section>",
					},
				},
			]),
		);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.kind).toBe("page-edit-run");
		if (entries[0]?.kind !== "page-edit-run") {
			throw new Error("Expected page-edit run");
		}
		expect(entries[0].parts.map((part) => part.toolCallId)).toEqual([
			"outline-1",
			"replace-1",
		]);
	});

	it.each([
		"tool-get_page_outline",
		"tool-apply_element_ops",
		"tool-read_elements",
		"tool-read_theme",
		"tool-read_section",
		"tool-insert_section",
		"tool-replace_section",
	])("keeps %s visible to the page-edit renderer", (type) => {
		expect(
			isTransparentMessagePart({ type } as WanditUIMessage["parts"][number]),
		).toBe(false);
	});

	it("splits page-edit runs at visible message boundaries", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				{
					type: "tool-read_theme",
					toolCallId: "theme-1",
					state: "output-available",
					input: {},
					output: { status: "ok", versionNumber: 2 },
				},
				{ type: "text", text: "I found the current theme.", state: "done" },
				{
					type: "tool-read_section",
					toolCallId: "section-1",
					state: "input-available",
					input: { wid: "hero" },
				},
			]),
		);

		expect(entries.map((entry) => entry.kind)).toEqual([
			"page-edit-run",
			"part",
			"page-edit-run",
		]);
	});

	it("batches multiple image calls in one message but preserves one-call fallback", () => {
		const single = coalesceMessageParts(
			asMessageParts([toolPart("tool-generate_image", "image-1")]),
		);
		expect(single).toHaveLength(1);
		expect(single[0]?.kind).toBe("part");

		const multiple = coalesceMessageParts(
			asMessageParts([
				toolPart("tool-generate_image", "image-1"),
				{ type: "text", text: "Two shots are on the way.", state: "done" },
				toolPart("tool-generate_image", "image-2"),
			]),
		);

		expect(multiple.map((entry) => entry.kind)).toEqual([
			"image-batch",
			"part",
		]);
		if (multiple[0]?.kind !== "image-batch") {
			throw new Error("Expected image batch");
		}
		expect(multiple[0].parts.map((part) => part.toolCallId)).toEqual([
			"image-1",
			"image-2",
		]);
		expect(orderMessagePartEntries(multiple).map(entryLabel)).toEqual([
			"text",
			"image-batch",
		]);
	});

	it("renders a single image call through the existing standalone status UI", () => {
		const html = renderMessage("assistant", [
			{
				type: "tool-generate_image",
				toolCallId: "image-only",
				state: "input-available",
				input: {
					title: "Single studio shot",
					prompt: "A detailed studio image of the product",
					aspect: "1:1",
					count: 1,
					sourceImageUrls: [],
				},
			},
		]);

		expect(html).toContain("Queueing the generation…");
		expect(html).not.toContain("workspace.chat.imageBatch");
	});

	it("groups ask_user calls independently across step-start", () => {
		const entries = coalesceMessageParts(
			asMessageParts([
				askPart("ask-1", "What is your audience?"),
				{ type: "step-start" },
				askPart("ask-2", "What is your budget?"),
				dynamicPart("mcp-1"),
			]),
		);

		expect(entries.map((entry) => entry.kind)).toEqual(["ask-run", "mcp-run"]);
		if (entries[0]?.kind !== "ask-run") throw new Error("Expected ask run");
		expect(entries[0].parts.map((part) => part.toolCallId)).toEqual([
			"ask-1",
			"ask-2",
		]);
	});
});

function toolPart(type: string, toolCallId: string) {
	return {
		type,
		toolCallId,
		state: "output-available",
		input: {},
		output: { status: "queued", attemptId: "attempt-1" },
	};
}

function entryLabel(entry: ReturnType<typeof coalesceMessageParts>[number]) {
	if (entry.kind === "part") return entry.part.type;
	if (entry.kind === "mcp-run") return `mcp-run:${entry.section}`;
	return entry.kind;
}

describe("orderMessagePartEntries", () => {
	it("moves async job cards after the closing text (leads sequence)", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					askPart("ask-1", "Which niche?"),
					askPart("ask-2", "Which city?"),
					toolPart("tool-scrape_leads", "leads-1"),
					{ type: "text", text: "Je lance la recherche.", state: "done" },
				]),
			),
		);

		expect(entries.map(entryLabel)).toEqual([
			"ask-run",
			"text",
			"tool-scrape_leads",
		]);
	});

	it("moves the product-video card after the closing text", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					toolPart("tool-product_video", "product-video-1"),
					{
						text: "Your product clip is rendering.",
						state: "done",
						type: "text",
					},
				]),
			),
		);

		expect(entries.map(entryLabel)).toEqual(["text", "tool-product_video"]);
	});

	it("keeps connector receipts chronological when the run has no deliverables", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					askPart("ask-1", "Premium option?"),
					dynamicPart("mcp-1"),
					dynamicPart("mcp-2"),
					{ type: "text", text: "Ta vidéo est en route.", state: "done" },
				]),
			),
		);

		expect(entries.map(entryLabel)).toEqual([
			"ask-run",
			"mcp-run:receipt",
			"text",
		]);
	});

	it("adds a bottom deliverables entry for a run with media", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					{
						type: "dynamic-tool",
						toolName: "mcp_higgsfield_generate_image",
						toolCallId: "mcp-media",
						state: "output-available",
						input: {},
						output: { image: "https://cdn.example.com/out.png" },
					},
					{ type: "text", text: "Voilà.", state: "done" },
				]),
			),
		);

		expect(entries.map(entryLabel)).toEqual([
			"mcp-run:receipt",
			"text",
			"mcp-run:deliverables",
		]);
	});

	it("keeps relative order among moved cards and among conversational entries", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					toolPart("tool-generate_image", "img-1"),
					{ type: "text", text: "Mid-run note.", state: "done" },
					dynamicPart("mcp-1"),
					{ type: "text", text: "Closing text.", state: "done" },
					toolPart("tool-animate_image", "vid-1"),
				]),
			),
		);

		expect(entries.map(entryLabel)).toEqual([
			"text",
			"mcp-run:receipt",
			"text",
			"tool-generate_image",
			"tool-animate_image",
		]);
	});

	it("keeps image runs and text in chronological order", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					{
						type: "file",
						url: "https://example.com/a.png",
						mediaType: "image/png",
					},
					{ type: "text", text: "Voici.", state: "done" },
				]),
			),
		);

		expect(entries.map(entryLabel)).toEqual(["image-run", "text"]);
	});

	function settledDynamicPart(toolCallId: string) {
		return {
			type: "dynamic-tool",
			toolName: "mcp_tiktok-ads_advertiser_info_get",
			toolCallId,
			state: "output-available",
			input: {},
			output: { ok: true },
		};
	}

	it("folds settled receipts below everything when receiptsAtBottom", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					settledDynamicPart("mcp-1"),
					toolPart("tool-generate_image", "img-1"),
					{ type: "text", text: "Voilà.", state: "done" },
				]),
			),
			{ receiptsAtBottom: true },
		);

		expect(entries.map(entryLabel)).toEqual([
			"text",
			"tool-generate_image",
			"mcp-run:receipt",
		]);
	});

	it("keeps a run mid-approval chronological even with receiptsAtBottom", () => {
		const entries = orderMessagePartEntries(
			coalesceMessageParts(
				asMessageParts([
					{
						type: "dynamic-tool",
						toolName: "mcp_meta-ads_campaign_create",
						toolCallId: "mcp-responded",
						state: "approval-responded",
						input: {},
						approval: { id: "approval-1", approved: true },
					},
					{ type: "text", text: "J'attends la validation.", state: "done" },
				]),
			),
			{ receiptsAtBottom: true },
		);

		expect(entries.map(entryLabel)).toEqual(["mcp-run:receipt", "text"]);
	});
});

function renderMessage(
	role: WanditUIMessage["role"],
	parts: unknown[],
	isStreaming = false,
	metadata?: WanditUIMessage["metadata"],
): string {
	return renderToStaticMarkup(
		createElement(MessageParts, {
			message: {
				id: "message-1",
				metadata,
				role,
				parts: asMessageParts(parts),
			} as WanditUIMessage,
			tokenUsageVisible: true,
			isStreaming,
			isLastAssistantMessage: role === "assistant",
			onToolApprovalResponse: () => {},
		}),
	);
}

describe("MessageParts turn block", () => {
	const settledDynamicPart = {
		type: "dynamic-tool",
		toolName: "mcp_tiktok-ads_advertiser_info_get",
		toolCallId: "mcp-done",
		state: "output-available",
		input: {},
		output: { ok: true },
	};

	it.each([
		{
			expectedCopy: "workspace.chat.videoAttempt.product.queueing",
			input: {
				image: {
					mediaType: "image/png",
					url: "https://assets.example.com/product.png",
				},
				preset: "orbit",
				productName: "PulseBuds",
				title: "PulseBuds product video",
			},
			type: "tool-product_video",
		},
		{
			expectedCopy: "workspace.chat.videoAttempt.edit.queueing",
			input: {
				instruction: "Keep the framing and change the bottle to blue.",
				sourceAttemptId: "11111111-1111-4111-8111-111111111111",
				title: "Blue bottle edit",
			},
			type: "tool-edit_video",
		},
		{
			expectedCopy: "workspace.chat.videoAttempt.extend.queueing",
			input: {
				continuationBrief: "Continue the orbit into a close-up.",
				legCount: 1,
				legDurationSeconds: 5,
				sourceAttemptId: "11111111-1111-4111-8111-111111111111",
				title: "Extended orbit",
			},
			type: "tool-extend_video",
		},
	])("renders and counts $type as visible reply content", (testCase) => {
		const [part] = asMessageParts([
			{
				input: testCase.input,
				state: "input-available",
				toolCallId: `${testCase.type}-1`,
				type: testCase.type,
			},
		]);
		if (!part) throw new Error("Expected a video attempt tool part");

		expect(isVisibleAssistantReplyPart(part)).toBe(true);

		const html = renderMessage("assistant", [part]);
		expect(html).toContain(testCase.expectedCopy);
		expect(html.match(/>Wandit</g)).toHaveLength(1);
	});

	it("keeps the existing treatment for a single image", () => {
		const html = renderMessage("user", [imagePart("solo")]);

		expect(html).toContain(
			'class="relative block aspect-[6/5] w-48 max-w-full overflow-hidden rounded-xl border border-border bg-muted"',
		);
		expect(html).toContain('data-slot="skeleton"');
		expect(html).toContain(
			'class="absolute inset-0 size-full object-cover opacity-0"',
		);
		expect(html).toContain('href="https://example.com/solo.png"');
		expect(html).toContain('alt="solo.png"');
		expect(html).toContain('loading="lazy"');
		expect(html).not.toContain("grid-cols-2");
	});

	it("renders consecutive images as one trailing two-column grid", () => {
		const html = renderMessage("user", [
			imagePart("one"),
			imagePart("two"),
			imagePart("three"),
			imagePart("four"),
		]);

		expect(html).toContain('class="flex justify-end"');
		expect(html).toContain(
			'class="grid w-full max-w-[86%] grid-cols-2 gap-1.5"',
		);
		expect(html.match(/aspect-square/g)).toHaveLength(4);
		expect(
			html.match(/class="absolute inset-0 size-full object-cover opacity-0"/g),
		).toHaveLength(4);
		expect(html.match(/data-slot="skeleton"/g)).toHaveLength(4);
		expect(html.match(/loading="lazy"/g)).toHaveLength(4);
		for (const name of ["one", "two", "three", "four"]) {
			expect(html).toContain(`href="https://example.com/${name}.png"`);
			expect(html).toContain(`alt="${name}.png"`);
		}
	});

	it("hoists one Wandit header above the tool receipt", () => {
		const html = renderMessage("assistant", [settledDynamicPart]);

		// The receipt lives INSIDE the turn, under the Wandit header — never
		// floating above it in the thread gap.
		expect(html).toContain(">Wandit<");
		expect(html.indexOf(">Wandit<")).toBeLessThan(
			html.indexOf("aria-expanded"),
		);
	});

	it("renders a single header for a receipt-plus-text turn", () => {
		const html = renderMessage("assistant", [
			settledDynamicPart,
			{ type: "text", text: "Voilà le résultat.", state: "done" },
		]);

		expect(html.match(/>Wandit</g)).toHaveLength(1);
		expect(html).toContain("Voilà le résultat.");
	});

	it("renders no header on user messages", () => {
		const html = renderMessage("user", [
			{ type: "text", text: "salut", state: "done" },
		]);

		expect(html).toContain("salut");
		expect(html).not.toContain(">Wandit<");
	});

	it("silently ignores the billing data part owned by the upgrade modal", () => {
		const html = renderMessage("assistant", [
			{
				type: "data-billing-error",
				data: {
					code: "INSUFFICIENT_CREDITS",
					statusCode: 402,
					details: { requiredCredits: 10, availableCredits: 2 },
				},
			},
		]);

		expect(html).toBe("");
	});

	it("silently ignores the credits-settled signal consumed by the chat hook", () => {
		const html = renderMessage("assistant", [
			{
				type: "data-credits-settled",
				data: {
					usageEventId: "usage-event-1",
					credits: 0.37,
					settledBalance: 12.63,
				},
			},
		]);

		expect(html).toBe("");
	});

	describe("persisted AI errors", () => {
		const errorPart = {
			type: "data-ai-error",
			errorText: "RAW_ERROR_TEXT_MUST_NOT_RENDER",
			data: {
				kind: "capacity",
				source: "provider:anthropic",
				providerLabel: "Anthropic",
				retryable: true,
				terminal: true,
				refunded: false,
				moderationStage: null,
				providerMessage: null,
				requestId: "request-1",
			},
		};

		function renderPersistedError({
			status = "error",
			isLast = true,
			queued = false,
		}: {
			status?: "error" | "ready" | "streaming";
			isLast?: boolean;
			queued?: boolean;
		} = {}) {
			return renderToStaticMarkup(
				createElement(MessageParts, {
					message: {
						id: "failed-assistant",
						role: "assistant",
						parts: asMessageParts([
							errorPart,
							...(queued
								? [
										{
											type: "tool-read_skill",
											toolCallId: "queued-work",
											state: "output-available",
											input: {},
											output: { status: "queued" },
										},
									]
								: []),
						]),
					} as WanditUIMessage,
					tokenUsageVisible: true,
					isStreaming: status === "streaming",
					isLastAssistantMessage: isLast,
					chatStatus: status,
					onRetry: () => {},
					onToolApprovalResponse: () => {},
				}),
			);
		}

		it("renders distinct kicker, body, attribution and safe Retry copy", () => {
			const html = renderPersistedError();

			expect(html).toContain("Provider issue");
			expect(html).toContain(
				"Anthropic is over capacity right now. Please try again in a minute.",
			);
			expect(html).toContain("Anthropic via Vercel AI Gateway");
			expect(html).toContain(">Retry<");
			expect(html).not.toContain("RAW_ERROR_TEXT_MUST_NOT_RENDER");
		});

		it("hides Retry while streaming", () => {
			expect(renderPersistedError({ status: "streaming" })).not.toContain(
				">Retry<",
			);
		});

		it("hides Retry and explains already queued work", () => {
			const html = renderPersistedError({ queued: true });

			expect(html).not.toContain(">Retry<");
			expect(html).toContain(
				"Generations already started will finish on their own.",
			);
		});

		it("hides Retry on a non-last failed message", () => {
			expect(renderPersistedError({ isLast: false })).not.toContain(">Retry<");
		});
	});

	it("renders a persisted target chip above a targeted user message", () => {
		const html = renderMessage(
			"user",
			[{ type: "text", text: "Make this warmer", state: "done" }],
			false,
			{
				selectedTarget: {
					wid: "e-17",
					tag: "article",
					excerpt: "Handmade in Algiers",
				},
			},
		);

		expect(html).toContain('title="e-17"');
		expect(html).toContain('<bdi dir="ltr"');
		expect(html).toContain("article");
		expect(html).toContain("Handmade in Algiers");
		expect(html.indexOf("article")).toBeLessThan(
			html.indexOf("Make this warmer"),
		);
	});

	it("renders ordered target chips with matching circled numbers", () => {
		const html = renderMessage(
			"user",
			[{ type: "text", text: "Update both", state: "done" }],
			false,
			{
				selectedTargets: [
					{ wid: "hero-title", tag: "h1", excerpt: "Build faster" },
					{ wid: "hero-cta", tag: "a", excerpt: "Start now" },
				],
			},
		);

		expect(html).toContain("①");
		expect(html).toContain("②");
		expect(html).toContain('aria-label="Target 1: h1 — Build faster"');
		expect(html).toContain('aria-label="Target 2: a — Start now"');
		expect(html.indexOf("①")).toBeLessThan(html.indexOf("hero-title"));
		expect(html.indexOf("hero-title")).toBeLessThan(html.indexOf("②"));
		expect(html.indexOf("②")).toBeLessThan(html.indexOf("hero-cta"));
		expect(html.indexOf("hero-cta")).toBeLessThan(html.indexOf("Update both"));
	});

	it("prefers ordered targets over legacy metadata when both are present", () => {
		const html = renderMessage(
			"user",
			[{ type: "text", text: "Update this", state: "done" }],
			false,
			{
				selectedTargets: [
					{ wid: "current-target", tag: "p", excerpt: "Current" },
				],
				selectedTarget: {
					wid: "legacy-target",
					tag: "div",
					excerpt: "Legacy",
				},
			},
		);

		expect(html).toContain('title="current-target"');
		expect(html).not.toContain("legacy-target");
	});

	it("renders a target chip after seeding a persisted history row", () => {
		const persisted: ChatMessage = {
			id: "persisted-target-turn",
			chatId: "11111111-1111-4111-8111-111111111111",
			role: "user",
			parts: [{ type: "text", text: "Tighten this headline" }],
			metadata: {
				selectedTarget: {
					wid: "hero-title",
					tag: "h1",
					excerpt: "A clearer way to grow",
				},
			},
			seq: 4,
			createdAt: "2026-08-01T10:00:00.000Z",
		};
		const [hydrated] = hydrateAiChatMessages([persisted]);
		if (!hydrated) throw new Error("Expected persisted user row to hydrate");

		const html = renderToStaticMarkup(
			createElement(MessageParts, {
				message: hydrated,
				tokenUsageVisible: true,
				isStreaming: false,
				isLastAssistantMessage: false,
				onToolApprovalResponse: () => {},
			}),
		);

		expect(html).toContain('title="hero-title"');
		expect(html).toContain(">h1</bdi>");
		expect(html).toContain("A clearer way to grow");
		expect(html.indexOf(">h1</bdi>")).toBeLessThan(
			html.indexOf("Tighten this headline"),
		);
	});

	it("renders nothing for a turn of transparent parts", () => {
		const html = renderMessage("assistant", [
			{ type: "step-start" },
			{ type: "reasoning", text: "thinking" },
			{ type: "text", text: "", state: "streaming" },
		]);

		expect(html).toBe("");
	});

	it("renders exactly one header when an ask round follows a receipt", () => {
		const html = renderMessage("assistant", [
			settledDynamicPart,
			{
				type: "tool-ask_user",
				toolCallId: "ask-1",
				state: "input-available",
				input: { question: "Quel budget ?" },
			},
		]);

		expect(html.match(/>Wandit</g)).toHaveLength(1);
		// The ask card itself starts collapsed: its summary row is present, the
		// question text stays behind the toggle.
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("Quel budget ?");
	});

	it("folds the settled receipt below the closing text once the turn ends", () => {
		const html = renderMessage(
			"assistant",
			[
				settledDynamicPart,
				{ type: "text", text: "Réponse finale.", state: "done" },
			],
			false,
		);

		// Done turn: prose first, quiet receipt chip at the bottom.
		expect(html.indexOf("Réponse finale.")).toBeLessThan(
			html.indexOf("aria-expanded"),
		);
	});

	it("conceals the concluded receipt in place while the turn still streams", () => {
		// Trailing step-start keeps the text part off the "last part" slot so
		// the static render shows its full text (the streaming reveal starts
		// at zero characters and no effects run here).
		const html = renderMessage(
			"assistant",
			[
				settledDynamicPart,
				{ type: "text", text: "Réponse en cours.", state: "done" },
				{ type: "step-start" },
			],
			true,
		);

		// Chronological spot kept (above the prose), but animated out: prose
		// started under the run, so the receipt hides until the turn ends.
		expect(html.indexOf("aria-expanded")).toBeLessThan(
			html.indexOf("Réponse en cours."),
		);
		expect(html).toContain("max-h-0");
	});

	it("keeps a still-running receipt visible above the streaming text", () => {
		const html = renderMessage(
			"assistant",
			[
				{
					type: "dynamic-tool",
					toolName: "mcp_tiktok-ads_campaign_get_list",
					toolCallId: "mcp-live",
					state: "input-available",
					input: {},
				},
				{ type: "text", text: "Je regarde.", state: "done" },
				{ type: "step-start" },
			],
			true,
		);

		expect(html.indexOf("aria-expanded")).toBeLessThan(
			html.indexOf("Je regarde."),
		);
		expect(html).not.toContain("max-h-0");
	});

	it("renders one compact usage footer for an assistant turn", () => {
		const html = renderMessage(
			"assistant",
			[{ type: "text", text: "Done.", state: "done" }],
			false,
			{
				model: "provider/model",
				stepCount: 3,
				usage: {
					inputTokens: 8_421,
					inputTokenDetails: {
						noCacheTokens: 421,
						cacheReadTokens: 8_000,
						cacheWriteTokens: 300,
					},
					outputTokens: 950,
					outputTokenDetails: {
						textTokens: 700,
						reasoningTokens: 250,
					},
					totalTokens: 9_371,
				},
			},
		);

		expect(html).toContain(
			"Σ 3 steps · Input 8.4k (8k cached) · Output 950 (250 reasoning) · Total 9.4k tokens",
		);
		expect(html).toContain(
			'title="No-cache tokens 421 · Cache-read tokens 8,000 · Cache-write tokens 300 · Text tokens 700 · Reasoning tokens 250"',
		);
		expect(html.match(/Input 8\.4k/g)).toHaveLength(1);
	});

	it("shows cumulative usage and the latest cache share in the context tooltip", () => {
		const html = renderToStaticMarkup(
			createElement(ConversationContextMeter, {
				messages: [
					{
						id: "assistant-1",
						role: "assistant",
						parts: [],
						metadata: {
							usage: {
								inputTokens: 120_000,
								inputTokenDetails: { cacheReadTokens: 90_000 },
								outputTokens: 3_400,
								totalTokens: 125_000,
							},
						},
					} as WanditUIMessage,
				],
			}),
		);

		expect(html).toContain(
			'title="125,000 tokens total spent this conversation · Cumulative input 120,000 · Cumulative output 3,400 · Latest-turn cache-read share 75%"',
		);
	});

	it("renders reconciled conversation cost and credits when available", () => {
		const html = renderToStaticMarkup(
			createElement(ConversationCost, {
				usage: {
					inputTokens: 190_000,
					outputTokens: 4_000,
					cacheReadTokens: 120_000,
					cacheWriteTokens: null,
					costUsdMicros: 130_000,
					creditsCenti: 123,
				},
			}),
		);

		expect(html).toContain("Cost $0.13 · 1.23 credits");
	});

	it("hides conversation spend when the staff endpoint has no data", () => {
		expect(
			renderToStaticMarkup(
				createElement(ConversationCost, { usage: undefined }),
			),
		).toBe("");
	});
});
