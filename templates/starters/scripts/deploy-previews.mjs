// Deploys the live preview of starters to Cloudflare: one Worker per starter on <id>-template.wandit.app.
// Run: node templates/starters/scripts/deploy-previews.mjs <workRoot> (--all | <id>...) [--dry-run]
// For each starter: materialize.mjs, a build with the demo backend URL, then `wrangler deploy`.
// It deploys one starter at a time: two builds at once both take the Cloudflare debug port 9230 and one fails.
// The Worker entry is preview-worker.mjs. The web app links to the host (templates feature helpers).
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
	assertStarterId,
	listStarterIds,
	runPnpm,
	runScript,
} from "./starter-source.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
/** The Cloudflare account of apps/edge/wrangler.jsonc. The wandit.app zone is in it. */
const CLOUDFLARE_ACCOUNT_ID = "6b421048e434497bce142970530e4eb1";
const PREVIEW_ZONE = "wandit.app";
/** Copy of STARTER_TEMPLATE_PREVIEW_SLUG_SUFFIX (packages/contracts/src/v1/deployments.ts). A site can never take such a slug. */
const PREVIEW_SLUG_SUFFIX = "-template";
// The demo backend accepts any key. The value only names its source.
const ANON_KEY = "template-preview";
// wrangler adds these keys for a config that it redirects. A deploy config must not hold them.
const REDIRECT_KEYS = [
	"configPath",
	"userConfigPath",
	"topLevelName",
	"definedEnvironments",
];

const USAGE =
	"usage: deploy-previews.mjs <workRoot> (--all | <id>...) [--dry-run]";

/** The public host of one preview, for example dealflow-crm-template.wandit.app. */
function previewHost(id) {
	return `${id}${PREVIEW_SLUG_SUFFIX}.${PREVIEW_ZONE}`;
}

/** Runs one command with the output on screen. Throws with `step` when it fails. */
function mustSucceed(result, step) {
	if (result.error) {
		throw new Error(`${step} did not start: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`${step} failed with exit code ${result.status}`);
	}
}

/** Builds one starter in `workDir` and deploys it. With `dryRun`, wrangler checks the upload and sends nothing. */
function deployPreview(id, workDir, dryRun) {
	const host = previewHost(id);
	console.log(`\n== ${id} -> https://${host}`);
	// materialize.mjs needs an empty folder. The folder of this starter holds only the build of an earlier deploy.
	rmSync(workDir, { recursive: true, force: true });
	mustSucceed(
		spawnSync(
			process.execPath,
			[join(SCRIPTS_DIR, "materialize.mjs"), id, workDir],
			{ stdio: "inherit" },
		),
		`materialize ${id}`,
	);
	// The app calls Supabase on its own host. preview-worker.mjs answers those paths.
	writeFileSync(
		join(workDir, ".env"),
		`VITE_SUPABASE_URL=https://${host}\nVITE_SUPABASE_ANON_KEY=${ANON_KEY}\n`,
	);
	mustSucceed(runPnpm(["run", "build"], workDir, "inherit"), `build ${id}`);

	const serverDir = join(workDir, "dist", "server");
	// The Worker entry imports the demo answers and the built app (index.js) from its own folder.
	for (const file of ["preview-worker.mjs", "demo-backend.mjs"]) {
		copyFileSync(join(SCRIPTS_DIR, file), join(serverDir, file));
	}
	// The static files skip the Worker, so this file gives them the noindex header.
	writeFileSync(
		join(workDir, "dist", "client", "_headers"),
		"/*\n  X-Robots-Tag: noindex, nofollow\n",
	);
	const config = JSON.parse(
		readFileSync(join(serverDir, "wrangler.json"), "utf8"),
	);
	for (const key of REDIRECT_KEYS) {
		delete config[key];
	}
	const deployConfig = {
		...config,
		name: `wandit-template-${id}`,
		account_id: CLOUDFLARE_ACCOUNT_ID,
		main: "preview-worker.mjs",
		// The preview has one public address. No workers.dev copy.
		workers_dev: false,
		preview_urls: false,
		// More specific than the "*/*" route of the edge Worker, so this route wins for this host.
		routes: [{ pattern: `${host}/*`, zone_name: PREVIEW_ZONE }],
	};
	const configPath = join(serverDir, "preview-wrangler.json");
	writeFileSync(configPath, JSON.stringify(deployConfig, null, "\t"));
	mustSucceed(
		runPnpm(
			[
				"exec",
				"wrangler",
				"deploy",
				"--config",
				configPath,
				...(dryRun ? ["--dry-run"] : []),
			],
			workDir,
			"inherit",
		),
		`deploy ${id}`,
	);
}

await runScript(async () => {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		options: {
			all: { type: "boolean", default: false },
			"dry-run": { type: "boolean", default: false },
		},
	});
	const [workRoot, ...ids] = positionals;
	if (
		workRoot === undefined ||
		!isAbsolute(workRoot) ||
		// Exactly one of --all and a list of ids.
		values.all === ids.length > 0
	) {
		throw new Error(USAGE);
	}
	const starterIds = values.all ? listStarterIds() : ids;
	for (const id of starterIds) {
		assertStarterId(id);
	}
	const failed = [];
	for (const id of starterIds) {
		try {
			deployPreview(id, resolve(workRoot, id), values["dry-run"]);
		} catch (error) {
			// One broken starter must not stop the others. The summary names it, and the exit code is 1.
			console.error(
				`error: ${id}: ${error instanceof Error ? error.message : error}`,
			);
			failed.push(id);
		}
	}
	console.log(
		`\n${starterIds.length - failed.length} of ${starterIds.length} preview(s) ${values["dry-run"] ? "checked (dry run)" : "deployed"}`,
	);
	if (failed.length > 0) {
		throw new Error(`failed: ${failed.join(", ")}`);
	}
});
