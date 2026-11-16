// Builds a full project of one starter in a work folder outside the repo.
// Run: node templates/starters/scripts/materialize.mjs <id> <workDir> [--no-install]
// An author runs it to start or continue a starter. check.mjs runs it for each check.
// It copies the files of templates/web-app that git does not ignore, applies templates/starters/<id>
// (files/ first, then "removed"), and runs the frozen pnpm install.
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
	assertStarterId,
	BASE_DIR,
	listBaseFiles,
	REPO_ROOT,
	readStarter,
	runPnpm,
	runScript,
} from "./starter-source.mjs";

/** Copies each path of `paths` from `fromDir` to `toDir` and makes the folders. */
function copyFiles(paths, fromDir, toDir) {
	for (const path of paths) {
		const target = join(toDir, path);
		mkdirSync(dirname(target), { recursive: true });
		copyFileSync(join(fromDir, path), target);
	}
}

/** The real path of a folder that possibly does not exist: its nearest real parent, plus the rest. */
function realPathOf(path) {
	let existing = path;
	while (!existsSync(existing)) {
		existing = dirname(existing);
	}
	// The native call also gives the letter case of the disk. macOS ignores case.
	return join(realpathSync.native(existing), relative(existing, path));
}

await runScript(() => {
	const args = process.argv.slice(2);
	const install = !args.includes("--no-install");
	const [id, workDirArg, ...rest] = args.filter(
		(arg) => arg !== "--no-install",
	);
	if (id === undefined || workDirArg === undefined || rest.length > 0) {
		throw new Error(
			"usage: node templates/starters/scripts/materialize.mjs <id> <workDir> [--no-install]",
		);
	}
	assertStarterId(id);

	const workDir = realPathOf(resolve(workDirArg));
	// Inside the repo, git, biome, and the monorepo tools read the copy as repo files.
	if (
		`${workDir}${sep}`.startsWith(`${realpathSync.native(REPO_ROOT)}${sep}`)
	) {
		throw new Error(`${workDir} is inside the repo. Use a folder outside it.`);
	}
	// A file of an older copy stays when the base or the starter no longer has it.
	if (existsSync(workDir) && readdirSync(workDir).length > 0) {
		throw new Error(`${workDir} is not empty. Delete it first.`);
	}

	const starter = readStarter(id);
	copyFiles(listBaseFiles(), BASE_DIR, workDir);
	if (starter === null) {
		console.log(`new starter "${id}": plain copy of templates/web-app`);
	} else {
		copyFiles(starter.files, starter.filesDir, workDir);
		for (const path of starter.removed) {
			// readStarter refused each path that leaves the work folder.
			rmSync(join(workDir, path), { recursive: true, force: true });
		}
		console.log(
			`starter "${id}": ${starter.files.length} file(s) applied, ${starter.removed.length} removed`,
		);
	}

	if (install) {
		// The copy keeps its pnpm-workspace.yaml, so it is its own install root.
		const result = runPnpm(
			["install", "--frozen-lockfile"],
			workDir,
			"inherit",
		);
		if (result.status !== 0) {
			throw new Error(`pnpm install failed in ${workDir}.`);
		}
	}
	console.log(`ready: ${workDir}`);
});
