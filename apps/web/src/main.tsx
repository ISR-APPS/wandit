import { createRouter, RouterProvider } from "@tanstack/react-router";
import { defaultLocale, getDictionary } from "@wandit/internationalization";
import ReactDOM from "react-dom/client";

import Loader from "./components/loader";
import {
	getCurrentLocale,
	setCurrentDictionary,
} from "./lib/i18n/locale-store";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultPendingComponent: () => <Loader />,
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

const initialLocale = getCurrentLocale();

if (initialLocale !== defaultLocale) {
	try {
		setCurrentDictionary(await getDictionary(initialLocale));
	} catch (error) {
		console.error("Failed to preload locale dictionary", error);
	}
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
