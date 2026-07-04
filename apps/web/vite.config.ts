import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 3001,
	},
	resolve: {
		tsconfigPaths: true,
		// Workspace packages declare react as a peer (autoInstallPeers is off so
		// native keeps its own react) — resolve their bare react imports to ours.
		dedupe: ["react", "react-dom"],
		alias: {
			// lottie-react's `browser` field points at its UMD build, which breaks
			// Vite's ESM default-import interop — pin the ES build instead.
			"lottie-react": "lottie-react/build/index.es.js",
		},
	},
	plugins: [
		tailwindcss(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
