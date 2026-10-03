/**
 * The Wandit fork of the Claude Code bridge. `ClaudeCodeHarness` wraps the
 * vendor adapter with `withForkedBridge`, so the bootstrap recipe installs
 * the vendor `bridge.mjs` with its `runTurn` swapped for
 * `claude-code-bridge/persistent-run-turn.mjs`. The recipe hash, the
 * bootstrap key, and the template snapshot change with the fork.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HarnessAgentAdapter } from "@ai-sdk/harness/agent";

/** First line of the vendor `runTurn` in `bridge.mjs` of 1.0.137. */
export const VENDOR_RUN_TURN_START = "async function runTurn(start, turn) {";
/** The declaration that follows the vendor `runTurn`; the swap ends there. */
export const VENDOR_RUN_TURN_END = "\nfunction createQueryInput({";

/** The fork file, relative to this source file and to the server package. */
const FORK_FILE = "claude-code-bridge/persistent-run-turn.mjs";
const FORK_PACKAGE_PATH = `src/modules/app-builder/application/harness/${FORK_FILE}`;

/**
 * The vendor bridge with its `runTurn` replaced by `forkRunTurn`. Throws when
 * the anchors are missing: a new vendor version needs a new fork, never a
 * silent vendor bridge.
 */
export function forkBridgeSource(
	vendorSource: string,
	forkRunTurn: string,
): string {
	const start = vendorSource.indexOf(VENDOR_RUN_TURN_START);
	const end = vendorSource.indexOf(VENDOR_RUN_TURN_END, start);
	if (start < 0 || end < 0) {
		throw new Error(
			"The vendor Claude Code bridge changed: the runTurn anchors are missing",
		);
	}
	return `${vendorSource.slice(0, start)}${forkRunTurn}\n${vendorSource.slice(end)}`;
}

/**
 * `adapter` with a bootstrap recipe that installs the forked bridge. Only the
 * `bridge.mjs` file changes; the install commands and the other files stay.
 */
export function withForkedBridge<
	Adapter extends Pick<HarnessAgentAdapter, "getBootstrap">,
>(adapter: Adapter, forkRunTurn: string): Adapter {
	const vendorBootstrap = adapter.getBootstrap;
	if (vendorBootstrap === undefined) {
		return adapter;
	}
	return {
		...adapter,
		getBootstrap: async (options) => {
			const recipe = await vendorBootstrap(options);
			return {
				...recipe,
				files: recipe.files.map((file) =>
					file.path.endsWith("/bridge.mjs")
						? { ...file, content: forkBridgeSource(file.content, forkRunTurn) }
						: file,
				),
			};
		},
	};
}

// The file does not change while the process runs, and `bootstrapKey`
// reads the recipe on every turn, so one read serves the process.
let forkSource: string | null = null;

/**
 * The text of the fork file, read once. The API and the host run this source
 * file directly. The Trigger worker runs a bundle under `.trigger/`, so it
 * reads the copy under its working directory (`trigger.config.ts` ships it).
 */
export function readForkRunTurn(cwd: string = process.cwd()): string {
	if (forkSource !== null) {
		return forkSource;
	}
	const candidates = [
		fileURLToPath(new URL(`./${FORK_FILE}`, import.meta.url)),
		resolve(cwd, FORK_PACKAGE_PATH),
		resolve(cwd, "apps/server", FORK_PACKAGE_PATH),
	];
	const path = candidates.find((candidate) => existsSync(candidate));
	if (path === undefined) {
		throw new Error(
			`The Claude Code bridge fork is missing; looked in ${candidates.join(", ")}`,
		);
	}
	forkSource = readFileSync(path, "utf8");
	return forkSource;
}
