import { describe, expect, it } from "vitest";

import { HarnessNotBuiltError } from "../../domain/errors/harness-not-built.error";
import { createBuilderHarness } from "./builder-harness.factory";
import { ClaudeCodeHarness } from "./claude-code.harness";

describe("createBuilderHarness", () => {
	it("returns ClaudeCodeHarness for claude-code", () => {
		expect(createBuilderHarness("claude-code")).toBeInstanceOf(
			ClaudeCodeHarness,
		);
	});

	it("throws HarnessNotBuiltError for opencode", () => {
		expect(() => createBuilderHarness("opencode")).toThrow(
			HarnessNotBuiltError,
		);
	});
});
