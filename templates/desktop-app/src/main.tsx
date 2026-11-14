/**
 * Entry of the app. index.html loads it, and `vite build` bundles it into dist/ for the native shell (Tauri or Electron).
 * It installs the dev preview bridge, then renders the providers and the router of src/router.tsx.
 */
import "./styles/tokens.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAppRouter } from "./router";
import { I18nProvider } from "./shared/i18n";
import { installPreviewBridge } from "./wandit/preview-bridge";

// Dev-only bridge to the wandit preview frame. It installs before the first render,
// so an error of the first render reaches the host.
if (import.meta.env.DEV) {
	installPreviewBridge();
}

// After the bridge: the router history keeps the pushState that the bridge wraps.
const router = createAppRouter();

const queryClient = new QueryClient({
	defaultOptions: {
		// The database is local. A failed query fails again at once, so a retry only delays the error state.
		queries: { retry: false },
		mutations: { retry: false },
	},
});

const rootElement = document.getElementById("root");
if (rootElement === null) {
	throw new Error("index.html has no #root element.");
}

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<I18nProvider>
				<RouterProvider router={router} />
			</I18nProvider>
		</QueryClientProvider>
	</StrictMode>,
);
