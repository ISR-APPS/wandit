// Vite configuration of the desktop app frontend.
// `pnpm run dev` serves the browser preview in the sandbox. `pnpm run build` writes the
// static files of dist/, which the native shell loads (templates/desktop-shell or templates/desktop-shell-electron).
// WANDIT_PREVIEW_HOST opens the sandbox dev server to the preview iframe.
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { wanditSource } from "./vite-plugins/wandit-source.ts";

// The sandbox sets this variable to the public preview hostname.
const previewHost = process.env.WANDIT_PREVIEW_HOST;

export default defineConfig({
	resolve: {
		// Vite reads the ~/* alias from tsconfig.json paths.
		tsconfigPaths: true,
	},
	server: {
		// The preview proxy sends the sandbox host as `Host`, so Vite must allow it.
		allowedHosts: previewHost ? [previewHost] : [],
		// clientPort and wss point the HMR client at the HTTPS proxy on 443.
		// No `host`: the client then uses the page host, so HMR goes through the
		// preview proxy. Vite writes `host` into /@vite/client for every viewer.
		// `port` would bind a second WebSocket server that the sandbox rejects.
		ws: previewHost ? { clientPort: 443, protocol: "wss" } : undefined,
	},
	plugins: [wanditSource(), viteReact(), tailwindcss()],
});
