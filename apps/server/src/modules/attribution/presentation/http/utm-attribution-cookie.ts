import { UTM_ATTRIBUTION_COOKIE_NAME } from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { UTM_ATTRIBUTION_WINDOW_SECONDS } from "../../domain/utm-attribution-token";

export function buildUtmAttributionCookie(token: string): string {
	const crossSiteCookies = env.BETTER_AUTH_URL.startsWith("https://");
	const attributes = [
		`${UTM_ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(token)}`,
		`Max-Age=${UTM_ATTRIBUTION_WINDOW_SECONDS}`,
		"Path=/",
		"HttpOnly",
		crossSiteCookies ? "SameSite=None" : "SameSite=Lax",
		...(crossSiteCookies ? ["Secure"] : []),
	];

	return attributes.join("; ");
}
