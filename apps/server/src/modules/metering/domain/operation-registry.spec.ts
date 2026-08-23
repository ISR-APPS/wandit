import { access, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { aiUsageOperation } from "@wandit/db/schema/credits";
import { describe, expect, it } from "vitest";

import {
	AI_INVOCATION_COVERAGE,
	assertTranscriptionDurationAllowed,
	CONNECTOR_RESERVE_FLOOR_CREDITS,
	canNestOperation,
	IMAGE_RESERVE_FLOOR_CREDITS,
	LEAD_SCRAPE_CREDITS_PER_LEAD,
	LEAD_SCRAPE_MINIMUM_CREDITS,
	leadScrapeCredits,
	OPERATION_REGISTRY,
	TRANSCRIPTION_MAX_DURATION_SECONDS,
	TRANSCRIPTION_RESERVE_FLOOR_CREDITS,
	VIDEO_RESERVE_FLOOR_CREDITS,
} from "./operation-registry";

const REQUIRED_WORKFLOW_IDS = [
	"ai-stream-chat",
	"site-builder-steps",
	"site-builder-image-child",
	"site-builder-video-child",
	"standalone-image",
	"standalone-animation",
	"standalone-text-to-video",
	"standalone-video-edit",
	"standalone-product-video",
	"standalone-video-extension",
	"marketing",
	"connector-inline",
	"connector-background",
	"lead-scrape",
	"transcription",
	"video-voiceover-helper",
	"legacy-worker-chat",
	"project-title-helper",
	"higgsfield-prompt-refine-helper",
	"video-inspect-helper",
	"video-director-helper",
	"chat-tool-call-repair-helper",
] as const;

const PROVIDER_CALL_PATTERNS = [
	{ name: "ToolLoopAgent", pattern: /new\s+ToolLoopAgent\s*\(/gu },
	{ name: "callTool", pattern: /\bclient\.callTool\s*\(/gu },
	{ name: "doGenerate", pattern: /\.doGenerate\s*\(/gu },
	{ name: "embed", pattern: /\bembed\s*\(/gu },
	{ name: "embedMany", pattern: /\bembedMany\s*\(/gu },
	{ name: "generateImage", pattern: /\bgenerateImage\s*\(/gu },
	{ name: "generateObject", pattern: /\bgenerateObject\s*\(/gu },
	{
		name: "generateSpeech",
		pattern: /\bexperimental_generateSpeech\s*\(/gu,
	},
	{ name: "generateText", pattern: /\bgenerateText\s*\(/gu },
	{ name: "generateVideo", pattern: /\bgenerateVideo\s*\(/gu },
	{ name: "streamText", pattern: /\bstreamText\s*\(/gu },
] as const;

const EXPECTED_PROVIDER_CALLS = [
	{
		count: 1,
		name: "callTool",
		source:
			"apps/server/src/modules/mcp-connectors/application/services/mcp-chat-tools.service.ts",
	},
	{
		count: 2,
		name: "callTool",
		source: "apps/server/src/trigger/run-connector-generation.task.ts",
	},
	{
		count: 1,
		name: "ToolLoopAgent",
		source: "apps/server/src/modules/ai-chat/agent/chat-agent.ts",
	},
	{
		// Tool-call repair: billed inside the chat event (helper_billable).
		count: 1,
		name: "generateObject",
		source: "apps/server/src/modules/ai-chat/agent/chat-agent.ts",
	},
	{
		count: 1,
		name: "ToolLoopAgent",
		source:
			"apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts",
	},
	{
		// One call per pipeline: generateBuildVideo (image) + generateTextToVideo.
		count: 2,
		name: "generateVideo",
		source:
			"apps/server/src/modules/ai-chat/agent/site-builder/generate-video.ts",
	},
	{
		count: 1,
		name: "generateVideo",
		source: "apps/server/src/modules/ai-chat/agent/site-builder/edit-video.ts",
	},
	{
		count: 1,
		name: "generateVideo",
		source:
			"apps/server/src/modules/ai-chat/agent/site-builder/product-video.ts",
	},
	{
		count: 1,
		name: "doGenerate",
		source:
			"apps/server/src/modules/generation/application/services/transcription.service.ts",
	},
	{
		count: 1,
		name: "generateSpeech",
		source:
			"apps/server/src/modules/generation/application/services/speech.service.ts",
	},
	{
		count: 1,
		name: "generateImage",
		source:
			"apps/server/src/modules/image-generations/application/services/image-generator.ts",
	},
	{
		count: 2,
		name: "generateText",
		source:
			"apps/server/src/modules/image-generations/application/services/image-generator.ts",
	},
	{
		count: 1,
		name: "generateText",
		source:
			"apps/server/src/modules/marketing-assets/application/services/marketing-html.ts",
	},
	{
		count: 1,
		name: "generateText",
		source:
			"apps/server/src/modules/mcp-connectors/application/services/higgsfield-prompt-refiner.service.ts",
	},
	{
		count: 1,
		name: "generateText",
		source: "apps/server/src/modules/ai-chat/agent/tools/inspect-video.tool.ts",
	},
	{
		count: 1,
		name: "generateText",
		source:
			"apps/server/src/modules/media-generations/application/services/video-director.ts",
	},
	{
		count: 1,
		name: "generateText",
		source:
			"apps/server/src/modules/projects/application/services/project-title.service.ts",
	},
	{
		count: 1,
		name: "streamText",
		source: "apps/worker/src/processors/ai-generation.processor.ts",
	},
] as const;

describe("operation registry", () => {
	it("defines pricing for every database operation enum value", () => {
		expect(Object.keys(OPERATION_REGISTRY).sort()).toEqual(
			[...aiUsageOperation.enumValues].sort(),
		);
	});

	it("prices media and transcription as measured provider cost", () => {
		expect(OPERATION_REGISTRY.image).toMatchObject({
			mode: "measured",
			reserveFloorCredits: IMAGE_RESERVE_FLOOR_CREDITS,
			unit: "image",
		});
		expect(OPERATION_REGISTRY.video).toMatchObject({
			mode: "measured",
			reserveFloorCredits: VIDEO_RESERVE_FLOOR_CREDITS,
			unit: "video",
		});
		expect(OPERATION_REGISTRY.transcription).toMatchObject({
			maxDurationSeconds: TRANSCRIPTION_MAX_DURATION_SECONDS,
			mode: "measured",
			reserveFloorCredits: TRANSCRIPTION_RESERVE_FLOOR_CREDITS,
		});
		// The MCP render runs on the user's own subscription: 1 cc floor, no fee.
		expect(OPERATION_REGISTRY.connector).toMatchObject({
			mode: "measured",
			reserveFloorCredits: CONNECTOR_RESERVE_FLOOR_CREDITS,
		});
		expect(CONNECTOR_RESERVE_FLOOR_CREDITS).toBe(1);
		expect(OPERATION_REGISTRY.marketing).toMatchObject({
			mode: "token",
			reserveFloorCredits: 150,
		});
		expect(IMAGE_RESERVE_FLOOR_CREDITS).toBe(350);
		expect(VIDEO_RESERVE_FLOOR_CREDITS).toBe(550);
		expect(TRANSCRIPTION_RESERVE_FLOOR_CREDITS).toBe(25);
	});

	it("prices lead scrapes per delivered lead with a one-credit minimum", () => {
		expect(OPERATION_REGISTRY.lead_scrape).toMatchObject({
			creditsPerUnit: LEAD_SCRAPE_CREDITS_PER_LEAD,
			minimumCredits: LEAD_SCRAPE_MINIMUM_CREDITS,
			mode: "fixed",
			reserveFloorCredits: LEAD_SCRAPE_MINIMUM_CREDITS,
			unit: "lead",
		});
		expect(LEAD_SCRAPE_CREDITS_PER_LEAD).toBe(5);
		expect(LEAD_SCRAPE_MINIMUM_CREDITS).toBe(100);
		expect(leadScrapeCredits(0)).toBe(100);
		expect(leadScrapeCredits(20)).toBe(100);
		expect(leadScrapeCredits(21)).toBe(105);
		expect(leadScrapeCredits(200)).toBe(1000);
		expect(() => leadScrapeCredits(-1)).toThrow("non-negative integer");
	});

	it("keeps the centi-credit reserve floors of the token operations", () => {
		expect(OPERATION_REGISTRY.chat.reserveFloorCredits).toBe(10);
		expect(OPERATION_REGISTRY.page_build.reserveFloorCredits).toBe(1000);
		expect(OPERATION_REGISTRY.topup_adjust.reserveFloorCredits).toBe(0);
	});

	it("caps transcription duration at five minutes", () => {
		expect(() => assertTranscriptionDurationAllowed(0)).not.toThrow();
		expect(() =>
			assertTranscriptionDurationAllowed(TRANSCRIPTION_MAX_DURATION_SECONDS),
		).not.toThrow();
		expect(() =>
			assertTranscriptionDurationAllowed(
				TRANSCRIPTION_MAX_DURATION_SECONDS + 1,
			),
		).toThrow("exceeds 300 seconds");
	});

	it("allows builder and connector media children symmetrically", () => {
		expect(canNestOperation("page_build", "image")).toBe(true);
		expect(canNestOperation("page_build", "video")).toBe(true);
		expect(canNestOperation("connector", "image")).toBe(true);
		expect(canNestOperation("connector", "video")).toBe(true);
		expect(canNestOperation("image", "page_build")).toBe(false);
	});

	it("keeps every §5.6 workflow marker mapped to registered pricing", async () => {
		const workspaceRoot = await findWorkspaceRoot(process.cwd());
		const ids = AI_INVOCATION_COVERAGE.map(({ id }) => id);

		expect(ids).toEqual(REQUIRED_WORKFLOW_IDS);

		for (const site of AI_INVOCATION_COVERAGE) {
			const source = await readFile(
				resolve(workspaceRoot, site.source),
				"utf8",
			);
			expect(source, `${site.id} marker moved`).toContain(site.marker);

			const operation =
				site.billing.kind === "metered"
					? site.billing.operation
					: site.billing.billedInto;
			expect(OPERATION_REGISTRY[operation]).toBeDefined();
		}
	});

	it("fails closed when a direct AI SDK invocation is added without coverage", async () => {
		const workspaceRoot = await findWorkspaceRoot(process.cwd());
		const sourceRoots = [
			resolve(workspaceRoot, "apps/server/src"),
			resolve(workspaceRoot, "apps/worker/src"),
		];
		const discovered: Array<{ count: number; name: string; source: string }> =
			[];

		for (const sourceRoot of sourceRoots) {
			for (const file of await typescriptFiles(sourceRoot)) {
				if (
					file.endsWith(".spec.ts") ||
					file.endsWith("/metering/domain/operation-registry.ts")
				) {
					continue;
				}

				const source = await readFile(file, "utf8");

				for (const primitive of PROVIDER_CALL_PATTERNS) {
					const count = [...source.matchAll(primitive.pattern)].length;

					if (count > 0) {
						discovered.push({
							count,
							name: primitive.name,
							source: relative(workspaceRoot, file),
						});
					}
				}
			}
		}

		expect(sortCalls(discovered)).toEqual(sortCalls(EXPECTED_PROVIDER_CALLS));
	});

	it("attributes the live attachment diagnostic without treating it as production coverage", async () => {
		const workspaceRoot = await findWorkspaceRoot(process.cwd());
		const source = await readFile(
			resolve(workspaceRoot, "apps/server/scripts/test-attachment-marker.ts"),
			"utf8",
		);

		expect(source).toContain("providerOptions: withGatewayAttribution(");
		expect(source).toContain('operation: "chat"');
		expect(source).toContain('userId: "diagnostic:test-attachment-marker"');
	});
});

async function findWorkspaceRoot(start: string): Promise<string> {
	let candidate = resolve(start);

	while (true) {
		try {
			await Promise.all([
				access(join(candidate, "pnpm-workspace.yaml")),
				access(join(candidate, "apps")),
				access(join(candidate, "packages")),
			]);
			return candidate;
		} catch {
			// Keep walking until the monorepo sentinels are found. CI checkout and
			// worktree directory names are intentionally irrelevant.
		}

		const parent = resolve(candidate, "..");

		if (parent === candidate) {
			throw new Error("Could not locate the Wandit workspace root");
		}

		candidate = parent;
	}
}

async function typescriptFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				return typescriptFiles(path);
			}

			return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
		}),
	);

	return nested.flat();
}

function sortCalls<T extends { name: string; source: string }>(
	calls: readonly T[],
): T[] {
	return [...calls].sort((left, right) =>
		`${left.source}:${left.name}`.localeCompare(
			`${right.source}:${right.name}`,
		),
	);
}
