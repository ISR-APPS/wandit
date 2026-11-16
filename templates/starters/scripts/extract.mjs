// Saves the work folder of one starter as an overlay in git.
// Run: node templates/starters/scripts/extract.mjs <id> <workDir>
// An author runs it after the work in a folder that materialize.mjs made.
// It compares <workDir> with the files of templates/web-app that git does not ignore, then
// writes templates/starters/<id>/files/ and the "removed" list of starter.json.
import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	assertStarterId,
	BASE_DIR,
	listBaseFiles,
	listFiles,
	REPO_ROOT,
	readStarterJson,
	runScript,
	STARTERS_DIR,
	starterPathProblems,
} from "./starter-source.mjs";

/** Install output, build output, tool caches, local secrets, and archives. They are not source. */
function isLocalOnly(name) {
	return (
		["node_modules", "dist", ".wrangler", ".tanstack", ".env"].includes(name) ||
		name.startsWith(".env.") ||
		name.endsWith(".tar.gz")
	);
}

await runScript(() => {
	const [id, workDirArg, ...rest] = process.argv.slice(2);
	if (id === undefined || workDirArg === undefined || rest.length > 0) {
		throw new Error(
			"usage: node templates/starters/scripts/extract.mjs <id> <workDir>",
		);
	}
	assertStarterId(id);
	const workDir = resolve(workDirArg);
	if (!existsSync(join(workDir, "package.json"))) {
		throw new Error(`${workDir} is not a project. Run materialize.mjs first.`);
	}

	const baseFiles = new Set(listBaseFiles());
	const workFiles = listFiles(workDir, isLocalOnly);
	const workFileSet = new Set(workFiles);
	// The overlay holds a file only when it is new or its bytes differ from the base.
	const overlayFiles = workFiles.filter(
		(path) =>
			!baseFiles.has(path) ||
			!readFileSync(join(workDir, path)).equals(
				readFileSync(join(BASE_DIR, path)),
			),
	);
	const removed = [...baseFiles]
		.filter((path) => !workFileSet.has(path))
		.sort();

	// The check comes before the first write, so a refused starter leaves git as it was.
	const problems = starterPathProblems([...overlayFiles, ...removed]);
	if (problems.length > 0) {
		throw new Error(
			`The work folder changes paths that a starter must not change:\n${problems.join("\n")}`,
		);
	}

	const starterDir = join(STARTERS_DIR, id);
	const filesDir = join(starterDir, "files");
	// A file that the author deleted in the work folder must also leave the overlay.
	rmSync(filesDir, { recursive: true, force: true });
	mkdirSync(filesDir, { recursive: true });
	let totalBytes = 0;
	for (const path of overlayFiles) {
		const target = join(filesDir, path);
		mkdirSync(dirname(target), { recursive: true });
		copyFileSync(join(workDir, path), target);
		totalBytes += statSync(target).size;
	}
	// The other keys stay, for example "theme". build-starter-theme.ts reads that one.
	const starterJson = { ...readStarterJson(id), id, removed };
	const starterJsonPath = join(starterDir, "starter.json");
	writeFileSync(
		starterJsonPath,
		`${JSON.stringify(starterJson, null, "\t")}\n`,
	);
	// The repo check reads starter.json, and Biome puts a short list on one line.
	const format = spawnSync(
		"npx",
		["biome", "format", "--write", starterJsonPath],
		{ cwd: REPO_ROOT, encoding: "utf8" },
	);
	if (format.status !== 0) {
		throw new Error(
			`biome could not format ${starterJsonPath}:\n${format.stderr || format.error?.message}`,
		);
	}

	console.log(
		`starter "${id}": ${overlayFiles.length} file(s), ${totalBytes} bytes, ${removed.length} removed`,
	);
});
