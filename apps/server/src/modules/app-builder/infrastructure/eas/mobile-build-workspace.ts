/**
 * Prepares one commit of a mobile app for `eas build` on the Trigger worker
 * (WANDIT-194). The `mobile-build` task calls `prepareMobileBuildWorkspace`.
 * It runs git and pnpm through `exec`, checks app.json and package.json, and
 * writes app.json, eas.json, and .easignore with `node:fs`.
 */
/*
 * Security: the worker holds DATABASE_URL and every other secret, so no
 * user code may run here. `node_modules` comes from the trusted template
 * files, installed with `--ignore-scripts`. A config plugin must be a
 * template or allowed module. A dynamic app config, a symbolic link, and a
 * package.json "exports" field are refused. Wandit writes eas.json and
 * .easignore, never the user. The trusted install must not show
 * `metro-config` at its top, or eas loads the user metro.config.js.
 */

import { existsSync, type Stats } from "node:fs";
import {
	copyFile,
	lstat,
	mkdir,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { join, relative } from "node:path";

import {
	appPackageJsonSchema,
	commitShaSchema,
	type EasJson,
	type ExpoAppJson,
	easJsonSchema,
	expoAppJsonSchema,
	type MobileBuildErrorCode,
	nativeModulesJsonSchema,
	type TemplatePackageJson,
	templatePackageJsonSchema,
} from "@wandit/contracts";
import { z } from "zod";

import {
	checkConfigPlugins,
	type EasProjectIdentity,
	withWanditEasIdentity,
} from "../../domain/mobile-build";
import type { SandboxHandle } from "../../domain/ports/sandbox-provider";
import { authenticatedRemoteUrl } from "../git/git-remote-url";
import { mustRunGit } from "../git/sandbox-git";

// app.json and package.json are plain config. 1 MB stops a file that only
// fills the memory.
const CONFIG_JSON_MAX_BYTES = 1024 * 1024;

// A git fetch that hangs must not hold the build until the task limit. The
// read credential lives 600 s, so a longer fetch fails anyway.
const GIT_TIMEOUT_MS = 5 * 60_000;

// A cold install of the Expo template downloads the full dependency tree.
// 10 min covers a slow registry.
const INSTALL_TIMEOUT_MS = 10 * 60_000;

// The end of the pnpm output that a failure keeps. With the prefix, the
// message stays below the 500-character cut of `MobileBuildsRepository`.
const INSTALL_OUTPUT_TAIL_CHARS = 400;

// The template files of the trusted install, next to its package.json. The
// user lockfile never joins it; EAS installs that one on its own machines.
const TRUSTED_INSTALL_FILES = [
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	".npmrc",
] as const;

// The upload filter of eas. When it exists, eas ignores every .gitignore.
const EASIGNORE_TEXT = `${[
	// EAS installs the user lockfile; the worker install stays here.
	"node_modules",
	// Local caches and build outputs.
	".expo",
	"dist",
	"*.tar.gz",
	// Local secrets never leave the worker. The APK env comes from eas.json.
	".env",
	".env.*",
	// A native folder makes eas treat the app as bare and read its Gradle files.
	"/ios",
	"/android",
].join("\n")}\n`;

/** Input of `prepareMobileBuildWorkspace`. The `mobile-build` task fills it. */
export type MobileBuildWorkspaceInput = {
	/** Empty temp folder the caller made with `mkdtemp`. The caller removes it in `finally`. */
	rootDir: string;
	/** The 40-character commit to build: `mobile_builds.commit_sha`. */
	commitSha: string;
	/** A `git:read` code.storage JWT and the plain remote: `GitStore.issueCredential(..., "read")`. */
	credential: { username: string; password: string; remoteUrl: string };
	/** The EAS slug, owner, and Android package of the project: `easIdentityFor`. */
	identity: EasProjectIdentity;
	/** `EXPO_PUBLIC_SUPABASE_URL` and `_ANON_KEY` of an active, paused, or restoring backend, or `{}`. Goes to `build.apk.env`. */
	appEnv: Record<string, string>;
	/** Folder with the trusted template files: `resolve(TEMPLATE_ARCHIVE_DIR, "mobile-app")`. */
	templateDir: string;
};

/**
 * Result of `prepareMobileBuildWorkspace`. A user fault is a `failed`
 * result; a worker fault, such as a missing template file, throws.
 */
export type MobileBuildWorkspaceResult =
	| {
			kind: "ready";
			/** The prepared project folder: `<rootDir>/app`. The eas commands run in it. */
			projectDir: string;
	  }
	| {
			kind: "failed";
			errorCode: Extract<
				MobileBuildErrorCode,
				| "clone_failed"
				| "config_invalid"
				| "plugin_not_allowed"
				| "install_failed"
			>;
			/** English detail for `mobile_builds.error_message`, with no credential. `MobileBuildsRepository` keeps its first 500 characters. */
			errorMessage: string;
	  };

type WorkspaceFailure = Extract<MobileBuildWorkspaceResult, { kind: "failed" }>;

/** The trusted template files that the workspace reads. */
type TrustedTemplate = {
	packageJson: TemplatePackageJson;
	easJson: EasJson;
	/** The `native` map of native-modules.json: module name to SDK version range. */
	nativeModules: Record<string, string>;
};

// A git step of the clone failed. The message never holds the credential.
class WorkspaceGitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "WorkspaceGitError";
	}
}

/**
 * Clones `commitSha` into `<rootDir>/app`, checks and rewrites the Expo
 * config, and links `app/node_modules` to a trusted install in
 * `<rootDir>/deps`. Answers `failed` with the build error code on a user fault.
 */
export async function prepareMobileBuildWorkspace(
	exec: SandboxHandle["exec"],
	input: MobileBuildWorkspaceInput,
): Promise<MobileBuildWorkspaceResult> {
	const appDir = join(input.rootDir, "app");
	const depsDir = join(input.rootDir, "deps");
	await mkdir(appDir);
	await mkdir(depsDir);
	const template = await readTrustedTemplate(input.templateDir);

	const cloneFailure = await cloneCommit(exec, appDir, input);
	if (cloneFailure !== null) {
		return cloneFailure;
	}

	const config = await checkAppConfig(appDir);
	if (config.kind === "failed") {
		return config;
	}
	const plugins = checkConfigPlugins(
		config.appJson.expo.plugins ?? [],
		template.packageJson.dependencies,
		template.nativeModules,
	);
	if (plugins.kind === "refused") {
		return failed(
			"plugin_not_allowed",
			`app.json names the config plugin "${plugins.moduleName}", which is not an allowed module`,
		);
	}

	const appJson = withWanditEasIdentity(config.appJson, input.identity);
	await writeFresh(join(appDir, "app.json"), jsonText(appJson));
	// EAS builders do not see the worker env, and `.env` never reaches EAS,
	// so the backend values of the app go into the profile env.
	const easJson: EasJson = {
		...template.easJson,
		build: {
			...template.easJson.build,
			apk: {
				...template.easJson.build.apk,
				env: { ...template.easJson.build.apk.env, ...input.appEnv },
			},
		},
	};
	await writeFresh(join(appDir, "eas.json"), jsonText(easJson));
	await writeFresh(join(appDir, ".easignore"), EASIGNORE_TEXT);

	const installFailure = await installTrustedDependencies(
		exec,
		depsDir,
		input.templateDir,
		template.packageJson,
		plugins.extraDependencies,
	);
	if (installFailure !== null) {
		return installFailure;
	}
	// eas loads the user metro.config.js when `metro-config` resolves from app/.
	// The isolated pnpm layout hides it; a hoist setting in the template shows it.
	if (existsSync(join(depsDir, "node_modules", "metro-config"))) {
		throw new Error(
			"The trusted install has metro-config at the top of node_modules, so eas would load the user metro.config.js",
		);
	}
	// eas and the expo CLI load modules from `app/node_modules`. The link
	// makes them load the trusted install, never a committed folder.
	await rm(join(appDir, "node_modules"), { recursive: true, force: true });
	await symlink(join(depsDir, "node_modules"), join(appDir, "node_modules"));
	return { kind: "ready", projectDir: appDir };
}

// Fetches one commit into `appDir` and checks it out. Answers a
// `clone_failed` failure, or null when HEAD is the commit.
async function cloneCommit(
	exec: SandboxHandle["exec"],
	appDir: string,
	input: MobileBuildWorkspaceInput,
): Promise<WorkspaceFailure | null> {
	// Security: the sha enters git argv. A 40-hex value can never read as a
	// git option such as `--upload-pack=...`.
	if (!commitShaSchema.safeParse(input.commitSha).success) {
		return failed("clone_failed", "The build commit is not a full git sha.");
	}
	const git: Pick<SandboxHandle, "exec" | "workspaceDir"> = {
		exec: (command, args, options) =>
			exec(command, args, { ...options, timeoutMs: GIT_TIMEOUT_MS }),
		workspaceDir: appDir,
	};
	const remoteUrl = authenticatedRemoteUrl(
		input.credential.remoteUrl,
		input.credential,
	);
	// The args carry the credential. The fixed labels and `secret` keep it
	// out of every message, also when git echoes the URL.
	const run = (label: string, args: string[]) =>
		mustRunGit(git, args, WorkspaceGitError, {
			label,
			secret: input.credential.password,
		});
	try {
		// init and fetch with the URL, never a clone or a remote: the
		// credential never reaches `.git/config`.
		await run("git init", ["init", "--quiet"]);
		try {
			await run("git fetch commit", [
				"fetch",
				"--quiet",
				"--depth",
				"1",
				remoteUrl,
				input.commitSha,
			]);
		} catch (error) {
			if (!(error instanceof WorkspaceGitError)) {
				throw error;
			}
			// code.storage may refuse a sha that is not a branch tip
			// (UNVERIFIED). History never rewinds, so `main` holds every sha.
			// LIMIT: the fallback fetches every commit of main, in GIT_TIMEOUT_MS (5 min) at most. Upgrade: fetch with --depth and --deepen until the sha exists.
			await run("git fetch main", ["fetch", "--quiet", remoteUrl, "main"]);
		}
		await run("git checkout", [
			"checkout",
			"--quiet",
			"--detach",
			input.commitSha,
		]);
		const head = (await run("git rev-parse", ["rev-parse", "HEAD"])).stdout;
		if (head.trim() !== input.commitSha) {
			return failed(
				"clone_failed",
				`git checked out ${head.trim()} instead of ${input.commitSha}`,
			);
		}
		return null;
	} catch (error) {
		if (error instanceof WorkspaceGitError) {
			return failed("clone_failed", error.message);
		}
		throw error;
	}
}

// Checks the checkout before any tool reads it, parses app.json, and checks
// package.json.
async function checkAppConfig(
	appDir: string,
): Promise<{ kind: "ok"; appJson: ExpoAppJson } | WorkspaceFailure> {
	// eas and the expo CLI read user files by path. A link could make them
	// read a worker file, such as /proc/<pid>/environ, into a message.
	const entries = await readdir(appDir, {
		recursive: true,
		withFileTypes: true,
	});
	const link = entries.find((entry) => entry.isSymbolicLink());
	if (link !== undefined) {
		const path = relative(appDir, join(link.parentPath, link.name));
		return failed("config_invalid", `The app has a symbolic link: ${path}`);
	}

	// The expo CLI prefers `app.config.*`, a file or a folder, over app.json.
	// A dynamic one runs user code, and a JSON one skips the checks below.
	const names = await readdir(appDir);
	const appConfig = names.find((name) => {
		const lower = name.toLowerCase();
		return lower === "app.config" || lower.startsWith("app.config.");
	});
	if (appConfig !== undefined) {
		return failed(
			"config_invalid",
			`The app has ${appConfig}. Only a static app.json is allowed.`,
		);
	}
	const appJson = await readCheckoutJson(appDir, "app.json", expoAppJsonSchema);
	if (appJson.kind === "missing") {
		return failed("config_invalid", "The app has no app.json.");
	}
	if (appJson.kind === "failed") {
		return appJson;
	}

	// With "exports", Node resolves a bare name such as `expo/bin/cli` to the
	// app's own files (self-reference). eas would then run user code.
	const packageJson = await readCheckoutJson(
		appDir,
		"package.json",
		appPackageJsonSchema,
	);
	if (packageJson.kind === "failed") {
		return packageJson;
	}
	if (packageJson.kind === "ok" && packageJson.data.exports !== undefined) {
		return failed(
			"config_invalid",
			'package.json has an "exports" field. Remove it to build the app.',
		);
	}
	return { kind: "ok", appJson: appJson.data };
}

// Reads and parses one JSON file at the top of the checkout. lstat comes
// first, so a folder or a large file never reaches `readFile`.
async function readCheckoutJson<Schema extends z.ZodType>(
	appDir: string,
	name: "app.json" | "package.json",
	schema: Schema,
): Promise<
	| { kind: "ok"; data: z.output<Schema> }
	| { kind: "missing" }
	| WorkspaceFailure
> {
	const path = join(appDir, name);
	let stats: Stats;
	try {
		stats = await lstat(path);
	} catch (error) {
		// A missing file is an answer, not a fault. Node reads the same path,
		// so a disk that ignores the name case gives both the same file.
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return { kind: "missing" };
		}
		throw error;
	}
	if (!stats.isFile()) {
		return failed("config_invalid", `${name} is not a regular file.`);
	}
	if (stats.size > CONFIG_JSON_MAX_BYTES) {
		return failed("config_invalid", `${name} is larger than 1 MB.`);
	}
	const text = await readFile(path, "utf8");
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		// The SyntaxError text quotes the file; a fixed message is enough.
		return failed("config_invalid", `${name} is not valid JSON.`);
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return failed(
			"config_invalid",
			`${name} has invalid fields: ${z.prettifyError(parsed.error)}`,
		);
	}
	return { kind: "ok", data: parsed.data };
}

// Installs the template dependencies, plus the allowed extra modules, in
// `depsDir`. Answers an `install_failed` failure, or null on success.
async function installTrustedDependencies(
	exec: SandboxHandle["exec"],
	depsDir: string,
	templateDir: string,
	packageJson: TemplatePackageJson,
	extraDependencies: Record<string, string>,
): Promise<WorkspaceFailure | null> {
	for (const name of TRUSTED_INSTALL_FILES) {
		await copyFile(join(templateDir, name), join(depsDir, name));
	}
	await writeFile(
		join(depsDir, "package.json"),
		jsonText({
			...packageJson,
			dependencies: { ...packageJson.dependencies, ...extraDependencies },
		}),
	);
	// An extra module is not in the template lockfile, so pnpm must resolve
	// it. Without one, the install must match the lockfile exactly.
	const hasExtras = Object.keys(extraDependencies).length > 0;
	// `--ignore-scripts`: no package script runs on the worker.
	const result = await exec(
		"pnpm",
		[
			"install",
			"--ignore-scripts",
			hasExtras ? "--no-frozen-lockfile" : "--frozen-lockfile",
		],
		{ cwd: depsDir, timeoutMs: INSTALL_TIMEOUT_MS },
	);
	if (result.exitCode !== 0) {
		// pnpm prints an error on stdout or on stderr, so both are kept.
		const output = `${result.stdout}\n${result.stderr}`.trim();
		return failed(
			"install_failed",
			`pnpm install exited with ${result.exitCode}: ${output.slice(-INSTALL_OUTPUT_TAIL_CHARS)}`,
		);
	}
	return null;
}

// Reads the three JSON files of the trusted template. A missing or invalid
// file is a worker fault, so it throws.
async function readTrustedTemplate(
	templateDir: string,
): Promise<TrustedTemplate> {
	const [packageJson, easJson, nativeModules] = await Promise.all([
		readTemplateJson(templateDir, "package.json", templatePackageJsonSchema),
		readTemplateJson(templateDir, "eas.json", easJsonSchema),
		readTemplateJson(
			templateDir,
			"native-modules.json",
			nativeModulesJsonSchema,
		),
	]);
	return { packageJson, easJson, nativeModules: nativeModules.native };
}

async function readTemplateJson<Schema extends z.ZodType>(
	templateDir: string,
	name: string,
	schema: Schema,
): Promise<z.output<Schema>> {
	const raw: unknown = JSON.parse(
		await readFile(join(templateDir, name), "utf8"),
	);
	return schema.parse(raw);
}

// Writes a wandit file where the checkout can hold a user file or folder.
// `rm` first and the `wx` flag make sure no user link is followed.
async function writeFresh(path: string, text: string): Promise<void> {
	await rm(path, { force: true, recursive: true });
	await writeFile(path, text, { flag: "wx" });
}

// JSON with tabs, like every template JSON file.
function jsonText(value: ExpoAppJson | EasJson | TemplatePackageJson): string {
	return `${JSON.stringify(value, null, "\t")}\n`;
}

// A user fault. `MobileBuildsRepository` cuts the message when it stores it.
function failed(
	errorCode: WorkspaceFailure["errorCode"],
	errorMessage: string,
): WorkspaceFailure {
	return { kind: "failed", errorCode, errorMessage };
}
