import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToolPartCard } from "./tool-part-card";

function renderPart(part: unknown) {
	return renderToStaticMarkup(createElement(ToolPartCard, { index: 0, part }));
}

function expectFailure(part: unknown, expected: boolean) {
	expect(renderPart(part).includes('data-tool-failure="true"')).toBe(expected);
}

describe("tool summaries", () => {
	it("extracts and caps a generation prompt digest", () => {
		const prompt =
			"An editorial product photograph with directional window light, a quiet stone backdrop, detailed material texture, and ample negative space.";
		const html = renderPart({
			input: { prompt },
			output: { status: "queued" },
			state: "output-available",
			type: "tool-generate_image",
		});

		const digest = `${prompt.slice(0, 89).trimEnd()}…`;
		expect(digest).toHaveLength(90);
		expect(html).toContain("Generate Image");
		expect(html).toContain("Done");
		expect(html).toContain(digest);
	});

	it("uses section identifiers for page operation digests", () => {
		const html = renderPart({
			input: { html: "<section>Updated</section>", wid: "hero-primary" },
			state: "input-available",
			type: "tool-replace_section",
		});

		expect(html).toContain("Replace Section");
		expect(html).toContain("Ready");
		expect(html).toContain("Section hero-primary");
	});

	it("names dynamic MCP tools and maps approval states", () => {
		const pending = renderPart({
			input: { accountId: "account-1" },
			state: "approval-requested",
			toolName: "mcp_meta-ads_get_campaigns",
			type: "dynamic-tool",
		});
		const denied = renderPart({
			approval: { approved: false },
			state: "approval-responded",
			toolName: "mcp_meta-ads_delete_campaign",
			type: "dynamic-tool",
		});

		expect(pending).toContain("Meta Ads Get Campaigns");
		expect(pending).toContain("Approval needed");
		expect(pending).toContain("mcp_meta-ads_get_campaigns");
		expect(denied).toContain("Denied");
	});

	it("summarizes data and unknown parts without throwing", () => {
		const data = renderPart({
			data: { message: "Credits were settled" },
			type: "data-credits-settled",
		});
		const unknown = renderPart(null);

		expect(data).toContain("Credits Settled");
		expect(data).toContain("Credits were settled");
		expect(unknown).toContain("Unknown part");
	});
});

describe("tool part failures", () => {
	it("detects lifecycle, output, and top-level failure signals", () => {
		expectFailure({ state: "output-error" }, true);
		expectFailure(
			{ output: { message: "Render failed", status: "failed" } },
			true,
		);
		expectFailure({ output: { isError: true } }, true);
		expectFailure({ output: { wanditError: { message: "No" } } }, true);
		expectFailure({ aiError: { message: "No" } }, true);
		expectFailure({ errorText: "Tool call was interrupted." }, true);
		expectFailure({ state: "output-available" }, false);
	});

	it("preserves a valid normalized AI error", () => {
		const html = renderPart({
			aiError: {
				kind: "rate_limited",
				moderationStage: null,
				providerLabel: "Higgsfield",
				providerMessage: "Try again later.",
				refunded: null,
				requestId: "request-17",
				retryable: true,
				source: "higgsfield",
				terminal: true,
			},
		});

		expect(html).toContain("Rate Limited");
		expect(html).toContain("Higgsfield");
		expect(html).toContain("Try again later.");
		expect(html).toContain("request-17");
	});

	it("shows a compact inline error and suppresses failed media previews", () => {
		const html = renderPart({
			output: {
				imageUrl: "https://assets.example.com/render.png",
				message: "The render provider stopped.",
				status: "failed",
			},
			state: "output-available",
			type: "tool-generate_image",
		});

		expect(html).toContain('data-tool-failure="true"');
		expect(html).toContain('data-ai-error="true"');
		expect(html).toContain("The render provider stopped.");
		expect(html).not.toContain("<img");
	});
});

describe("ToolPartCard", () => {
	it("renders separate input and output JSON panes with copy controls", () => {
		const html = renderPart({
			input: { prompt: "A ceramic vase" },
			output: { status: "queued" },
			state: "output-available",
			type: "tool-generate_image",
		});

		expect(html).toContain("Input JSON");
		expect(html).toContain("Output JSON");
		expect(html).toContain('aria-label="Copy input json"');
		expect(html).toContain('aria-label="Copy output json"');
	});

	it("renders recursive HTTPS image and video previews safely", () => {
		const html = renderPart({
			output: {
				deliverables: [
					{ image: { url: "https://assets.example.com/still.webp" } },
					{ videoUrl: "https://assets.example.com/clip.mp4" },
					{ type: "video", url: "https://assets.example.com/render/17" },
					{ imageUrl: "http://insecure.example.com/rejected.png" },
				],
				status: "complete",
			},
			state: "output-available",
			type: "dynamic-tool",
		});

		expect(html).toContain('src="https://assets.example.com/still.webp"');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('referrerPolicy="no-referrer"');
		expect(html).toContain('src="https://assets.example.com/clip.mp4"');
		expect(html).toContain('src="https://assets.example.com/render/17"');
		expect(html).not.toContain(
			'href="http://insecure.example.com/rejected.png"',
		);
	});

	it("keeps reasoning subtle and omits step-start JSON", () => {
		const reasoning = renderPart({ text: "private chain", type: "reasoning" });
		const step = renderPart({ type: "step-start" });

		expect(reasoning).toContain("Thought for a moment");
		expect(reasoning).not.toContain("private chain");
		expect(reasoning).not.toContain("<details");
		expect(step).toBe("");
	});

	it("keeps a circular unknown part inspectable", () => {
		const part: Record<string, unknown> = { type: "future-part" };
		part.self = part;
		const html = renderPart(part);

		expect(html).toContain("Future Part");
		expect(html).toContain("[Circular]");
	});
});
