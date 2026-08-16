import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { wanditSentryVitePlugin } from "@wandit/observability/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
	server: {
		port: Number(loadEnv(mode, import.meta.dirname, "").PORT ?? 3002),
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
		wanditSentryVitePlugin({ project: "wandit-admin" }),
	],
}));
