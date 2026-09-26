// Builds the module allow-list for the store Expo Go app from the pinned expo package.
// Run `pnpm run allow-list` after an SDK bump; the smoke runs it with --check.
// It writes native-modules.json and the list block between the markers in CLAUDE.md.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const START_MARKER = "<!-- allow-list:start -->";
const END_MARKER = "<!-- allow-list:end -->";
// Markdown lines of the generated name list are no wider than this.
const LINE_WIDTH = 100;

// Packages of bundledNativeModules.json that the store Expo Go cannot run.
// Sources (2026-09-25): the Expo Go 57.0.9 store binaries, the expo/expo sdk-57
// branch (apps/expo-go Podfile and settings.gradle), and the v57 docs.
// LIMIT: Expo Go does not publish a machine-readable module list. EXCLUDED,
// LIMITED, and NO_WEB are manual. Upgrade: re-check all three on each SDK bump.
const EXCLUDED = {
	"@expo/fingerprint": "a Node build tool, not an app module",
	"@react-native-community/viewpager":
		"deprecated and not in Expo Go; use react-native-pager-view",
	"eslint-config-expo": "a lint config, not an app module",
	"expo-analytics-amplitude": "a removed legacy module, not in Expo Go",
	"expo-app-auth": "deprecated and removed, not in Expo Go",
	"expo-app-loader-provider": "a legacy internal package, not in Expo Go",
	"expo-app-metrics": "Expo Go leaves it out of its build",
	// expo/expo#49415: the iOS store build 57.0.9 lacks expo-apple-authentication,
	// expo-live-photo, and expo-mesh-gradient. Re-check on a new 57.x.
	"expo-apple-authentication": "the iOS store Expo Go 57.0.9 lacks it",
	"expo-background-fetch":
		"deprecated and off in iOS Expo Go; use expo-background-task",
	"expo-brownfield": "a toolkit for existing native apps, not in Expo Go",
	"expo-build-properties": "a build-time config plugin with no app module",
	"expo-dev-client": "a build tool for development builds, not in Expo Go",
	"expo-eas-client": "an internal package of expo-updates",
	"expo-google-app-auth": "deprecated and removed, not in Expo Go",
	"expo-image-loader": "an internal package of other Expo modules",
	"expo-insights": "Expo Go leaves it out of its build",
	"expo-live-photo": "the iOS store Expo Go 57.0.9 lacks it",
	"expo-manifests": "an internal package of expo-updates",
	"expo-maps": "needs a development build, not in Expo Go",
	"expo-mcp": "a Node tool for the editor, not an app module",
	"expo-mesh-gradient": "the store Expo Go 57.0.9 lacks it on iOS and Android",
	"expo-module-template": "a template to write native modules",
	"expo-modules-core": "an internal package; apps import from expo",
	"expo-observe": "not in Expo Go",
	"expo-server": "the server runtime of API routes, not an app module",
	"expo-updates": "most of its API fails in Expo Go",
	"expo-widgets": "needs a development build, not in Expo Go",
	"jest-expo": "a test preset, not an app module",
	"react-native-bootsplash": "a native library that Expo Go does not hold",
	"react-server-dom-webpack": "React Server Components bindings for frameworks",
	"sentry-expo": "deprecated; use @sentry/react-native",
	"unimodules-app-loader": "an internal package of expo-task-manager",
	"unimodules-image-loader-interface":
		"a legacy internal package, not in Expo Go",
};

// Allowed modules that Expo Go runs with a limit the agent must know.
const LIMITED = {
	// Expo Go 57.0.9 holds the native part of @expo/ui 57.0.11; SDK 57 pins 57.0.20.
	"@expo/ui":
		"no component newer than 57.0.11 (no NavigationStack, Toolbar, or NavigationSplitView)",
	"@sentry/react-native":
		"JavaScript errors only; the native crash reporter is not in Expo Go",
	"@stripe/stripe-react-native": "no Apple Pay and no Google Pay",
	// The OAuth redirect cannot reach Expo Go (the prompt and CLAUDE.md: no OAuth).
	"expo-auth-session":
		"no OAuth sign-in in Expo Go; use Supabase email sign-in",
	"expo-calendar": "only the `expo-calendar/legacy` API works",
	"expo-local-authentication": "no Face ID on iOS",
	"expo-location": "foreground location only",
	"expo-notifications": "local notifications only; no remote push",
	"expo-splash-screen": "Expo Go shows the app icon, not the configured splash",
	"react-native-maps": "Apple Maps only on iOS; Google Maps on Android",
};

// Allowed modules with no web version (v57 docs). A screen that uses one
// needs a `Platform.OS === "web"` fallback for the browser preview.
const NO_WEB = [
	"@expo/ui",
	"@react-native-community/datetimepicker",
	"@react-native-masked-view/masked-view",
	"@stripe/stripe-react-native",
	"expo-background-task",
	"expo-brightness",
	"expo-calendar",
	"expo-contacts",
	"expo-file-system",
	"expo-glass-effect",
	"expo-intent-launcher",
	"expo-local-authentication",
	"expo-media-library",
	"expo-navigation-bar",
	"expo-notifications",
	"expo-screen-capture",
	"expo-secure-store",
	"expo-sms",
	"expo-splash-screen",
	"expo-store-review",
	"expo-task-manager",
	"expo-tracking-transparency",
	"expo-video-thumbnails",
	"react-native-keyboard-controller",
	"react-native-maps",
	"react-native-pager-view",
	"react-native-view-shot",
	"react-native-webview",
];

// Packages with JavaScript code only. They run in Expo Go, but
// bundledNativeModules.json does not list them.
const JS_ONLY = {
	"@supabase/supabase-js": "the Supabase client (D18)",
	"heroui-native": "the UI kit (D6)",
	"tailwind-merge": "a peer of heroui-native",
	"tailwind-variants": "a peer of heroui-native",
	tailwindcss: "the class engine of Uniwind",
	uniwind: "Tailwind classes for React Native (D6)",
	zod: "row and input checks",
};

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** Joins the names into Markdown lines no wider than LINE_WIDTH. */
function wrapNames(names) {
	const lines = [];
	let line = "";
	for (const name of names) {
		const item = `\`${name}\``;
		// 3 characters: the ", " separator and the "," that closes a full line.
		if (line !== "" && line.length + item.length + 3 > LINE_WIDTH) {
			lines.push(`${line},`);
			line = item;
		} else {
			line = line === "" ? item : `${line}, ${item}`;
		}
	}
	lines.push(line);
	return lines;
}

const expo = join(root, "node_modules", "expo");
const expoVersion = readJson(join(expo, "package.json")).version;
const bundled = readJson(join(expo, "bundledNativeModules.json"));

// A stale entry means the SDK changed under the list; the list needs a review.
const unknownExcludes = Object.keys(EXCLUDED).filter(
	(name) => !(name in bundled),
);
if (unknownExcludes.length > 0) {
	throw new Error(
		`EXCLUDED names packages that expo ${expoVersion} does not bundle: ${unknownExcludes.join(", ")}`,
	);
}
const bundledJsOnly = Object.keys(JS_ONLY).filter((name) => name in bundled);
if (bundledJsOnly.length > 0) {
	throw new Error(
		`JS_ONLY names packages that expo ${expoVersion} bundles: ${bundledJsOnly.join(", ")}`,
	);
}

// The expo package is the SDK itself; its own module list does not name it.
const nativeVersions = { ...bundled, expo: expoVersion };
const nativeNames = Object.keys(nativeVersions)
	.filter((name) => !(name in EXCLUDED))
	.sort();
const allowed = new Set([...nativeNames, ...Object.keys(JS_ONLY)]);

// A note on a module that left the list would tell the agent to use it.
const strayNotes = [...Object.keys(LIMITED), ...NO_WEB].filter(
	(name) => !nativeNames.includes(name),
);
if (strayNotes.length > 0) {
	throw new Error(
		`LIMITED or NO_WEB names modules outside the allow-list: ${strayNotes.join(", ")}`,
	);
}

// The template itself must follow the rule it gives the agent.
const dependencies = Object.keys(
	readJson(join(root, "package.json")).dependencies,
);
const offList = dependencies.filter((name) => !allowed.has(name));
if (offList.length > 0) {
	throw new Error(
		`package.json dependencies outside the allow-list: ${offList.join(", ")}`,
	);
}

const moduleList = {
	expo: expoVersion,
	native: Object.fromEntries(
		nativeNames.map((name) => [name, nativeVersions[name]]),
	),
	jsOnly: JS_ONLY,
	limited: LIMITED,
	noWeb: NO_WEB,
	excluded: EXCLUDED,
};
const json = `${JSON.stringify(moduleList, null, "\t")}\n`;

const block = [
	START_MARKER,
	`Generated by \`scripts/allow-list.mjs\` from expo ${expoVersion}. Do not edit by hand.`,
	"",
	`Native modules that run in Expo Go (${nativeNames.length}):`,
	...wrapNames(nativeNames),
	"",
	"JavaScript-only packages of this template:",
	...wrapNames(Object.keys(JS_ONLY).sort()),
	"",
	"Allowed with a limit in Expo Go:",
	...Object.entries(LIMITED).map(([name, limit]) => `- \`${name}\`: ${limit}.`),
	"",
	"No web version. A screen that uses one needs a web fallback:",
	...wrapNames(NO_WEB),
	"",
	"Not in Expo Go. Never install these:",
	...Object.entries(EXCLUDED).map(
		([name, reason]) => `- \`${name}\`: ${reason}.`,
	),
	END_MARKER,
].join("\n");

const claudePath = join(root, "CLAUDE.md");
const claude = readFileSync(claudePath, "utf8");
const start = claude.indexOf(START_MARKER);
const end = claude.indexOf(END_MARKER);
// A second marker would make the replace drop the text between two blocks.
const markersOnce =
	claude.indexOf(START_MARKER, start + 1) === -1 &&
	claude.indexOf(END_MARKER, end + 1) === -1;
if (start === -1 || end < start || !markersOnce) {
	throw new Error(
		`CLAUDE.md must hold ${START_MARKER} once and then ${END_MARKER} once`,
	);
}
const nextClaude =
	claude.slice(0, start) + block + claude.slice(end + END_MARKER.length);

const jsonPath = join(root, "native-modules.json");
if (checkOnly) {
	const stale = [];
	if (!existsSync(jsonPath) || readFileSync(jsonPath, "utf8") !== json) {
		stale.push("native-modules.json");
	}
	if (claude !== nextClaude) {
		stale.push("CLAUDE.md");
	}
	if (stale.length > 0) {
		throw new Error(
			`${stale.join(" and ")} out of date. Run pnpm run allow-list.`,
		);
	}
	console.log(
		`allow-list ok: ${allowed.size} packages for expo ${expoVersion}`,
	);
} else {
	writeFileSync(jsonPath, json);
	writeFileSync(claudePath, nextClaude);
	console.log(
		`wrote native-modules.json and CLAUDE.md: ${allowed.size} packages`,
	);
}
