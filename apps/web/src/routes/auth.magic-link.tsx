import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { promptStash } from "@/features/auth";
import { authClient } from "@/features/auth/lib/auth-client";
import {
	getSession,
	invalidateSessionCache,
} from "@/features/auth/lib/session";
import { sanitizeAuthRedirectPath } from "@/lib/auth-navigation";
import { pageTitle, useTranslation } from "@/lib/i18n";

type MagicLinkSearch = {
	token?: string;
	next?: string;
};

/**
 * Landing page for the sign-in email. The emailed link is
 * <web-origin>/auth/magic-link?token=...&next=... (built in
 * packages/auth/src/email-magic-link-url.ts) instead of the raw API verify
 * URL. Verification happens with a fetch — like the OTP flow, the session
 * cookie arrives in place and this page performs the navigation itself, so
 * the API origin never appears in the email or the address bar.
 *
 * Success detection, in order of authority: the verify response body (Better
 * Auth returns { token, user, session } as JSON when no callbackURL is in
 * the query — errors come back as a redirect, not JSON, so only the success
 * shape is trustworthy), then a session probe — but ONLY when no session
 * existed before the click. A pre-existing session belongs to whoever was
 * already signed in on this browser and must never pass as this link's
 * success; a session that appears fresh means another tab of this signed-out
 * browser already completed the same link.
 */
export const Route = createFileRoute("/auth/magic-link")({
	validateSearch: (search: Record<string, unknown>): MagicLinkSearch => ({
		token:
			typeof search.token === "string" && search.token.length > 0
				? search.token
				: undefined,
		next:
			typeof search.next === "string"
				? sanitizeAuthRedirectPath(search.next)
				: undefined,
	}),
	head: () => ({ meta: [{ title: pageTitle("auth.magicLinkTitle") }] }),
	component: MagicLinkRoute,
});

function MagicLinkRoute() {
	const { t } = useTranslation();
	const navigate = Route.useNavigate();
	const { token, next } = Route.useSearch();
	const destination = next ?? "/dashboard";
	const [failed, setFailed] = useState(!token);
	const startedRef = useRef(false);

	useEffect(() => {
		if (!token) {
			// The old error path defused the stashed prompt at the ?auth=error
			// landing; every dead end here must do the same, or the next
			// sign-in would silently auto-start a stale generation.
			promptStash.consume();
			return;
		}
		if (startedRef.current) {
			return;
		}
		startedRef.current = true;

		void (async () => {
			// Read BEFORE verify, and raw: getSession() maps "the check
			// failed" and "signed out" both to null, but only a POSITIVE
			// signed-out answer may later let the probe count as success — a
			// failed check could be hiding another account's session.
			const pre = await authClient.getSession().catch(() => null);
			const confirmedSignedOut = Boolean(pre && !pre.error && !pre.data);
			const result = await authClient.magicLink
				.verify({ query: { token } })
				.catch(() => null);
			let signedIn = Boolean(result?.data?.token);
			if (!signedIn && confirmedSignedOut) {
				invalidateSessionCache();
				signedIn = Boolean(await getSession().catch(() => null));
			}
			if (signedIn) {
				// Full page load, like the OTP flow: the app boots with the
				// fresh cookie and the dashboard consumes any stashed prompt.
				// replace() keeps the dead one-time link out of the history.
				invalidateSessionCache();
				window.location.replace(
					new URL(destination, window.location.origin).toString(),
				);
				return;
			}
			promptStash.consume();
			setFailed(true);
		})();
	}, [token, destination]);

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-6">
			<section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				{failed ? (
					<>
						<h1 className="font-display font-semibold text-2xl tracking-tight">
							{t("auth.magicLinkInvalidTitle")}
						</h1>
						<p className="mt-3 text-muted-foreground text-sm">
							{t("auth.magicLinkInvalidBody")}
						</p>
						<Button
							className="mt-6 h-11 rounded-full px-6"
							onClick={() =>
								void navigate({
									to: "/",
									search: { auth: "required", next: destination },
									replace: true,
								})
							}
						>
							{t("auth.magicLinkRequestNew")}
						</Button>
					</>
				) : (
					<>
						<Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
						<p className="mt-4 text-muted-foreground text-sm">
							{t("auth.magicLinkVerifying")}
						</p>
					</>
				)}
			</section>
		</main>
	);
}
