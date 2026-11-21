/**
 * Opens the /billing page of the web app in the system browser. Native has no purchase flow.
 * The credits banner and the page build card call it.
 */
import * as WebBrowser from "expo-web-browser";

import { getWebAppUrl } from "@/shared/lib/server-url";

/**
 * Mobile has no purchase flow — billing lives on the web app, so every
 * upgrade/top-up CTA funnels here (one place to change the destination).
 * Route: apps/web/src/routes/_auth/billing.tsx (/billing; the auth guard
 * bounces a signed-out browser session to sign-in with next=/billing).
 */
export function openBillingInBrowser() {
	void WebBrowser.openBrowserAsync(`${getWebAppUrl()}/billing`).catch(
		() => undefined,
	);
}

/** Opens /billing?starterPass=1. The web billing page then opens the Starter pass dialog at once. */
export function openStarterPassInBrowser() {
	// A failed open leaves the banner on screen, so the user can tap again. The log keeps the cause.
	void WebBrowser.openBrowserAsync(
		`${getWebAppUrl()}/billing?starterPass=1`,
	).catch((error: unknown) => {
		console.warn("[credits] The Starter pass page did not open.", error);
	});
}
