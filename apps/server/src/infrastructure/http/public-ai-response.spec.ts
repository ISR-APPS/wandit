import { env } from "@wandit/env/server";
import type { UIMessageChunk } from "ai";
import { afterEach, describe, expect, it } from "vitest";

import {
	publicAiMetadata,
	publicAiPart,
	publicAiStream,
} from "./public-ai-response";

const originalNodeEnv = env.NODE_ENV;
afterEach(() => {
	Object.assign(env, { NODE_ENV: originalNodeEnv });
});

describe("public AI response", () => {
	it("filters the complete stream after internal metadata and tool outputs exist", async () => {
		Object.assign(env, { NODE_ENV: "production" });
		const chunks: UIMessageChunk[] = [
			{
				type: "start",
				messageMetadata: {
					model: "private/chat-model",
					provider: "private-provider",
				},
			},
			{
				type: "text-start",
				id: "text-1",
				providerMetadata: { upstream: { model: "private/chat-model" } },
			},
			{ type: "text-delta", id: "text-1", delta: "Explain OpenAI models." },
			{
				type: "tool-input-available",
				toolCallId: "build",
				toolName: "generate_page",
				input: { brief: "A shop" },
			},
			{
				type: "tool-output-available",
				toolCallId: "build",
				output: {
					status: "queued",
					builderModel: "private/builder-model",
					message: "Queued",
				},
			},
			{
				type: "tool-input-available",
				toolCallId: "read",
				toolName: "read_file",
				input: { path: "product.json" },
			},
			{
				type: "tool-output-available",
				toolCallId: "read",
				output: { builderModel: "UserProduct" },
			},
		];
		const stream = publicAiStream(
			new ReadableStream<UIMessageChunk>({
				start(controller) {
					for (const chunk of chunks) controller.enqueue(chunk);
					controller.close();
				},
			}),
		);
		const received: UIMessageChunk[] = [];
		for await (const chunk of stream) received.push(chunk);
		expect(JSON.stringify(received)).not.toContain("private");
		expect(received).toContainEqual({
			type: "text-delta",
			id: "text-1",
			delta: "Explain OpenAI models.",
		});
		expect(received).toContainEqual({
			type: "tool-output-available",
			toolCallId: "read",
			output: { builderModel: "UserProduct" },
		});
		expect(JSON.stringify(chunks)).toContain("private/chat-model");
	});

	it.each([
		"nested",
		"direct",
	] as const)("removes %s saved model selections and preserves other settings", (storage) => {
		Object.assign(env, { NODE_ENV: "production" });
		const composer = {
			mode: "page",
			options: {
				builderModel: "private/model",
				builderReasoning: "high",
				locale: "fr",
			},
		};
		const publicComposer = { mode: "page", options: { locale: "fr" } };
		expect(
			publicAiMetadata(storage === "nested" ? { composer } : composer),
		).toEqual(
			storage === "nested" ? { composer: publicComposer } : publicComposer,
		);
	});

	it("keeps error recovery and billing facts without upstream identity", () => {
		Object.assign(env, { NODE_ENV: "production" });
		expect(
			publicAiPart({
				type: "data-ai-error",
				data: {
					kind: "capacity",
					source: "provider:private",
					providerLabel: "Private AI",
					providerMessage: "private/model overloaded",
					requestId: "private/request",
					retryable: true,
					terminal: true,
					refunded: true,
					moderationStage: null,
				},
			}),
		).toMatchObject({
			data: {
				kind: "capacity",
				source: "unknown",
				providerLabel: null,
				providerMessage: null,
				requestId: null,
				retryable: true,
				terminal: true,
				refunded: true,
			},
		});
	});

	it("preserves local development diagnostics", () => {
		Object.assign(env, { NODE_ENV: "development" });
		const metadata = { model: "local/model", provider: "local-provider" };
		const part = {
			type: "text",
			text: "Hello",
			providerMetadata: { local: { model: "local/model" } },
		};
		expect(publicAiMetadata(metadata)).toEqual(metadata);
		expect(publicAiPart(part)).toEqual(part);
	});

	it.each([
		"failed",
		"unavailable",
	] as const)("hides %s image diagnostics in stored and live tool output", (status) => {
		Object.assign(env, { NODE_ENV: "production" });
		const output = { status, message: "private/image-model failed" };
		const toolNames = new Map<string, string>();
		publicAiPart(
			{
				type: "tool-input-available",
				toolCallId: "image-1",
				toolName: "generate_image",
			},
			toolNames,
		);
		expect(
			publicAiPart(
				{ type: "tool-output-available", toolCallId: "image-1", output },
				toolNames,
			).output,
		).toEqual({
			status,
			message: "Image generation failed. Please try again.",
		});
		for (const part of [
			{ type: "tool-generate_image", output },
			{
				type: "dynamic-tool",
				toolName: "generate_image",
				toolCallId: "image-1",
				output,
			},
		]) {
			expect(publicAiPart(part).output).toEqual({
				status,
				message: "Image generation failed. Please try again.",
			});
		}
		const generated = {
			status: "generated",
			url: "https://example.test/image.png",
			path: "public/image.png",
			width: 512,
			height: 512,
		};
		expect(
			publicAiPart(
				{
					type: "tool-output-available",
					toolCallId: "image-1",
					output: generated,
				},
				toolNames,
			).output,
		).toEqual(generated);
	});
});
