/**
 * Trigger.dev config of the server worker. `trigger.dev dev` and
 * `trigger.dev deploy` (trigger-deploy.yml) read it. It sets the retries,
 * installs Chromium, git, eas-cli, and pnpm, and uploads Sentry source maps.
 * It also copies the template archives, the base schema, and the trusted
 * mobile template files of the `mobile-build` task into the worker image.
 */
import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import type { BuildExtension } from "@trigger.dev/build";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
import { additionalFiles, aptGet } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

/**
 * Installs Chromium into the DEPLOYED worker image (local dev uses the
 * machine's own browser cache). Hand-rolled because the official
 * `@trigger.dev/build` playwright() extension parses `playwright install
 * --dry-run` output in a format Playwright dropped before 1.61 — its image
 * build fails on "browser: chromium-headless-shell" grep. Playwright's own
 * `install --with-deps` is format-proof and pulls the system libraries too.
 * Keep the version below in lockstep with the `playwright` dependency.
 */
function playwrightChromium(): BuildExtension {
	return {
		name: "playwright-chromium",
		onBuildComplete(context) {
			if (context.target === "dev") return;

			context.addLayer({
				id: "playwright-chromium",
				image: {
					instructions: [
						"ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright",
						"RUN mkdir -p /ms-playwright && npx -y playwright@1.61.1 install --with-deps chromium && chmod -R a+rX /ms-playwright",
					],
				},
				deploy: {
					env: {
						PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
					},
					override: true,
				},
			});
		},
	};
}

/**
 * Installs the pinned `eas` and `pnpm` CLIs of the `mobile-build` task into
 * the DEPLOYED worker image. `npm install -g` puts both on PATH for the
 * `node` user. Local dev uses the CLIs on the machine PATH. The eas-cli
 * version must satisfy `cli.version` in templates/mobile-app/eas.json.
 */
function mobileBuildTools(): BuildExtension {
	return {
		name: "mobile-build-tools",
		onBuildComplete(context) {
			if (context.target === "dev") return;

			context.addLayer({
				id: "mobile-build-tools",
				image: {
					instructions: ["RUN npm install -g eas-cli@24.8.0 pnpm@11.7.0"],
				},
			});
		},
	};
}

// Trigger.dev project config. The dev CLI (`npx trigger.dev@latest dev`) runs
// from apps/server/, picks this file up, and bundles every task in ./src/trigger.
export default defineConfig({
	project: "proj_stzpldofqndpuwhwrdlw",
	dirs: ["./src/trigger"],
	// node-22, not the default "node" (21): undici 8 (undici-timeouts.ts)
	// calls webidl.util.markAsUncloneable, which Node 21 never got — the
	// deploy indexer crashes on import with the default runtime.
	runtime: "node-22",
	// Generous ceiling: the builder agent does a single deliberate build pass
	// (typically a few minutes), but long model calls need headroom.
	// Compute-seconds: 1800 = 30 minutes — a safety net, not an estimate.
	maxDuration: 1800,
	// One attempt only: a failed build is marked failed in our own attempts
	// table and surfaced to the user — silent model re-runs would just burn
	// tokens on the same brief.
	retries: {
		// Task-level policies remain authoritative. Page + lead tasks explicitly
		// stay single-attempt in local Trigger.dev runs as well as production.
		enabledInDev: true,
		default: { maxAttempts: 1 },
	},
	// Playwright must resolve from node_modules at runtime (it locates its
	// browser binaries relative to its own package) — never bundle it.
	build: {
		extensions: [
			playwrightChromium(),
			// The `mobile-build` task clones with git. The CLI image already
			// installs git today; this layer keeps it if that default changes.
			aptGet({ packages: ["git"] }),
			mobileBuildTools(),
			// The deployed worker has no repo checkout. This copies every packed
			// template archive (web-app, mobile-app) and the base schema next to
			// the bundle. The leading "../.." is dropped, so all land under
			// `<build>/templates/`, the first folder `resolveTemplateArchiveDir`
			// tries. The deploy workflow runs `templates/pack-all.mjs` first; the
			// archives are not in git. The base schema serves both templates.
			// The six mobile-app files are the trusted install and eas.json of
			// the `mobile-build` task; it never uses the user copies.
			additionalFiles({
				files: [
					"../../templates/*-*.tar.gz",
					"../../templates/web-app/supabase/migrations/*.sql",
					"../../templates/mobile-app/package.json",
					"../../templates/mobile-app/pnpm-lock.yaml",
					"../../templates/mobile-app/pnpm-workspace.yaml",
					"../../templates/mobile-app/.npmrc",
					"../../templates/mobile-app/eas.json",
					"../../templates/mobile-app/native-modules.json",
				],
			}),
			// Uploads source maps to Sentry on `trigger.dev deploy` so task
			// stack traces map to TS sources. No-op without SENTRY_AUTH_TOKEN
			// (set it in the Trigger.dev dashboard env vars, not just Railway).
			esbuildPlugin(
				sentryEsbuildPlugin({
					org: process.env.SENTRY_ORG,
					project: "wandit-server",
					authToken: process.env.SENTRY_AUTH_TOKEN,
					disable: !process.env.SENTRY_AUTH_TOKEN,
				}),
				{ placement: "last", target: "deploy" },
			),
		],
		// sharp stays external too: 0.35 moved its entry to dist/index.cjs and
		// the bundler's copied-node_modules resolution can't find it; externals
		// are installed from package.json in dev and deploy instead.
		// @ai-sdk/harness-claude-code reads its sandbox bridge files with
		// `new URL("./bridge/<name>", import.meta.url)` (dist/index.js line 40).
		// Inside the bundle that URL names the bundle file, which has no
		// `bridge/` folder, so the first `createSession` fails. External keeps
		// the package in node_modules, where the folder exists.
		external: ["playwright", "sharp", "@ai-sdk/harness-claude-code"],
	},
});
