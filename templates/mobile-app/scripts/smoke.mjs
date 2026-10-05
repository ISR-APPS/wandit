// Smoke test for the mobile template. Run it before a new pack ships.
// It installs frozen deps, typechecks, lints, checks the allow-list, and compares
// the base SQL copy.
// Then it starts Metro and checks the web page, the iOS manifest, and the iOS
// bundle, stops Metro, exports the web build, and measures node_modules.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = ["-y", "pnpm@11.7.0"];

// The dev contract with the server: one Metro on port 8081 serves web and native.
const metroUrl = "http://127.0.0.1:8081";
// 3 min: a cold Metro start on a slow CI runner, seen at about 11 s locally.
const METRO_START_TIMEOUT_MS = 180_000;
// 10 min: the first iOS bundle compiles all 2500+ modules, about 40 s locally.
const BUNDLE_TIMEOUT_MS = 600_000;
// Metro gets this long to exit on SIGTERM before the smoke sends SIGKILL.
const METRO_STOP_TIMEOUT_MS = 10_000;
// One GET / or manifest request. Both answer in well under a second locally;
// the timeout only stops a hung request from blocking the smoke.
const POLL_TIMEOUT_MS = 30_000;

function run(cmd, args) {
	console.log(`$ ${cmd} ${args.join(" ")}`);
	execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
}

function dirSizeBytes(dir) {
	let total = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		total += entry.isDirectory() ? dirSizeBytes(path) : statSync(path).size;
	}
	return total;
}

/** The SDK major from template_version line 3, for example 57 from `expo-sdk@57`. */
function pinnedSdkMajor() {
	const sdkLine = readFileSync(join(root, "template_version"), "utf8")
		.split("\n")[2]
		?.trim();
	const major = sdkLine?.match(/^expo-sdk@(\d+)$/)?.[1];
	if (!major) {
		throw new Error("template_version line 3 must be expo-sdk@<major>");
	}
	return major;
}

/** True when the process ended, by an exit code or by a signal. */
function hasExited(child) {
	return child.exitCode !== null || child.signalCode !== null;
}

/** Sends a signal to the whole Metro process group: npx, pnpm, and the Expo CLI. */
function killGroup(metro, signal) {
	try {
		// A negative pid names the process group.
		process.kill(-metro.pid, signal);
	} catch (error) {
		// ESRCH: no process of the group is left. EPERM: macOS answers it when the
		// group holds only exiting processes. The group is our own child in both cases.
		if (error?.code !== "ESRCH" && error?.code !== "EPERM") {
			throw error;
		}
	}
}

/** Waits until GET / answers 200 with HTML. Fails at once when Metro exits. */
async function waitForWebPage(metro) {
	const deadline = Date.now() + METRO_START_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (hasExited(metro)) {
			throw new Error(
				`Metro stopped (${metro.exitCode ?? metro.signalCode}) before it answered`,
			);
		}
		try {
			const response = await fetch(`${metroUrl}/`, {
				headers: { accept: "text/html" },
				signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
			});
			const body = await response.text();
			if (response.status === 200 && body.includes('<div id="root">')) {
				return;
			}
			console.log(`GET / answered ${response.status}; waiting`);
		} catch (error) {
			// Connection refused means Metro is not listening yet; log anything else.
			if (error?.cause?.code !== "ECONNREFUSED") {
				console.log(`GET / failed: ${error?.message}; waiting`);
			}
		}
		await sleep(1000);
	}
	throw new Error(`GET ${metroUrl}/ did not answer 200 with the web HTML`);
}

/** Reads the Expo Go manifest and checks that it names the pinned SDK. */
async function fetchIosManifest() {
	const response = await fetch(`${metroUrl}/`, {
		headers: {
			"expo-platform": "ios",
			accept: "application/expo+json,application/json",
		},
		signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
	});
	if (response.status !== 200) {
		throw new Error(`the ios manifest answered ${response.status}`);
	}
	const manifest = await response.json();
	const expected = `exposdk:${pinnedSdkMajor()}.0.0`;
	if (manifest?.runtimeVersion !== expected) {
		throw new Error(
			`the ios manifest has runtimeVersion ${manifest?.runtimeVersion}, not ${expected}`,
		);
	}
	const bundleUrl = manifest.launchAsset?.url;
	if (typeof bundleUrl !== "string" || !bundleUrl.includes("platform=ios")) {
		throw new Error("the ios manifest has no ios launchAsset.url");
	}
	return bundleUrl;
}

/** Compiles the iOS bundle. This is the runtime check for HeroUI and Uniwind. */
async function fetchIosBundle(bundleUrl) {
	console.log(`GET ${bundleUrl}`);
	const response = await fetch(bundleUrl, {
		signal: AbortSignal.timeout(BUNDLE_TIMEOUT_MS),
	});
	const body = await response.text();
	// Metro answers a build error with status 500 and a JSON error body.
	if (
		response.status !== 200 ||
		!body.startsWith("var __BUNDLE_START_TIME__")
	) {
		throw new Error(
			`the ios bundle failed with ${response.status}: ${body.slice(0, 2000)}`,
		);
	}
	return body.length;
}

/** Stops the Metro process group: SIGTERM, then SIGKILL after the timeout. */
async function stopMetro(metro) {
	const exited = hasExited(metro)
		? Promise.resolve(true)
		: new Promise((resolveExit) => metro.once("exit", () => resolveExit(true)));
	killGroup(metro, "SIGTERM");
	const stopped = await Promise.race([
		exited,
		sleep(METRO_STOP_TIMEOUT_MS).then(() => false),
	]);
	if (!stopped) {
		killGroup(metro, "SIGKILL");
		await exited;
	}
}

run("npx", [...pnpm, "install", "--frozen-lockfile"]);
run("npx", [...pnpm, "run", "typecheck"]);
run("npx", [...pnpm, "run", "lint"]);
// An SDK bump changes bundledNativeModules.json; the rules file must follow it.
run("node", [join(root, "scripts", "allow-list.mjs"), "--check"]);

// The server applies the web-app copy to every backend. The agent reads this
// copy, so both must stay byte-identical. The smoke runs from the repo checkout.
run("cmp", [
	join(root, "supabase", "migrations", "0000_base.sql"),
	join(root, "..", "web-app", "supabase", "migrations", "0000_base.sql"),
]);

// A server already on 8081 would answer the checks instead of this Metro.
const portTaken = await fetch(`${metroUrl}/`, {
	signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
}).then(
	() => true,
	() => false,
);
if (portTaken) {
	throw new Error(`${metroUrl} already answers. Stop that server first.`);
}

// Expo CLI rewrites these files on start when their content drifts from what it
// wants. In the sandbox that would dirty the git tree, so the smoke fails instead.
const watchedFiles = ["tsconfig.json", ".gitignore"];
const filesBefore = watchedFiles.map((file) => readFileSync(join(root, file)));

// CI=1 makes expo start non-interactive. The bundle URL must point to this
// Metro, so the two host overrides of Expo CLI are removed.
const metroEnv = { ...process.env, CI: "1" };
delete metroEnv.EXPO_PACKAGER_PROXY_URL;
delete metroEnv.REACT_NATIVE_PACKAGER_HOSTNAME;

console.log("$ CI=1 pnpm run dev");
const metro = spawn("npx", [...pnpm, "run", "dev"], {
	cwd: root,
	env: metroEnv,
	stdio: "inherit",
	// Its own process group, so the stop reaches Metro behind npx and pnpm.
	detached: true,
});
// The detached group does not get a Ctrl-C or a kill of the smoke, and Node
// then exits without the finally below. This handler stops the group first.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
	process.once(signal, () => {
		if (!hasExited(metro)) {
			killGroup(metro, "SIGKILL");
		}
		process.exit(1);
	});
}
let bundleBytes;
try {
	await waitForWebPage(metro);
	const bundleUrl = await fetchIosManifest();
	bundleBytes = await fetchIosBundle(bundleUrl);
} finally {
	await stopMetro(metro);
}

watchedFiles.forEach((file, index) => {
	if (!readFileSync(join(root, file)).equals(filesBefore[index])) {
		throw new Error(`expo start rewrote ${file}. Commit the new content.`);
	}
});

run("npx", [...pnpm, "run", "export:web"]);

const dist = join(root, "dist");
const indexHtml = join(dist, "index.html");
if (!existsSync(indexHtml)) {
	throw new Error(
		"dist/index.html missing: the web export wrote no HTML entry",
	);
}
const entryScript = readFileSync(indexHtml, "utf8").match(
	/<script src="\/(_expo\/static\/js\/web\/[^"]+\.js)"/,
)?.[1];
if (!entryScript || !existsSync(join(dist, entryScript))) {
	throw new Error("dist/index.html does not load an exported web entry script");
}

// The sandbox installs the full dev tree because Metro, typecheck, and lint
// all need it. The size check measures that same tree here.
// LIMIT: the dev tree is about 420 MB, and the sandbox image warms only the
// web-app store, so this install runs online. Upgrade: warm the mobile-app
// store in the sandbox image.
const nodeModulesSize = dirSizeBytes(join(root, "node_modules"));
const maxBytes = 500 * 1024 * 1024;
if (nodeModulesSize > maxBytes) {
	throw new Error(
		`node_modules is ${(nodeModulesSize / 1024 / 1024).toFixed(0)} MB, over the 500 MB ceiling`,
	);
}

console.log(
	`smoke ok: web page, ios manifest (SDK ${pinnedSdkMajor()}), ios bundle ` +
		`${(bundleBytes / 1024 / 1024).toFixed(1)} MB, ${entryScript}; ` +
		`node_modules ${(nodeModulesSize / 1024 / 1024).toFixed(0)} MB`,
);
