// Proves that a starter still builds on the current base template.
// Run: node templates/starters/scripts/check.mjs <id>... | --all
// An author runs it before a commit, and with --all after a change of templates/web-app.
// For each id it runs materialize.mjs into a temp folder, then the typecheck, the lint,
// and the build of that project. It prints one PASS or FAIL line for each starter.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	assertStarterId,
	listStarterIds,
	readStarterJson,
	runPnpm,
	runScript,
} from "./starter-source.mjs";

const materializeScript = join(
	dirname(fileURLToPath(import.meta.url)),
	"materialize.mjs",
);

/** Null when the starter passes. Else the command that failed and its output. */
function checkStarter(id, workDir) {
	const steps = [
		{
			name: "materialize",
			run: () =>
				spawnSync(process.execPath, [materializeScript, id, workDir], {
					encoding: "utf8",
				}),
		},
		...["typecheck", "lint", "build"].map((script) => ({
			name: `pnpm run ${script}`,
			run: () => runPnpm(["run", script], workDir, "pipe"),
		})),
	];
	for (const step of steps) {
		const result = step.run();
		if (result.status !== 0) {
			const output = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error?.message ?? ""}`;
			return { command: step.name, output };
		}
	}
	return null;
}

await runScript(() => {
	const args = process.argv.slice(2);
	const ids = args.includes("--all") ? listStarterIds() : args;
	if (args.length === 0 || (args.includes("--all") && args.length > 1)) {
		throw new Error(
			"usage: node templates/starters/scripts/check.mjs <id>... | --all",
		);
	}
	for (const id of ids) {
		// materialize.mjs gives a plain base copy for an unknown id. A check of that copy proves nothing.
		assertStarterId(id);
		if (readStarterJson(id) === null) {
			throw new Error(`templates/starters/${id}/starter.json does not exist.`);
		}
	}

	let failures = 0;
	// LIMIT: one starter at a time, about 1 minute each. Upgrade: a pool of 4 child processes.
	for (const id of ids) {
		// The OS temp folder is outside the repo, as materialize.mjs requires.
		const workDir = mkdtempSync(join(tmpdir(), `starter-check-${id}-`));
		try {
			const failure = checkStarter(id, workDir);
			if (failure === null) {
				console.log(`PASS ${id}`);
			} else {
				failures += 1;
				console.log(`FAIL ${id}: ${failure.command}\n${failure.output}`);
			}
		} finally {
			rmSync(workDir, { recursive: true, force: true });
		}
	}
	console.log(`${ids.length - failures} of ${ids.length} starter(s) pass`);
	if (failures > 0) {
		process.exit(1);
	}
});
