// Shared helpers of the starter scripts: the folder constants, the file
// lists, the checked source of one starter, and the pnpm launcher.
// materialize.mjs, extract.mjs, pack.mjs, check.mjs, and shot.mjs import it.
// It reads the disk and runs git and pnpm. protected-paths.mjs has the guard.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { starterPathError } from "./protected-paths.mjs";

/** templates/starters. Each starter is one sub-folder with a starter.json. */
export const STARTERS_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);
/** templates. pack.mjs writes the archives here, next to the base archives. */
export const TEMPLATES_DIR = resolve(STARTERS_DIR, "..");
/** templates/web-app, the base template that each starter changes. */
export const BASE_DIR = join(TEMPLATES_DIR, "web-app");
/** The root of this checkout. A work folder must be outside it. */
export const REPO_ROOT = resolve(TEMPLATES_DIR, "..");

/** The pnpm of the base template, started through npx. Put the pnpm arguments after it. */
export const PNPM_COMMAND = ["npx", "-y", "pnpm@11.7.0"];

/** A starter id is also a folder name, an archive name, and a URL segment. Throws on a bad id. */
export function assertStarterId(id) {
	// 40 characters is the limit of the API request schema.
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.length > 40) {
		throw new Error(
			`"${id}" is not a starter id. Use kebab-case, at most 40 characters.`,
		);
	}
}

/**
 * Runs a script body. An error prints its message and ends the process with code 1.
 * Each starter script calls it one time with its main function.
 */
export async function runScript(main) {
	try {
		await main();
	} catch (error) {
		console.error(`error: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	}
}

/**
 * Runs pnpm in `cwd` and returns the spawnSync result. `stdio` is "inherit" or "pipe".
 * With "pipe", `stdout` and `stderr` are strings.
 */
export function runPnpm(args, cwd, stdio) {
	const [command, ...prefix] = PNPM_COMMAND;
	return spawnSync(command, [...prefix, ...args], {
		cwd,
		stdio,
		encoding: "utf8",
		// A failed build prints much more than the default 1 MB.
		maxBuffer: 64 * 1024 * 1024,
	});
}

/**
 * The files of templates/web-app that git does not ignore, tracked or not, as paths relative to it.
 * This is the disk state, so a base change counts before its commit. Needs git and a checkout.
 */
export function listBaseFiles() {
	const output = execFileSync(
		"git",
		["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		{
			cwd: BASE_DIR,
			encoding: "utf8",
			// The lockfile alone is large, so the default 1 MB is too near.
			maxBuffer: 64 * 1024 * 1024,
		},
	);
	// The index still lists a file that a not-committed base change deleted.
	return output
		.split("\0")
		.filter((path) => path !== "" && existsSync(join(BASE_DIR, path)));
}

/**
 * The regular files below `dir`, as sorted paths relative to it with "/" separators.
 * `isIgnored(name)` skips a file or a folder by its name. macOS metadata files are always skipped.
 * Throws on a symlink: a link in an overlay can point outside the project.
 */
export function listFiles(dir, isIgnored = () => false) {
	const files = [];
	const walk = (folder, prefix) => {
		for (const entry of readdirSync(folder, { withFileTypes: true })) {
			const { name } = entry;
			if (name === ".DS_Store" || name.startsWith("._") || isIgnored(name)) {
				continue;
			}
			const path = prefix === "" ? name : `${prefix}/${name}`;
			if (entry.isDirectory()) {
				walk(join(folder, name), path);
			} else if (entry.isFile()) {
				files.push(path);
			} else {
				throw new Error(`${join(dir, path)} is not a regular file.`);
			}
		}
	};
	walk(dir, "");
	return files.sort();
}

/** One line for each path that a starter must not hold or remove. Empty when all paths are allowed. */
export function starterPathProblems(paths) {
	const isBasePath = (path) => existsSync(join(BASE_DIR, path));
	return paths.flatMap((path) => {
		const reason = starterPathError(path, isBasePath);
		return reason === null ? [] : [`  ${path}: ${reason}`];
	});
}

/** The ids of the starters, sorted: each folder of templates/starters with a starter.json. */
export function listStarterIds() {
	return readdirSync(STARTERS_DIR, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() &&
				existsSync(join(STARTERS_DIR, entry.name, "starter.json")),
		)
		.map((entry) => entry.name)
		.sort();
}

/**
 * The parsed starter.json of one starter, or null when the starter has none.
 * Throws when the text is not a JSON object, and names the file.
 */
export function readStarterJson(id) {
	const path = join(STARTERS_DIR, id, "starter.json");
	if (!existsSync(path)) {
		return null;
	}
	let json;
	try {
		json = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		// The parser message has no file name, so the author cannot find the file from it.
		throw new Error(`${path} is not valid JSON: ${error.message}`);
	}
	if (json === null || typeof json !== "object" || Array.isArray(json)) {
		throw new Error(`${path} must hold a JSON object.`);
	}
	return json;
}

/**
 * The checked source of one starter, or null when templates/starters/<id>/starter.json does not exist.
 * `files` are the paths of files/, relative to it. `removed` are the base paths that the starter deletes.
 * Throws when the id, the "removed" list, or one path is not valid, and names each bad path.
 */
export function readStarter(id) {
	assertStarterId(id);
	const json = readStarterJson(id);
	if (json === null) {
		return null;
	}
	const starterDir = join(STARTERS_DIR, id);
	if (json.id !== id) {
		throw new Error(
			`${join(starterDir, "starter.json")}: "id" must be "${id}", the folder name.`,
		);
	}
	const removed = json.removed;
	if (
		!Array.isArray(removed) ||
		removed.some((path) => typeof path !== "string")
	) {
		throw new Error(
			`${join(starterDir, "starter.json")}: "removed" must be a list of paths.`,
		);
	}
	const filesDir = join(starterDir, "files");
	// A link in place of files/ passes the walk below, and tar packs the link. The server then copies its target.
	if (lstatSync(filesDir, { throwIfNoEntry: false })?.isSymbolicLink()) {
		throw new Error(`${filesDir} is a link. It must be a real folder.`);
	}
	const files = existsSync(filesDir) ? listFiles(filesDir) : [];
	const problems = starterPathProblems([...files, ...removed]);
	if (problems.length > 0) {
		throw new Error(
			`The starter "${id}" has paths that are not allowed:\n${problems.join("\n")}`,
		);
	}
	return { filesDir, files, removed };
}
