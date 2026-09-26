import { execFileSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { easIdentityFor } from "../../domain/mobile-build";
import type {
	SandboxExecOptions,
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import { hostExec } from "./host-exec";
import {
	type MobileBuildWorkspaceInput,
	prepareMobileBuildWorkspace,
} from "./mobile-build-workspace";

const JWT = "header.payload.signature";
const IDENTITY = easIdentityFor(
	"0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10",
	"wandit",
);
const APP_ENV = {
	EXPO_PUBLIC_SUPABASE_URL: "https://ref.supabase.co",
	EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

const TEMPLATE_EAS_JSON = {
	cli: { version: ">= 24.8.0", appVersionSource: "remote" },
	build: {
		apk: {
			distribution: "internal",
			android: { buildType: "apk" },
			env: { EXPO_PUBLIC_FLAG: "on" },
		},
	},
};

// A user app.json that tries to pick its own EAS project and package.
const USER_APP_JSON = {
	expo: {
		name: "My App",
		slug: "my-app",
		owner: "someone-else",
		android: { package: "com.other.app", versionCode: 3 },
		extra: {
			eas: { projectId: "other-project" },
			apiUrl: "https://api.example.com",
		},
		plugins: ["expo-router"],
	},
};

// The user files without app.json, for the cases that replace or remove it.
const FILES_WITHOUT_APP_JSON: Record<string, string> = {
	"package.json": JSON.stringify({ name: "my-app", dependencies: {} }),
	// The user eas.json never reaches EAS.
	"eas.json": JSON.stringify({ build: { apk: { env: { USER_VALUE: "1" } } } }),
	"src/index.ts": "export {};\n",
};

const USER_FILES: Record<string, string> = {
	...FILES_WITHOUT_APP_JSON,
	"app.json": JSON.stringify(USER_APP_JSON),
};

let tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs = [];
});

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function git(cwd: string, args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" });
}

type Repo = { remoteUrl: string; sha: string };

/** A bare repository with one commit of `files` and `links` (path to link target). */
function makeRepo(
	files: Record<string, string>,
	links: Record<string, string> = {},
): Repo {
	const work = tempDir("mobile-build-src-");
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(work, path)), { recursive: true });
		writeFileSync(join(work, path), text);
	}
	for (const [path, target] of Object.entries(links)) {
		symlinkSync(target, join(work, path));
	}
	git(work, ["init", "--quiet", "-b", "main"]);
	git(work, ["add", "-A"]);
	git(work, [
		"-c",
		"user.name=spec",
		"-c",
		"user.email=spec@example.com",
		"commit",
		"--quiet",
		"-m",
		"app",
	]);
	const bare = tempDir("mobile-build-bare-");
	git(bare, ["clone", "--quiet", "--bare", work, "."]);
	return {
		remoteUrl: pathToFileURL(bare).href,
		sha: git(work, ["rev-parse", "HEAD"]).trim(),
	};
}

/** The trusted template files, with `expo-camera` as the one allowed extra module. */
function makeTemplate(): string {
	const dir = tempDir("mobile-build-template-");
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({
			name: "mobile-app",
			dependencies: { expo: "57.0.25", "expo-router": "57.0.23" },
		}),
	);
	writeFileSync(join(dir, "eas.json"), JSON.stringify(TEMPLATE_EAS_JSON));
	writeFileSync(
		join(dir, "native-modules.json"),
		JSON.stringify({ expo: "57.0.25", native: { "expo-camera": "~57.0.5" } }),
	);
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages: []\n");
	writeFileSync(join(dir, ".npmrc"), "engine-strict=true\n");
	return dir;
}

function inputFor(repo: Repo): MobileBuildWorkspaceInput {
	return {
		rootDir: tempDir("wandit-mobile-build-"),
		commitSha: repo.sha,
		credential: { username: "t", password: JWT, remoteUrl: repo.remoteUrl },
		identity: IDENTITY,
		appEnv: APP_ENV,
		templateDir: makeTemplate(),
	};
}

type ExecCall = {
	command: string;
	args: string[];
	options: SandboxExecOptions | undefined;
};

/**
 * Runs git for real through `hostExec`, unless `gitAnswer` answers the
 * call. Answers pnpm with `pnpmAnswer` and makes the `node_modules` folder
 * that a real install makes.
 */
function recordingExec(
	answers: {
		pnpmAnswer?: SandboxExecResult;
		/** Package folders that the fake install makes at the top of `node_modules`. */
		topLevelPackages?: string[];
		gitAnswer?: (args: string[]) => SandboxExecResult | null;
	} = {},
) {
	const calls: ExecCall[] = [];
	const exec: SandboxHandle["exec"] = async (command, args, options) => {
		calls.push({ command, args, options });
		if (command === "pnpm") {
			if (options?.cwd === undefined) {
				throw new Error("the workspace runs pnpm without a cwd");
			}
			mkdirSync(join(options.cwd, "node_modules"), { recursive: true });
			for (const name of answers.topLevelPackages ?? []) {
				mkdirSync(join(options.cwd, "node_modules", name));
			}
			return answers.pnpmAnswer ?? { exitCode: 0, stdout: "", stderr: "" };
		}
		return answers.gitAnswer?.(args) ?? hostExec(command, args, options);
	};
	const pnpmCalls = () => calls.filter((call) => call.command === "pnpm");
	return { calls, exec, pnpmCalls };
}

describe("prepareMobileBuildWorkspace", () => {
	it("checks out the commit, writes the wandit files, and links the trusted install", async () => {
		const repo = makeRepo(USER_FILES);
		const input = inputFor(repo);
		const { calls, exec, pnpmCalls } = recordingExec();

		const result = await prepareMobileBuildWorkspace(exec, input);

		const appDir = join(input.rootDir, "app");
		const depsDir = join(input.rootDir, "deps");
		expect(result).toEqual({ kind: "ready", projectDir: appDir });
		expect(git(appDir, ["rev-parse", "HEAD"]).trim()).toBe(repo.sha);
		// A hung fetch must not hold the build: every git call has a timeout.
		const gitCalls = calls.filter((call) => call.command === "git");
		expect(gitCalls.map((call) => call.args[0])).toEqual([
			"init",
			"fetch",
			"checkout",
			"rev-parse",
		]);
		expect(gitCalls.map((call) => call.options)).toEqual(
			gitCalls.map(() => ({ cwd: appDir, timeoutMs: 300_000 })),
		);
		// No remote: the credential never lands in `.git/config`.
		expect(readFileSync(join(appDir, ".git", "config"), "utf8")).not.toContain(
			"[remote",
		);
		expect(JSON.parse(readFileSync(join(appDir, "app.json"), "utf8"))).toEqual({
			expo: {
				name: "My App",
				slug: IDENTITY.slug,
				owner: "wandit",
				android: { package: IDENTITY.androidPackage, versionCode: 3 },
				extra: { apiUrl: "https://api.example.com" },
				plugins: ["expo-router"],
			},
		});
		expect(JSON.parse(readFileSync(join(appDir, "eas.json"), "utf8"))).toEqual({
			...TEMPLATE_EAS_JSON,
			build: {
				apk: {
					...TEMPLATE_EAS_JSON.build.apk,
					env: { EXPO_PUBLIC_FLAG: "on", ...APP_ENV },
				},
			},
		});
		expect(
			readFileSync(join(appDir, ".easignore"), "utf8").split("\n"),
		).toEqual([
			"node_modules",
			".expo",
			"dist",
			"*.tar.gz",
			".env",
			".env.*",
			"/ios",
			"/android",
			"",
		]);
		expect(lstatSync(join(appDir, "node_modules")).isSymbolicLink()).toBe(true);
		expect(readlinkSync(join(appDir, "node_modules"))).toBe(
			join(depsDir, "node_modules"),
		);
		expect(pnpmCalls()).toEqual([
			{
				command: "pnpm",
				args: ["install", "--ignore-scripts", "--frozen-lockfile"],
				options: { cwd: depsDir, timeoutMs: 600_000 },
			},
		]);
		expect(readFileSync(join(depsDir, "pnpm-lock.yaml"), "utf8")).toBe(
			"lockfileVersion: '9.0'\n",
		);
		expect(
			JSON.parse(readFileSync(join(depsDir, "package.json"), "utf8")),
		).toEqual({
			name: "mobile-app",
			dependencies: { expo: "57.0.25", "expo-router": "57.0.23" },
		});
	});

	it("adds an allowed extra plugin module to the install and unfreezes the lockfile", async () => {
		const appJson = {
			expo: {
				name: "My App",
				plugins: [
					"expo-router",
					["expo-camera", { cameraPermission: "Take photos" }],
				],
			},
		};
		const input = inputFor(
			makeRepo({ ...USER_FILES, "app.json": JSON.stringify(appJson) }),
		);
		const { exec, pnpmCalls } = recordingExec();

		const result = await prepareMobileBuildWorkspace(exec, input);

		expect(result.kind).toBe("ready");
		expect(pnpmCalls()[0]?.args).toEqual([
			"install",
			"--ignore-scripts",
			"--no-frozen-lockfile",
		]);
		expect(
			JSON.parse(
				readFileSync(join(input.rootDir, "deps", "package.json"), "utf8"),
			),
		).toEqual({
			name: "mobile-app",
			dependencies: {
				expo: "57.0.25",
				"expo-router": "57.0.23",
				"expo-camera": "~57.0.5",
			},
		});
	});

	it("accepts an app without package.json, where no self-reference exists", async () => {
		const input = inputFor(
			makeRepo({
				"app.json": JSON.stringify(USER_APP_JSON),
				"src/index.ts": "export {};\n",
			}),
		);
		const { exec } = recordingExec();

		const result = await prepareMobileBuildWorkspace(exec, input);

		expect(result.kind).toBe("ready");
	});

	it.each([
		"./plugins/with-secret.js",
		"expo-unknown-module",
	])("refuses the plugin %s before any install", async (plugin) => {
		const appJson = { expo: { name: "My App", plugins: [plugin] } };
		const input = inputFor(
			makeRepo({ ...USER_FILES, "app.json": JSON.stringify(appJson) }),
		);
		const { exec, pnpmCalls } = recordingExec();

		const result = await prepareMobileBuildWorkspace(exec, input);

		expect(result).toEqual({
			kind: "failed",
			errorCode: "plugin_not_allowed",
			errorMessage: `app.json names the config plugin "${plugin}", which is not an allowed module`,
		});
		expect(pnpmCalls()).toEqual([]);
	});

	it.each([
		"app.config.ts",
		"app.config.json",
	])("refuses %s, which the expo CLI reads before app.json", async (name) => {
		const input = inputFor(
			makeRepo({ ...USER_FILES, [name]: "export default {};\n" }),
		);
		const { exec, pnpmCalls } = recordingExec();

		const result = await prepareMobileBuildWorkspace(exec, input);

		expect(result).toEqual({
			kind: "failed",
			errorCode: "config_invalid",
			errorMessage: `The app has ${name}. Only a static app.json is allowed.`,
		});
		expect(pnpmCalls()).toEqual([]);
	});

	it("refuses a symlinked app.json", async () => {
		const input = inputFor(
			makeRepo(
				{
					...FILES_WITHOUT_APP_JSON,
					"real.json": JSON.stringify(USER_APP_JSON),
				},
				{ "app.json": "real.json" },
			),
		);
		const { exec, pnpmCalls } = recordingExec();

		const result = await prepareMobileBuildWorkspace(exec, input);

		expect(result).toEqual({
			kind: "failed",
			errorCode: "config_invalid",
			errorMessage: "The app has a symbolic link: app.json",
		});
		expect(pnpmCalls()).toEqual([]);
	});

	it.each<[string, Record<string, string>, string]>([
		["no app.json", FILES_WITHOUT_APP_JSON, "The app has no app.json."],
		[
			"app.json as a folder",
			{ ...FILES_WITHOUT_APP_JSON, "app.json/x.txt": "x" },
			"app.json is not a regular file.",
		],
		[
			"an app.json above 1 MB",
			{
				...FILES_WITHOUT_APP_JSON,
				"app.json": JSON.stringify({
					expo: { name: "a", description: "x".repeat(1024 * 1024) },
				}),
			},
			"app.json is larger than 1 MB.",
		],
		[
			"invalid JSON",
			{ ...FILES_WITHOUT_APP_JSON, "app.json": "{ nope" },
			"app.json is not valid JSON.",
		],
		[
			"an app.json without expo.name",
			{
				...FILES_WITHOUT_APP_JSON,
				"app.json": JSON.stringify({ expo: { slug: "x" } }),
			},
			"app.json has invalid fields",
		],
		[
			// Node self-reference would resolve `expo/bin/cli` to this user file.
			'a package.json with "exports"',
			{
				...USER_FILES,
				"package.json": JSON.stringify({
					name: "expo",
					exports: { "./bin/cli": "./steal-env.js" },
				}),
			},
			'package.json has an "exports" field',
		],
		[
			"a package.json that is not an object",
			{ ...USER_FILES, "package.json": "[]" },
			"package.json has invalid fields",
		],
	])("refuses %s", async (_case, files, message) => {
		const { exec, pnpmCalls } = recordingExec();

		const result = await prepareMobileBuildWorkspace(
			exec,
			inputFor(makeRepo(files)),
		);

		expect(result).toEqual({
			kind: "failed",
			errorCode: "config_invalid",
			errorMessage: expect.stringContaining(message),
		});
		expect(pnpmCalls()).toEqual([]);
	});

	it("falls back to a fetch of main when the fetch of the sha fails", async () => {
		const repo = makeRepo(USER_FILES);
		const { calls, exec } = recordingExec({
			gitAnswer: (args) =>
				args[0] === "fetch" && args.includes("--depth")
					? { exitCode: 128, stdout: "", stderr: "not our ref" }
					: null,
		});

		const result = await prepareMobileBuildWorkspace(exec, inputFor(repo));

		expect(result.kind).toBe("ready");
		expect(
			calls
				.filter((call) => call.args[0] === "fetch")
				.map((call) => call.args.at(-1)),
		).toEqual([repo.sha, "main"]);
	});

	it("fails with clone_failed and a masked message when git echoes the credential", async () => {
		const { exec, pnpmCalls } = recordingExec({
			gitAnswer: (args) =>
				args[0] === "fetch"
					? {
							exitCode: 128,
							stdout: "",
							stderr: `fatal: unable to access 'https://t:${JWT}@org.code.storage/wandit/p-1.git/': 401`,
						}
					: null,
		});

		const result = await prepareMobileBuildWorkspace(
			exec,
			inputFor(makeRepo(USER_FILES)),
		);

		expect(result).toEqual({
			kind: "failed",
			errorCode: "clone_failed",
			errorMessage:
				"git fetch main failed (128): fatal: unable to access 'https://t:***@org.code.storage/wandit/p-1.git/': 401",
		});
		expect(JSON.stringify(result)).not.toContain(JWT);
		expect(pnpmCalls()).toEqual([]);
	});

	it("refuses a commit value that is not a full sha before any git call", async () => {
		const { exec, calls } = recordingExec({});
		const repo = makeRepo(USER_FILES);

		const result = await prepareMobileBuildWorkspace(exec, {
			...inputFor(repo),
			commitSha: "--upload-pack=touch /tmp/x",
		});

		expect(result).toEqual({
			kind: "failed",
			errorCode: "clone_failed",
			errorMessage: "The build commit is not a full git sha.",
		});
		expect(calls).toEqual([]);
	});

	it("fails with clone_failed when HEAD is not the commit", async () => {
		const other = "f".repeat(40);
		const { exec } = recordingExec({
			gitAnswer: (args) =>
				args[0] === "rev-parse"
					? { exitCode: 0, stdout: `${other}\n`, stderr: "" }
					: null,
		});
		const repo = makeRepo(USER_FILES);

		const result = await prepareMobileBuildWorkspace(exec, inputFor(repo));

		expect(result).toEqual({
			kind: "failed",
			errorCode: "clone_failed",
			errorMessage: `git checked out ${other} instead of ${repo.sha}`,
		});
	});

	it("throws and never links node_modules when the install shows metro-config at its top", async () => {
		const input = inputFor(makeRepo(USER_FILES));
		const { exec } = recordingExec({ topLevelPackages: ["metro-config"] });

		await expect(prepareMobileBuildWorkspace(exec, input)).rejects.toThrow(
			"The trusted install has metro-config at the top of node_modules",
		);
		expect(existsSync(join(input.rootDir, "app", "node_modules"))).toBe(false);
	});

	it("fails with install_failed and the end of the pnpm output", async () => {
		const { exec } = recordingExec({
			pnpmAnswer: {
				exitCode: 1,
				stdout: "Progress: resolved 10",
				stderr:
					"ERR_PNPM_OUTDATED_LOCKFILE Cannot install with a frozen lockfile",
			},
		});

		const result = await prepareMobileBuildWorkspace(
			exec,
			inputFor(makeRepo(USER_FILES)),
		);

		expect(result).toEqual({
			kind: "failed",
			errorCode: "install_failed",
			errorMessage:
				"pnpm install exited with 1: Progress: resolved 10\nERR_PNPM_OUTDATED_LOCKFILE Cannot install with a frozen lockfile",
		});
	});
});
