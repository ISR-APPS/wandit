import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createClaudeCode } from "@ai-sdk/harness-claude-code";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";
import { describe, expect, it } from "vitest";

// Guard for WANDIT-148: the V2 builder runs on these three packages.
// Each pins `ai` 7.0.99, so a missing or renamed export means the installed
// versions drifted from the pinned set. Import checks run without a network
// or a sandbox.
describe("harness packages", () => {
	it("exposes HarnessAgent as a class", () => {
		expect(typeof HarnessAgent).toBe("function");
	});

	it("exposes the Claude Code adapter factory", () => {
		expect(typeof createClaudeCode).toBe("function");
	});

	it("exposes the Vercel sandbox provider factory", () => {
		expect(typeof createVercelSandbox).toBe("function");
	});
});
