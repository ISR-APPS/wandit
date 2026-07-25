import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { applyThemeConfig, readThemeConfig } from "@/lib/themes";

import { routeTree } from "./routeTree.gen";

applyThemeConfig(readThemeConfig());

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	context: {},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
	ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
}
