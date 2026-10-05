import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	forkBridgeSource,
	readForkRunTurn,
	VENDOR_RUN_TURN_END,
	VENDOR_RUN_TURN_START,
	withForkedBridge,
} from "./claude-code-bridge-fork";

/** The bridge bundle of the installed `@ai-sdk/harness-claude-code`. */
function vendorBridge(): string {
	const entry = createRequire(import.meta.url).resolve(
		"@ai-sdk/harness-claude-code",
	);
	return readFileSync(join(dirname(entry), "bridge", "index.mjs"), "utf8");
}

/** The vendor helpers the fork calls by their bundle names. */
const BUNDLE_NAMES = [
	"addUsage",
	"claudeSdk",
	"createClaudeCodeSystemPrompt",
	"createClaudeStreamEventState",
	"createCompactionLatch",
	"createEmitStreamEvent",
	"createPermissionOptions",
	"createQuestionPreToolUseHook",
	"defaultUsage",
	"emitFinishStep",
	"finishApprovalStep",
	"jsonSchemaToZodObject",
	"lastClaudeSessionId",
	"mapUsage",
	"mcpModule",
	"procEnv2",
	"randomUUID3",
	"resolveInactiveNativeTools",
	"resolveNativeTools",
	"toClaudeSkillsOption",
	"toCommonName",
	"workdir",
];

describe("forkBridgeSource", () => {
	it("swaps the text between the two anchors and keeps the rest", () => {
		const vendor = `head\n${VENDOR_RUN_TURN_START}\n  old();\n}${VENDOR_RUN_TURN_END}\n  tail`;

		const forked = forkBridgeSource(vendor, "async function runTurn() {}");

		expect(forked).toBe(
			`head\nasync function runTurn() {}\n${VENDOR_RUN_TURN_END}\n  tail`,
		);
	});

	it("throws when the vendor layout changed", () => {
		expect(() => forkBridgeSource("no anchors", "fork")).toThrow(
			"runTurn anchors are missing",
		);
	});

	it("fits the installed vendor bridge: anchors, helper names, and syntax", () => {
		const vendor = vendorBridge();
		const fork = readForkRunTurn();

		for (const name of BUNDLE_NAMES) {
			// A declaration, or an import alias, of each helper the fork calls.
			expect(vendor).toMatch(
				new RegExp(`(?:var|let|const|function) ${name}\\b|as ${name}\\b`),
			);
		}
		const directory = mkdtempSync(join(tmpdir(), "bridge-fork-"));
		try {
			const file = join(directory, "bridge.mjs");
			writeFileSync(file, forkBridgeSource(vendor, fork));
			const check = spawnSync(process.execPath, ["--check", file], {
				encoding: "utf8",
			});
			expect(check.stderr).toBe("");
			expect(check.status).toBe(0);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});

describe("withForkedBridge", () => {
	it("forks only the bridge file of the recipe", async () => {
		const vendorFile = `${VENDOR_RUN_TURN_START} old(); }${VENDOR_RUN_TURN_END}`;
		const adapter = {
			getBootstrap: async () => ({
				bootstrapDir: ".harness-bootstrap/claude-code",
				commands: [{ command: "pnpm install" }],
				files: [
					{
						content: "{}",
						path: ".harness-bootstrap/claude-code/package.json",
					},
					{
						content: vendorFile,
						path: ".harness-bootstrap/claude-code/bridge.mjs",
					},
				],
				harnessId: "claude-code",
			}),
		};

		const recipe = await withForkedBridge(adapter, "FORK").getBootstrap?.();

		expect(recipe?.files[0]?.content).toBe("{}");
		expect(recipe?.files[1]?.content).toBe(`FORK\n${VENDOR_RUN_TURN_END}`);
		expect(recipe?.commands).toEqual([{ command: "pnpm install" }]);
	});
});
