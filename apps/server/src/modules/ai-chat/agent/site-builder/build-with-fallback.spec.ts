import { describe, expect, it } from "vitest";

import type { NormalizedAiError } from "../../../ai-errors/domain";
import type { BuildProgressEvent } from "./build-progress";
import {
	type FallbackBuildRun,
	runSiteBuildWithFallback,
} from "./build-with-fallback";
import type { SiteBuildResult } from "./site-builder-agent";

const PRIMARY_MODEL = "google/gemini-3.8-flash";
const FIRST_FALLBACK_MODEL = "google/gemini-3.7-flash";
const SECOND_FALLBACK_MODEL = "google/gemini-3.5-flash";
const LAST_FALLBACK_MODEL = "openai/gpt-5.6-luna";
const BRIEF = "Build a product page.";
const SUCCESSFUL_BUILD = {
	files: [{ content: "<!doctype html>", path: "index.html" }],
	steps: 2,
	summary: "Finished",
	usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
} satisfies SiteBuildResult;
const NORMALIZED_FAILURE = {
	gatewayGenerationId: null,
	kind: "timeout",
	model: PRIMARY_MODEL,
	moderationStage: null,
	openrouterGenerationId: null,
	provider: "google",
	providerLabel: "Google",
	providerMessage: null,
	raw: {
		cause: null,
		message: "provider timeout",
		name: "Error",
		providerAttempts: null,
		responseBody: null,
	},
	refunded: null,
	requestId: null,
	retryable: true,
	sentryEventId: null,
	source: "gateway",
	statusCode: null,
	terminal: true,
	userMessage: { key: "errors.ai.timeout", params: { provider: "Google" } },
} satisfies NormalizedAiError;

type RunParams = Parameters<typeof runSiteBuildWithFallback>[0];

function createHarness(options: {
	abortSignal?: AbortSignal;
	classifyFailure?: RunParams["classifyFailure"];
	model?: string;
	pageKind?: RunParams["pageKind"];
	runBuild: RunParams["runBuild"];
}) {
	const events: BuildProgressEvent[] = [];
	const fallbacks: Array<Parameters<RunParams["onFallback"]>[0]> = [];
	let namespaceIndex = 0;
	const classifyFailure: RunParams["classifyFailure"] =
		options.classifyFailure ??
		(() => ({
			failureCode: "provider_timeout",
			normalized: NORMALIZED_FAILURE,
		}));
	const params: RunParams = {
		abortSignal: options.abortSignal ?? new AbortController().signal,
		brief: BRIEF,
		classifyFailure,
		model: options.model ?? PRIMARY_MODEL,
		nextAssetNamespace: () => {
			namespaceIndex += 1;

			return `asset-${namespaceIndex}`;
		},
		onEvent: (event) => events.push(event),
		onFallback: (info) => fallbacks.push(info),
		pageKind: options.pageKind ?? "website",
		runBuild: options.runBuild,
	};

	return { events, fallbacks, params };
}

describe("runSiteBuildWithFallback", () => {
	it("returns a successful first run", async () => {
		const tried: FallbackBuildRun[] = [];
		const { params } = createHarness({
			runBuild: async (run) => {
				tried.push(run);

				return SUCCESSFUL_BUILD;
			},
		});

		await expect(runSiteBuildWithFallback(params)).resolves.toEqual({
			build: SUCCESSFUL_BUILD,
			model: PRIMARY_MODEL,
			runs: [{ failureCode: null, model: PRIMARY_MODEL }],
		});
		expect(tried).toEqual([
			{ assetNamespace: "asset-1", brief: BRIEF, model: PRIMARY_MODEL },
		]);
	});

	it("reuses a stalled run image in a fresh fallback run", async () => {
		const failure = new Error("builder stalled");
		const tried: FallbackBuildRun[] = [];
		const imageEvent = {
			aspect: "16:9",
			height: 1024,
			role: "hero",
			type: "image-generated",
			url: "https://assets.example.com/hero.png",
			width: 1536,
		} satisfies BuildProgressEvent;
		const { events, fallbacks, params } = createHarness({
			runBuild: async (run, onEvent) => {
				tried.push(run);

				if (run.model === PRIMARY_MODEL) {
					onEvent(imageEvent);
					throw failure;
				}

				return SUCCESSFUL_BUILD;
			},
		});

		const result = await runSiteBuildWithFallback(params);

		expect(result).toEqual({
			build: SUCCESSFUL_BUILD,
			model: FIRST_FALLBACK_MODEL,
			runs: [
				{ failureCode: "provider_timeout", model: PRIMARY_MODEL },
				{ failureCode: null, model: FIRST_FALLBACK_MODEL },
			],
		});
		expect(tried.map((run) => run.assetNamespace)).toEqual([
			"asset-1",
			"asset-2",
		]);
		expect(tried[1]?.brief).toContain(
			"- image for hero (16:9, 1536x1024): https://assets.example.com/hero.png",
		);
		expect(events).toEqual([
			imageEvent,
			{
				fromModel: PRIMARY_MODEL,
				toModel: FIRST_FALLBACK_MODEL,
				type: "model-fallback",
			},
		]);
		expect(fallbacks).toEqual([
			{
				error: failure,
				failureCode: "provider_timeout",
				fromModel: PRIMARY_MODEL,
				normalized: NORMALIZED_FAILURE,
				toModel: FIRST_FALLBACK_MODEL,
			},
		]);
	});

	it("keeps only the newest image for each role", async () => {
		const tried: FallbackBuildRun[] = [];
		const { params } = createHarness({
			runBuild: async (run, onEvent) => {
				tried.push(run);

				if (run.model === PRIMARY_MODEL) {
					onEvent({
						aspect: "16:9",
						height: 1024,
						role: "hero",
						type: "image-generated",
						url: "https://assets.example.com/old-hero.png",
						width: 1536,
					});
					throw new Error("first model failed");
				}

				if (run.model === FIRST_FALLBACK_MODEL) {
					onEvent({
						aspect: "16:9",
						height: 1024,
						role: "hero",
						type: "image-generated",
						url: "https://assets.example.com/new-hero.png",
						width: 1536,
					});
					throw new Error("second model failed");
				}

				return SUCCESSFUL_BUILD;
			},
		});

		await runSiteBuildWithFallback(params);

		const finalBrief = tried[2]?.brief ?? "";
		expect(finalBrief.match(/^- image for hero /gmu)).toHaveLength(1);
		expect(finalBrief).toContain("https://assets.example.com/new-hero.png");
		expect(finalBrief).not.toContain("https://assets.example.com/old-hero.png");
	});

	it("does not retry a provider 400", async () => {
		const failure = new Error("bad request");
		const tried: FallbackBuildRun[] = [];
		const providerFailure = {
			...NORMALIZED_FAILURE,
			kind: "provider_error",
			statusCode: 400,
			userMessage: {
				key: "errors.ai.provider_error",
				params: { provider: "Google" },
			},
		} satisfies NormalizedAiError;
		const { events, fallbacks, params } = createHarness({
			classifyFailure: () => ({
				failureCode: "provider_error",
				normalized: providerFailure,
			}),
			runBuild: async (run) => {
				tried.push(run);
				throw failure;
			},
		});

		await expect(runSiteBuildWithFallback(params)).rejects.toBe(failure);
		expect(tried.map((run) => run.model)).toEqual([PRIMARY_MODEL]);
		expect(events).toEqual([]);
		expect(fallbacks).toEqual([]);
	});

	it("does not retry after the caller aborts", async () => {
		const abortController = new AbortController();
		const failure = new Error("aborted");
		const tried: FallbackBuildRun[] = [];
		let classified = false;
		const { fallbacks, params } = createHarness({
			abortSignal: abortController.signal,
			classifyFailure: () => {
				classified = true;

				return {
					failureCode: "provider_timeout",
					normalized: NORMALIZED_FAILURE,
				};
			},
			runBuild: async (run) => {
				tried.push(run);
				abortController.abort();
				throw failure;
			},
		});

		await expect(runSiteBuildWithFallback(params)).rejects.toBe(failure);
		expect(tried.map((run) => run.model)).toEqual([PRIMARY_MODEL]);
		expect(classified).toBe(false);
		expect(fallbacks).toEqual([]);
	});

	it("rethrows the last error after the fallback chain is exhausted", async () => {
		const firstFailure = new Error("first failed");
		const secondFailure = new Error("second failed");
		const thirdFailure = new Error("third failed");
		const lastFailure = new Error("last failed");
		const tried: FallbackBuildRun[] = [];
		const { events, fallbacks, params } = createHarness({
			runBuild: async (run, onEvent) => {
				tried.push(run);
				const imageNumber = tried.length;
				onEvent({
					aspect: "1:1",
					height: 800,
					role: `product ${imageNumber}`,
					type: "image-generated",
					url: `https://assets.example.com/product-${imageNumber}.png`,
					width: 800,
				});

				if (run.model === PRIMARY_MODEL) {
					throw firstFailure;
				}

				if (run.model === FIRST_FALLBACK_MODEL) {
					throw secondFailure;
				}

				if (run.model === SECOND_FALLBACK_MODEL) {
					throw thirdFailure;
				}

				throw lastFailure;
			},
		});

		await expect(runSiteBuildWithFallback(params)).rejects.toBe(lastFailure);
		expect(tried.map((run) => run.model)).toEqual([
			PRIMARY_MODEL,
			FIRST_FALLBACK_MODEL,
			SECOND_FALLBACK_MODEL,
			LAST_FALLBACK_MODEL,
		]);
		expect(tried.map((run) => run.assetNamespace)).toEqual([
			"asset-1",
			"asset-2",
			"asset-3",
			"asset-4",
		]);
		expect(tried[3]?.brief).toContain(
			"- image for product 1 (1:1, 800x800): https://assets.example.com/product-1.png",
		);
		expect(tried[3]?.brief).toContain(
			"- image for product 2 (1:1, 800x800): https://assets.example.com/product-2.png",
		);
		expect(tried[3]?.brief).toContain(
			"- image for product 3 (1:1, 800x800): https://assets.example.com/product-3.png",
		);
		expect(events.filter((event) => event.type === "model-fallback")).toEqual([
			{
				fromModel: PRIMARY_MODEL,
				toModel: FIRST_FALLBACK_MODEL,
				type: "model-fallback",
			},
			{
				fromModel: FIRST_FALLBACK_MODEL,
				toModel: SECOND_FALLBACK_MODEL,
				type: "model-fallback",
			},
			{
				fromModel: SECOND_FALLBACK_MODEL,
				toModel: LAST_FALLBACK_MODEL,
				type: "model-fallback",
			},
		]);
		expect(fallbacks).toEqual([
			{
				error: firstFailure,
				failureCode: "provider_timeout",
				fromModel: PRIMARY_MODEL,
				normalized: NORMALIZED_FAILURE,
				toModel: FIRST_FALLBACK_MODEL,
			},
			{
				error: secondFailure,
				failureCode: "provider_timeout",
				fromModel: FIRST_FALLBACK_MODEL,
				normalized: NORMALIZED_FAILURE,
				toModel: SECOND_FALLBACK_MODEL,
			},
			{
				error: thirdFailure,
				failureCode: "provider_timeout",
				fromModel: SECOND_FALLBACK_MODEL,
				normalized: NORMALIZED_FAILURE,
				toModel: LAST_FALLBACK_MODEL,
			},
		]);
	});

	it("falls back from an outside model to the first website model", async () => {
		const failure = new Error("provider timed out");
		const tried: FallbackBuildRun[] = [];
		const { events, fallbacks, params } = createHarness({
			model: "anthropic/claude-test",
			runBuild: async (run) => {
				tried.push(run);
				if (run.model === "anthropic/claude-test") {
					throw failure;
				}

				return SUCCESSFUL_BUILD;
			},
		});

		const result = await runSiteBuildWithFallback(params);

		expect(result.model).toBe(PRIMARY_MODEL);
		expect(tried.map((run) => run.model)).toEqual([
			"anthropic/claude-test",
			PRIMARY_MODEL,
		]);
		expect(events).toEqual([
			{
				fromModel: "anthropic/claude-test",
				toModel: PRIMARY_MODEL,
				type: "model-fallback",
			},
		]);
		expect(fallbacks).toEqual([
			{
				error: failure,
				failureCode: "provider_timeout",
				fromModel: "anthropic/claude-test",
				normalized: NORMALIZED_FAILURE,
				toModel: PRIMARY_MODEL,
			},
		]);
	});

	it("falls back from Luna to Gemini 3.8 for COD", async () => {
		const tried: FallbackBuildRun[] = [];
		const { params } = createHarness({
			model: "openai/gpt-5.6-luna",
			pageKind: "cod",
			runBuild: async (run) => {
				tried.push(run);
				if (run.model === "openai/gpt-5.6-luna") {
					throw new Error("provider timed out");
				}

				return SUCCESSFUL_BUILD;
			},
		});

		const result = await runSiteBuildWithFallback(params);

		expect(result.model).toBe(PRIMARY_MODEL);
		expect(tried.map((run) => run.model)).toEqual([
			"openai/gpt-5.6-luna",
			PRIMARY_MODEL,
		]);
	});
});
