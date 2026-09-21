/**
 * Picks the `BuilderHarness` implementation for `env.V2_HARNESS` (D17).
 * The `builder-turn` task calls it; a wrong value is a deploy error, so
 * an unknown kind throws `HarnessNotBuiltError` instead of defaulting.
 */
import type { V2Harness } from "@wandit/env/v2-harness";

import { HarnessNotBuiltError } from "../../domain/errors/harness-not-built.error";
import type { BuilderHarness } from "../../domain/ports/builder-harness";
import { ClaudeCodeHarness } from "./claude-code.harness";

/** Returns the harness for the env id; `opencode` throws (D17 follow-up). */
export function createBuilderHarness(kind: V2Harness): BuilderHarness {
	switch (kind) {
		case "claude-code":
			return new ClaudeCodeHarness();
		default:
			// D17: OpenCode is a follow-up; an unknown kind is a config bug.
			throw new HarnessNotBuiltError(kind);
	}
}
