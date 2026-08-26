/**
 * Picks the SameSite attribute for the Better Auth cookies.
 *
 * `lax` is the safe value: a cross-site HTML form POST does not carry a Lax
 * cookie, so a third-party page cannot forge a write with the victim's
 * session (CSRF). Browsers still send a Lax cookie on the top-level GET
 * navigation that Google uses for the OAuth callback, and on fetch/XHR from a
 * same-site web origin. In production wandit.dev and api.wandit.dev share the
 * registrable domain wandit.dev, so they are the same site.
 *
 * `none` is necessary only when a web origin and the API live on different
 * sites (staging: *.vercel.app -> api-staging.wandit.dev). There every auth
 * cookie (OAuth state, session) must be SameSite=None;Secure or browsers
 * drop it on the cross-site hop. The symptom is "State mismatch: State not
 * persisted correctly" on the Google callback.
 *
 * AUTH_COOKIE_SAME_SITE overrides the guess in either direction.
 */
export type AuthCookieSameSite = "lax" | "none";

// Hosting suffixes on the Public Suffix List. Each customer subdomain is its
// own site for the browser, so two apps under one suffix are cross-site even
// though their last two DNS labels match.
const MULTI_TENANT_SUFFIXES = [
	"amplifyapp.com",
	"azurewebsites.net",
	"cloudfront.net",
	"firebaseapp.com",
	"fly.dev",
	"github.io",
	"herokuapp.com",
	"loca.lt",
	"netlify.app",
	"ngrok-free.app",
	"ngrok.app",
	"onrender.com",
	"pages.dev",
	"railway.app",
	"trycloudflare.com",
	"vercel.app",
	"web.app",
	"workers.dev",
];

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Returns the "site" a browser assigns to a hostname: the registrable domain
 * (last two labels) for normal domains, the full host for IP addresses,
 * single-label hosts, and multi-tenant hosting suffixes.
 *
 * This is a deliberate approximation of the Public Suffix List. It is exact
 * for wandit.dev and its subdomains, which is what production needs; the
 * AUTH_COOKIE_SAME_SITE override exists for every other case.
 */
export function browserSiteKey(hostname: string): string {
	const host = hostname.toLowerCase().replace(/\.$/, "");

	if (host.includes(":") || IPV4_PATTERN.test(host)) {
		return host;
	}

	if (
		MULTI_TENANT_SUFFIXES.some(
			(suffix) => host === suffix || host.endsWith(`.${suffix}`),
		)
	) {
		return host;
	}

	const labels = host.split(".");

	return labels.length <= 2 ? host : labels.slice(-2).join(".");
}

/** Schemeful same-site check, the way modern browsers compare two URLs. */
export function isSameBrowserSite(urlA: string, urlB: string): boolean {
	const a = new URL(urlA);
	const b = new URL(urlB);

	return (
		a.protocol === b.protocol &&
		browserSiteKey(a.hostname) === browserSiteKey(b.hostname)
	);
}

export function resolveAuthCookieSameSite(input: {
	/** The API origin the cookies belong to (BETTER_AUTH_URL). */
	apiUrl: string;
	/** Every browser origin that signs in against the API (web, aliases, admin). */
	browserOrigins: readonly string[];
	/** AUTH_COOKIE_SAME_SITE, when the operator decides. */
	override?: AuthCookieSameSite;
}): AuthCookieSameSite {
	if (input.override) {
		return input.override;
	}

	return input.browserOrigins.every((origin) =>
		isSameBrowserSite(input.apiUrl, origin),
	)
		? "lax"
		: "none";
}
