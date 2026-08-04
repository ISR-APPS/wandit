import type { ChatMessage } from "@wandit/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	hydrateAiChatMessages,
	type WanditUIMessage,
} from "../../../lib/use-ai-chat";
import {
	coalesceMessageParts,
	MessageParts,
	orderMessagePartEntries,
} from "./message-parts";

vi.mock("@/lib/i18n", () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) => {
			const value =
				key === "workspace.chat.usage.message"
					? "Input {input} · Output {output} · Total {total} tokens"
					: key;

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

	it("keeps the existing treatment for a single image", () => {
		const html = renderMessage("user", [imagePart("solo")]);

		expect(html).toContain(
			'class="block max-w-48 overflow-hidden rounded-xl border border-border"',
		);
		expect(html).toContain('class="block max-h-40 w-full object-cover"');
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
		expect(html.match(/class="block size-full object-cover"/g)).toHaveLength(4);
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
		expect(html).toContain("Quel budget ?");
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
				usage: {
					inputTokens: 8_421,
					outputTokens: 950,
					totalTokens: 9_371,
				},
			},
		);

		expect(html).toContain("Input 8.4k · Output 950 · Total 9.4k tokens");
		expect(html.match(/Input 8\.4k/g)).toHaveLength(1);
	});
});
