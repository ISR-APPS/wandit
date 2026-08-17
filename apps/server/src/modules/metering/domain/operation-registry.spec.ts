import { access, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { aiUsageOperation } from "@wandit/db/schema/credits";
import { describe, expect, it } from "vitest";

import {
	AI_INVOCATION_COVERAGE,
	canNestOperation,
	fixedOperationCredits,
	IMAGE_CREDITS_PER_IMAGE,
	OPERATION_REGISTRY,
	TRANSCRIPTION_MAX_DURATION_SECONDS,
	transcriptionCredits,
	VIDEO_CREDITS_PER_OPERATION,
} from "./operation-registry";

const REQUIRED_WORKFLOW_IDS = [
	"ai-stream-chat",
	"site-builder-steps",
	"site-builder-image-child",
	"site-builder-video-child",
	"standalone-image",
	"standalone-animation",
	"standalone-text-to-video",
	"marketing",
	"connector-inline",
	"connector-background",
	"lead-scrape",
	"transcription",
	"legacy-worker-chat",
	"project-title-bundled",
	"higgsfield-prompt-refine-bundled",
	"video-director-bundled",
] as const;

const PROVIDER_CALL_PATTERNS = [
	{ name: "ToolLoopAgent", pattern: /new\s+ToolLoopAgent\s*\(/gu },
	{ name: "callTool", pattern: /\bclient\.callTool\s*\(/gu },
	{ name: "doGenerate", pattern: /\.doGenerate\s*\(/gu },
	{ name: "generateImage", pattern: /\bgenerateImage\s*\(/gu },
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
		name: "doGenerate",
		source:
			"apps/server/src/modules/generation/application/services/transcription.service.ts",
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

	it("locks fixed action economics and per-image pricing in centi-credits", () => {
		expect(IMAGE_CREDITS_PER_IMAGE).toBe(300);
		expect(VIDEO_CREDITS_PER_OPERATION).toBe(2000);
		expect(fixedOperationCredits("image", 3)).toBe(3 * IMAGE_CREDITS_PER_IMAGE);
		expect(fixedOperationCredits("video")).toBe(VIDEO_CREDITS_PER_OPERATION);
		expect(fixedOperationCredits("marketing")).toBe(700);
		expect(fixedOperationCredits("connector")).toBe(500);
		expect(fixedOperationCredits("lead_scrape")).toBe(500);
	});

	it("keeps the centi-credit reserve floors of the v4 price card", () => {
		expect(OPERATION_REGISTRY.chat.reserveFloorCredits).toBe(10);
		expect(OPERATION_REGISTRY.page_build.reserveFloorCredits).toBe(1000);
		expect(OPERATION_REGISTRY.transcription.reserveFloorCredits).toBe(100);
		expect(OPERATION_REGISTRY.topup_adjust.reserveFloorCredits).toBe(0);
	});

	it("ceil-bills transcription by minute with a one-credit minimum and cap", () => {
		expect(transcriptionCredits(0)).toBe(100);
		expect(transcriptionCredits(1)).toBe(100);
		expect(transcriptionCredits(60)).toBe(100);
		expect(transcriptionCredits(61)).toBe(200);
		expect(transcriptionCredits(TRANSCRIPTION_MAX_DURATION_SECONDS)).toBe(500);
		expect(() =>
			transcriptionCredits(TRANSCRIPTION_MAX_DURATION_SECONDS + 1),
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
					: site.billing.bundledInto;
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
