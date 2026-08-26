/**
 * The verify URL Better Auth builds for a magic-link email points at the API
 * origin (api.<domain>/api/auth/magic-link/verify?token=...&callbackURL=...).
 * It works, but it is also the link users SEE in the email — an API hostname
 * plus three URL-encoded callback URLs reads like phishing, not like a
 * sign-in button.
 *
 * Rewrite it onto the web origin the sign-in started from: /auth/magic-link
 * on the web app (apps/web/src/routes/auth.magic-link.tsx) verifies the token
 * with a fetch to the API and then navigates to `next`. Only `token` and the
 * callback's path need to travel through the email — newUserCallbackURL
 * always equals callbackURL and errorCallbackURL is derived from `next`
 * (see buildAuthCallbackUrls in apps/web).
 *
 * Anything that cannot be mapped onto a trusted web origin keeps the raw
 * verify URL: a wrong guess here would break sign-in outright.
 */
export function emailMagicLinkUrl(options: {
	verifyUrl: string;
	token: string;
	trustedWebOrigins: readonly string[];
}): string {
	const { verifyUrl, token, trustedWebOrigins } = options;
	try {
		const callback = new URL(verifyUrl).searchParams.get("callbackURL");
		if (!callback) {
			return verifyUrl;
		}
		// A relative callback ("/", the plugin default) throws here — it
		// resolves against the API origin, which has no verify page, so the
		// raw URL is the safe answer.
		const callbackUrl = new URL(callback);
		if (!trustedWebOrigins.includes(callbackUrl.origin)) {
			return verifyUrl;
		}
		const emailUrl = new URL("/auth/magic-link", callbackUrl.origin);
		emailUrl.searchParams.set("token", token);
		const next = `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
		if (next !== "/") {
			emailUrl.searchParams.set("next", next);
		}
		return emailUrl.toString();
	} catch {
		return verifyUrl;
	}
}
