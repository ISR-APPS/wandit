/**
 * Vite config of the web app: the dev port from apps/web/.env, Tailwind,
 * the router code split, the V2 builder build switch, and the Sentry source
 * map upload.
 */

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { wanditSentryVitePlugin } from "@wandit/observability/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
	define: {
		// Product rule: the V2 app builder is open on staging only. Vercel sets
		// VERCEL_ENV at build time: "production" for wandit.dev, "preview" for
		// staging and PR previews. Local builds have no value and keep V2.
		// When false, the bundler drops the V2 code from the bundle.
		// turbo.json lists VERCEL_ENV in tasks.build.env. Without that entry,
		// turbo removes the value and its cache mixes the two builds.
		__V2_BUILDER_IN_BUILD__: JSON.stringify(
			process.env.VERCEL_ENV !== "production",
		),
	},
	server: {
		// Overridable per checkout via PORT in apps/web/.env (untracked), so
		// worktrees can run beside the main checkout without --port flags.
		port: Number(loadEnv(mode, import.meta.dirname, "").PORT ?? 3001),
		// The native FS watcher delivers no events for checkouts nested under a
		// dot-directory (worktrees live in .claude/worktrees/), which silently
		// kills HMR there — fall back to stat polling for those checkouts only.
		watch: import.meta.dirname.includes("/.claude/")
			? { usePolling: true, interval: 300 }
			: undefined,
	},
	build: {
		// Maps exist only when the Sentry plugin below will upload-and-delete
		// them; without a token they'd be left sitting in dist/ (source
		// disclosure on any static host) — so don't emit them at all.
		sourcemap: process.env.SENTRY_AUTH_TOKEN ? "hidden" : false,
	},
	resolve: {
		tsconfigPaths: true,
		// Workspace packages declare react as a peer (autoInstallPeers is off so
		// native keeps its own react) — resolve their bare react imports to ours.
		dedupe: ["react", "react-dom"],
	},
	plugins: [
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		// Last, per Sentry docs. Disabled unless SENTRY_AUTH_TOKEN is set.
		wanditSentryVitePlugin({ project: "wandit-web" }),
	],
}));
