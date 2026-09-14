import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SANDBOX_WORKSPACE_DIR } from "../../domain/ports/sandbox-provider";

const specDir = dirname(fileURLToPath(import.meta.url));
const templateRoot = resolve(
	specDir,
	"..",
	"..",
	"..",
	"..",
	"..",
	"..",
	"..",
	"templates",
	"web-app",
);
const hookPath = join(templateRoot, ".claude", "hooks", "pre-tool-use.mjs");

function runHook(
	input: {
		tool_name: string;
		tool_input: Record<string, string>;
	},
	projectDir?: string,
) {
	return spawnSync("node", [hookPath], {
		input: JSON.stringify(input),
		encoding: "utf8",
		// The hook reads CLAUDE_PROJECT_DIR to find the project's settings.json.
		env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir ?? templateRoot },
	});
}

describe("pre-tool-use hook", () => {
	it("allows a write to src/routes/index.tsx", () => {
		const result = runHook({
			tool_name: "Write",
			tool_input: { file_path: "src/routes/index.tsx" },
		});
		expect(result.status).toBe(0);
	});

	it("denies a write to .claude/settings.json", () => {
		const result = runHook({
			tool_name: "Write",
			tool_input: { file_path: ".claude/settings.json" },
		});
		expect(result.status).toBe(2);
	});

	it("denies writes to paths nested inside .claude", () => {
		for (const filePath of [
			".claude/hooks/pre-tool-use.mjs",
			".claude/skills/atelier/SKILL.md",
		]) {
			const result = runHook({
				tool_name: "Write",
				tool_input: { file_path: filePath },
			});
			expect(result.status).toBe(2);
		}
	});

	it("denies a write to .claude under an absolute path", () => {
		const result = runHook({
			tool_name: "Write",
			tool_input: {
				file_path: `${SANDBOX_WORKSPACE_DIR}/app/.claude/settings.json`,
			},
		});
		expect(result.status).toBe(2);
	});

	it("denies an edit to .mcp.json", () => {
		const result = runHook({
			tool_name: "Edit",
			tool_input: { file_path: ".mcp.json" },
		});
		expect(result.status).toBe(2);
	});

	it("denies git push origin main", () => {
		const result = runHook({
			tool_name: "Bash",
			tool_input: { command: "git push origin main" },
		});
		expect(result.status).toBe(2);
	});

	it("denies a git push hidden behind &&", () => {
		const result = runHook({
			tool_name: "Bash",
			tool_input: { command: "git status && git push origin main" },
		});
		expect(result.status).toBe(2);
	});

	it("denies git commands whose args contain slashes", () => {
		for (const command of [
			"git push origin feat/x",
			"git checkout feat/x",
			"git reset --hard origin/main",
		]) {
			const result = runHook({
				tool_name: "Bash",
				tool_input: { command },
			});
			expect(result.status).toBe(2);
		}
	});

	it("allows git status", () => {
		const result = runHook({
			tool_name: "Bash",
			tool_input: { command: "git status" },
		});
		expect(result.status).toBe(0);
	});

	it("exits 0 on malformed stdin without crashing", () => {
		const result = spawnSync("node", [hookPath], {
			input: "not json",
			encoding: "utf8",
			env: { ...process.env, CLAUDE_PROJECT_DIR: templateRoot },
		});
		expect(result.status).toBe(0);
	});

	it("exits 2 when the settings file is missing (fail closed)", () => {
		const emptyProject = mkdtempSync(join(tmpdir(), "wandit-hook-"));
		try {
			const result = runHook(
				{
					tool_name: "Write",
					tool_input: { file_path: "src/routes/index.tsx" },
				},
				emptyProject,
			);
			expect(result.status).toBe(2);
		} finally {
			rmSync(emptyProject, { recursive: true, force: true });
		}
	});
});
