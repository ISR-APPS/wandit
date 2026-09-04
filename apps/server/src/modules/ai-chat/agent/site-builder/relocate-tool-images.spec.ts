import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
	modelNeedsToolImageRelocation,
	modelNeedsToolImageStripping,
	relocateToolResultImages,
	stripToolResultImages,
} from "./relocate-tool-images";

const PIXEL = "iVBORw0KGgoAAAANSUhEUg==";

function toolMessageWithImage(toolCallId: string): ModelMessage {
	return {
		content: [
			{
				output: {
					type: "content",
					value: [
						{
							text: "Generated (hero, 16:9): https://r2/img.png",
							type: "text",
						},
						{
							data: { data: PIXEL, type: "data" },
							mediaType: "image/png",
							type: "file",
						},
					],
				},
				toolCallId,
				toolName: "generate_image",
				type: "tool-result",
			},
		],
		role: "tool",
	};
}

describe("modelNeedsToolImageRelocation", () => {
	it("targets moonshot models only", () => {
		expect(modelNeedsToolImageRelocation("moonshotai/kimi-k3")).toBe(true);
		expect(modelNeedsToolImageRelocation("alibaba/qwen3.7-plus")).toBe(true);
		expect(modelNeedsToolImageRelocation("thinkingmachines/inkling")).toBe(
			true,
		);
		expect(modelNeedsToolImageRelocation("xai/grok-4.5")).toBe(false);
		expect(modelNeedsToolImageRelocation("anthropic/claude-fable-5")).toBe(
			false,
		);
		expect(modelNeedsToolImageRelocation("deepseek/deepseek-v4-pro")).toBe(
			false,
		);
	});
});

describe("modelNeedsToolImageStripping", () => {
	it("targets the text-only model families only", () => {
		expect(modelNeedsToolImageStripping("deepseek/deepseek-v4-pro")).toBe(true);
		// zai GLM tokenizes base64 image parts as text through the gateway —
		// six build images ≈ 984K input tokens (2026-09-04 prod incident).
		expect(modelNeedsToolImageStripping("zai/glm-5.3-flash")).toBe(true);
		expect(modelNeedsToolImageStripping("moonshotai/kimi-k3")).toBe(false);
		expect(modelNeedsToolImageStripping("xai/grok-4.5")).toBe(false);
	});
});

describe("stripToolResultImages", () => {
	it("drops image parts, keeps the URL text line, adds no carrier", () => {
		const messages: Array<ModelMessage> = [
			{ content: "build the page", role: "user" },
			toolMessageWithImage("call-1"),
			{
				content: [{ text: "placing it now", type: "text" }],
				role: "assistant",
			},
		];

		const result = stripToolResultImages(messages);

		expect(result).toHaveLength(3);
		expect(result.map((message) => message.role)).toEqual([
			"user",
			"tool",
			"assistant",
		]);

		const tool = result[1];
		if (tool?.role !== "tool") throw new Error("expected tool message");
		const part = tool.content[0];
		if (part?.type !== "tool-result" || part.output.type !== "content") {
			throw new Error("expected content tool result");
		}
		expect(part.output.value.every((entry) => entry.type === "text")).toBe(
			true,
		);
		expect(part.output.value[0]).toMatchObject({
			text: "Generated (hero, 16:9): https://r2/img.png",
		});
		expect(part.output.value[1]).toMatchObject({
			text: expect.stringContaining("text-only"),
		});
	});

	it("is idempotent and returns the same reference when nothing changes", () => {
		const messages: Array<ModelMessage> = [
			{ content: "hello", role: "user" },
			toolMessageWithImage("call-1"),
		];

		const once = stripToolResultImages(messages);
		expect(once).not.toBe(messages);

		const twice = stripToolResultImages(once);
		expect(twice).toBe(once);

		const untouched: Array<ModelMessage> = [{ content: "hi", role: "user" }];
		expect(stripToolResultImages(untouched)).toBe(untouched);
	});

	it("leaves non-image and url file parts in place", () => {
		const messages: Array<ModelMessage> = [
			{
				content: [
					{
						output: {
							type: "content",
							value: [
								{
									data: { type: "url", url: new URL("https://r2/video.mp4") },
									mediaType: "video/mp4",
									type: "file",
								},
							],
						},
						toolCallId: "call-1",
						toolName: "connector_media",
						type: "tool-result",
					},
				],
				role: "tool",
			},
		];

		expect(stripToolResultImages(messages)).toBe(messages);
	});
});

describe("relocateToolResultImages", () => {
	it("moves tool-result images into a user message after the tool block", () => {
		const messages: Array<ModelMessage> = [
			{ content: "build the page", role: "user" },
			toolMessageWithImage("call-1"),
			{
				content: [{ text: "placing it now", type: "text" }],
				role: "assistant",
			},
		];

		const result = relocateToolResultImages(messages);

		expect(result).toHaveLength(4);

		const tool = result[1];
		if (tool?.role !== "tool") throw new Error("expected tool message");
		const part = tool.content[0];
		if (part?.type !== "tool-result" || part.output.type !== "content") {
			throw new Error("expected content tool result");
		}
		expect(part.output.value.every((entry) => entry.type === "text")).toBe(
			true,
		);

		const carrier = result[2];
		if (carrier?.role !== "user" || !Array.isArray(carrier.content)) {
			throw new Error("expected user carrier message");
		}
		const image = carrier.content.find((entry) => entry.type === "image");
		expect(image).toMatchObject({
			image: PIXEL,
			mediaType: "image/png",
			type: "image",
		});

		expect(result[3]?.role).toBe("assistant");
	});

	it("emits ONE carrier after a run of consecutive tool messages", () => {
		const messages: Array<ModelMessage> = [
			toolMessageWithImage("call-1"),
			toolMessageWithImage("call-2"),
			{ content: [{ text: "ok", type: "text" }], role: "assistant" },
		];

		const result = relocateToolResultImages(messages);

		expect(result.map((message) => message.role)).toEqual([
			"tool",
			"tool",
			"user",
			"assistant",
		]);

		const carrier = result[2];
		if (carrier?.role !== "user" || !Array.isArray(carrier.content)) {
			throw new Error("expected user carrier message");
		}
		expect(
			carrier.content.filter((entry) => entry.type === "image"),
		).toHaveLength(2);
	});

	it("is idempotent and returns the same reference when nothing changes", () => {
		const messages: Array<ModelMessage> = [
			{ content: "hello", role: "user" },
			toolMessageWithImage("call-1"),
		];

		const once = relocateToolResultImages(messages);
		expect(once).not.toBe(messages);

		const twice = relocateToolResultImages(once);
		expect(twice).toBe(once);

		const untouched: Array<ModelMessage> = [{ content: "hi", role: "user" }];
		expect(relocateToolResultImages(untouched)).toBe(untouched);
	});

	it("leaves non-image and url file parts in place", () => {
		const messages: Array<ModelMessage> = [
			{
				content: [
					{
						output: {
							type: "content",
							value: [
								{
									data: { type: "url", url: new URL("https://r2/video.mp4") },
									mediaType: "video/mp4",
									type: "file",
								},
							],
						},
						toolCallId: "call-1",
						toolName: "connector_media",
						type: "tool-result",
					},
				],
				role: "tool",
			},
		];

		expect(relocateToolResultImages(messages)).toBe(messages);
	});
});
