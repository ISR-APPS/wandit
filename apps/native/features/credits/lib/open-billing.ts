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
