// Vite build configuration for the generated web app.
// The dev server and the Cloudflare worker build read this file.
// WANDIT_PREVIEW_HOST opens the sandbox dev server to the preview iframe.
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The sandbox sets this variable to the public preview hostname.
const previewHost = process.env.WANDIT_PREVIEW_HOST;

export default defineConfig({
	resolve: {
		// Vite reads the ~/* alias from tsconfig.json paths.
		tsconfigPaths: true,
	},
	server: {
		// The preview tunnel needs an explicit host allowlist.
		allowedHosts: previewHost ? [previewHost] : [],
		// clientPort and wss point the HMR client at the HTTPS tunnel on 443.
		// `port` would bind a second WebSocket server that the sandbox rejects.
		ws: previewHost
			? { host: previewHost, clientPort: 443, protocol: "wss" }
			: undefined,
	},
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart({
			// Public pages are prerendered at build time. Auth pages stay dynamic.
			prerender: { enabled: true },
		}),
		viteReact(),
		tailwindcss(),
	],
});
