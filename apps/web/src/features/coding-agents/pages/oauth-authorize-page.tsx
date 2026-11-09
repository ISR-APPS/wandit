/**
 * The login bridge at /oauth/authorize: the `loginPage` of the OAuth provider in `@wandit/auth`.
 * routes/_auth/oauth.authorize.tsx renders it after the sign-in and onboarding gates of `_auth`.
 * It resumes the authorization with `continueAuthorization`, then sends the browser to the consent page.
 */
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { getServerUrl } from "@/lib/server-url";
import { codingAgentKeys } from "../api/coding-agents.queries";
import { continueAuthorization } from "../api/coding-agents.services";
import {
	InvalidOAuthRequest,
	OAuthMessage,
	OAuthPending,
	OAuthRequestFailed,
} from "../components/oauth-card";
import {
	OAUTH_AUTHORIZE_PAGE_PATH,
	parseOAuthRedirect,
	readSignedOAuthQuery,
} from "../lib/helpers";

/** Reads the signed query once. The router keeps a re-serialized copy of the search, which breaks the signature. */
export default function OAuthAuthorizePage() {
	const [signedQuery] = useState(() =>
		readSignedOAuthQuery(window.location.search),
	);
	if (signedQuery === null) {
		return <InvalidOAuthRequest />;
	}
	return <ResumeAuthorization signedQuery={signedQuery} />;
}

function ResumeAuthorization({
	signedQuery,
}: {
	/** The query of this page, as the API signed it. */
	signedQuery: string;
}) {
	const { t } = useTranslation();
	const [deadEnd, setDeadEnd] = useState<"invalid" | "fresh_sign_in" | null>(
		null,
	);
	const startedRef = useRef(false);
	const { mutate: resume, error } = useMutation({
		mutationKey: [...codingAgentKeys.all, "continue"],
		mutationFn: continueAuthorization,
		onSuccess: (url) => {
			const next = parseOAuthRedirect(url, getServerUrl());
			if (next === null) {
				setDeadEnd("invalid");
				return;
			}
			// The API sends the login page again when the client asks for a fresh sign-in
			// (prompt=login, max_age). The bridge cannot give one, so it stops instead of looping.
			if (
				next.origin === window.location.origin &&
				next.pathname === OAUTH_AUTHORIZE_PAGE_PATH
			) {
				setDeadEnd("fresh_sign_in");
				return;
			}
			// replace: the Back button must not run the bridge again.
			window.location.replace(next.toString());
		},
	});

	useEffect(() => {
		// One resume per page load. React runs this effect twice in development.
		if (startedRef.current) {
			return;
		}
		startedRef.current = true;
		resume(signedQuery);
	}, [resume, signedQuery]);

	if (deadEnd === "invalid") {
		return <InvalidOAuthRequest />;
	}
	if (deadEnd === "fresh_sign_in") {
		return (
			<OAuthMessage
				title={t("auth.codingAgents.request.freshSignInTitle")}
				body={t("auth.codingAgents.request.freshSignInBody")}
			/>
		);
	}
	if (error) {
		return (
			<OAuthRequestFailed error={error} onRetry={() => resume(signedQuery)} />
		);
	}
	// Also while the browser leaves for the consent page.
	return <OAuthPending label={t("auth.codingAgents.authorize.pending")} />;
}
