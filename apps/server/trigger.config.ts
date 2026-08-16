import { sentryEsbuildPlugin } from "@sentry/esbuild-plugin";
import type { BuildExtension } from "@trigger.dev/build";
import { esbuildPlugin } from "@trigger.dev/build/extensions";
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
		// stay single-attempt, while image animation exercises its crash-recovery
		// retries in local Trigger.dev runs as well as production.
		enabledInDev: true,
		default: { maxAttempts: 1 },
	},
	// Playwright must resolve from node_modules at runtime (it locates its
	// browser binaries relative to its own package) — never bundle it.
	build: {
		extensions: [
			playwrightChromium(),
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
		external: ["playwright", "sharp"],
	},
});
