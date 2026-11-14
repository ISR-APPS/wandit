/**
 * The consent page at /oauth/consent: the `consentPage` of the OAuth provider in `@wandit/auth`.
 * routes/_auth/oauth.consent.tsx renders it after the sign-in and onboarding gates of `_auth`.
 * It shows who asks and for what, then sends Allow or Deny with `submitConsent`.
 * It shows the live `authClient.useSession()` account, because Allow grants access to the cookie session.
 * The client name is untrusted text: plain text only, no link, no logo.
 * The buttons have the V2 panel look of features/app-builder, through its barrel.
 */
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	PANEL_PRIMARY_BUTTON_CLASS,
	PANEL_SECONDARY_BUTTON_CLASS,
} from "@/features/app-builder";
import { authClient, type SessionUser, signOut } from "@/features/auth";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { getServerUrl } from "@/lib/server-url";
import {
	codingAgentKeys,
	usePublicClientQuery,
} from "../api/coding-agents.queries";
import {
	isRefusedOAuthRequest,
	submitConsent,
} from "../api/coding-agents.services";
import {
	InvalidOAuthRequest,
	OAUTH_TITLE_CLASS,
	OAuthCard,
	OAuthMessage,
	OAuthPending,
	OAuthRequestFailed,
} from "../components/oauth-card";
import { ScopeList } from "../components/scope-list";
import {
	clientAddresses,
	parseOAuthRedirect,
	parseRequestedScopes,
	readSignedOAuthQuery,
} from "../lib/helpers";

// A small grey line of the page: the name note, "Signed in as", the revoke hint. 60 % navy keeps 12 px text readable on white.
const NOTE_CLASS = "font-sans text-night/60 text-xs dark:text-foreground/60";

/** 1 s. A double-click takes about 0.5 s, so its second click ends before Allow works. */
const ALLOW_ARM_DELAY_MS = 1000;

/** The fields of the signed query that the page shows. The API signed them, and checks them again on submit. */
type ConsentRequest = {
	/** The signed params of this page query, from `readSignedOAuthQuery`. */
	signedQuery: string;
	/** OAuth client id: a CIMD document URL, or the id that registration gave. */
	clientId: string;
	/** Requested scopes, space-separated. The API filled in the defaults when the client sent none. */
	scope: string;
	/** Where the client receives the code. The API checked it against the registration. */
	redirectUri: string | null;
};

/** Reads the request once. The router keeps a re-serialized copy of the search, which breaks the signature. */
export default function OAuthConsentPage({
	initialUser,
}: {
	/** The user of the `_auth` gate session. The page shows it until the live session loads. */
	initialUser: SessionUser;
}) {
	const [request] = useState(() => readConsentRequest(window.location.search));
	if (request === null) {
		return <InvalidOAuthRequest />;
	}
	return <ConsentCard request={request} initialUser={initialUser} />;
}

function readConsentRequest(search: string): ConsentRequest | null {
	const signedQuery = readSignedOAuthQuery(search);
	if (signedQuery === null) {
		return null;
	}
	const params = new URLSearchParams(signedQuery);
	const clientId = params.get("client_id");
	if (!clientId) {
		return null;
	}
	return {
		signedQuery,
		clientId,
		scope: params.get("scope") ?? "",
		redirectUri: params.get("redirect_uri"),
	};
}

function ConsentCard({
	request,
	initialUser,
}: {
	request: ConsentRequest;
	/** The user of the `_auth` gate session, shown before the live session loads. */
	initialUser: SessionUser;
}) {
	const { t } = useTranslation();
	const clientQuery = usePublicClientQuery(request.clientId);
	const [outcome, setOutcome] = useState<"sent" | "invalid" | null>(null);
	const [isSwitchingAccount, setSwitchingAccount] = useState(false);
	// False until ALLOW_ARM_DELAY_MS after the card shows, and again after each focus or visibility change.
	const [isAllowArmed, setAllowArmed] = useState(false);
	// Another tab can switch the account. Better Auth loads the session again when the tab shows, and after a sign-out.
	const {
		data: liveSession,
		isPending: isSessionPending,
		isRefetching: isSessionRefetching,
		error: sessionError,
	} = authClient.useSession();
	const shownUser = liveSession?.user ?? initialUser;
	// While the session loads, the page can show an old account. Allow then waits, so it never grants for an unseen account.
	const isSessionLoading = isSessionPending || isSessionRefetching;
	// A failed load keeps the last account. Only a loaded empty session is a sign-out.
	const isSignedOut =
		!isSessionPending && sessionError === null && liveSession === null;

	useEffect(() => {
		// The `_auth` gate opens the sign-in, then comes back to this raw URL (routes/_auth/route.tsx).
		// During an account switch, switchAccount reloads after it clears the local state.
		if (isSignedOut && outcome === null && !isSwitchingAccount) {
			window.location.reload();
		}
	}, [isSignedOut, outcome, isSwitchingAccount]);

	useEffect(() => {
		if (!clientQuery.isSuccess) {
			return;
		}
		// Double-click jacking: a page closes its popup on the first click, so the second click lands here.
		// Allow waits after the card shows and after each focus, so that click hits a disabled button.
		let armTimer: number | undefined;
		const disarm = () => {
			setAllowArmed(false);
			window.clearTimeout(armTimer);
			armTimer = window.setTimeout(
				() => setAllowArmed(true),
				ALLOW_ARM_DELAY_MS,
			);
		};
		disarm();
		window.addEventListener("focus", disarm);
		document.addEventListener("visibilitychange", disarm);
		return () => {
			window.clearTimeout(armTimer);
			window.removeEventListener("focus", disarm);
			document.removeEventListener("visibilitychange", disarm);
		};
	}, [clientQuery.isSuccess]);
	const consent = useMutation({
		mutationKey: [...codingAgentKeys.all, "consent"],
		mutationFn: submitConsent,
		onSuccess: (url) => {
			const next = parseOAuthRedirect(url, getServerUrl());
			if (next === null) {
				setOutcome("invalid");
				return;
			}
			setOutcome("sent");
			// replace: the Back button must not show a request that the API already used.
			window.location.replace(next.toString());
		},
		onError: (error) => {
			// A refused request renders the dead end below. Another failure keeps the buttons for a retry.
			if (!isRefusedOAuthRequest(error)) {
				toast.error(getApiErrorMessage(error));
			}
		},
	});

	const switchAccount = async () => {
		setSwitchingAccount(true);
		try {
			// Better Auth answers an HTTP failure with `{ error }`. It throws only on a network failure.
			const { error } = await authClient.signOut();
			if (error) {
				throw error;
			}
		} catch (error) {
			// The old session stays. The user sees the toast and can try again.
			console.error("Sign-out before an account switch failed", error);
			toast.error(t("auth.codingAgents.consent.switchFailed"));
			setSwitchingAccount(false);
			return;
		}
		// The shared signOut clears the local state of the old account: analytics, support chat, prompt stash.
		// Its request finds no session cookie now, and Better Auth answers 200. It clears the state also on a failure.
		await signOut().catch((error: unknown) => {
			console.error("Local sign-out after an account switch failed", error);
		});
		// The `_auth` gate opens the sign-in, then comes back to this raw URL (routes/_auth/route.tsx).
		window.location.reload();
	};

	if (
		outcome === "invalid" ||
		(consent.error && isRefusedOAuthRequest(consent.error))
	) {
		return <InvalidOAuthRequest />;
	}
	if (outcome === "sent") {
		// A loopback redirect leaves this page. A custom scheme (cursor://) opens the app, and this tab stays.
		return (
			<OAuthMessage
				title={t("auth.codingAgents.consent.doneTitle")}
				body={t("auth.codingAgents.consent.doneBody")}
			/>
		);
	}
	if (clientQuery.isPending) {
		return <OAuthPending label={t("auth.codingAgents.consent.loading")} />;
	}
	if (clientQuery.isError) {
		return (
			<OAuthRequestFailed
				error={clientQuery.error}
				onRetry={() => void clientQuery.refetch()}
			/>
		);
	}

	const clientName = clientQuery.data.client_name;
	const addresses = clientAddresses(request.clientId, request.redirectUri);
	const isBusy = consent.isPending || isSwitchingAccount;

	return (
		<OAuthCard>
			<h1 className={OAUTH_TITLE_CLASS}>
				{t("auth.codingAgents.consent.title")}
			</h1>

			<div className="mt-6 rounded-[16px] border border-night/[0.08] bg-night/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
				<p
					dir="auto"
					className="line-clamp-3 break-words font-grotesk font-semibold text-base text-night dark:text-foreground"
				>
					{clientName ?? t("auth.codingAgents.client.unnamed")}
				</p>
				{clientName ? (
					<p className={cn(NOTE_CLASS, "mt-0.5")}>
						{t("auth.codingAgents.client.givenByApp")}
					</p>
				) : null}
				{addresses.length > 0 ? (
					<dl className="mt-3 flex flex-col gap-1 font-sans text-night text-xs dark:text-foreground">
						{addresses.map((address) => (
							<div
								key={address.kind}
								className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
							>
								<dt className="text-night/60 dark:text-foreground/60">
									{address.kind === "client_id"
										? t("auth.codingAgents.client.clientIdAddress")
										: t("auth.codingAgents.client.redirectAddress")}
								</dt>
								<dd className="min-w-0">
									{/* An address reads left to right in every locale. */}
									<code
										dir="ltr"
										className="break-all rounded-md bg-night/[0.06] box-decoration-clone px-1.5 py-0.5 font-mono dark:bg-white/[0.08]"
									>
										{address.address}
									</code>
								</dd>
								{address.opensLocalApp ? (
									<dd className="basis-full text-night/60 dark:text-foreground/60">
										{t("auth.codingAgents.client.localAppHint")}
									</dd>
								) : null}
							</div>
						))}
					</dl>
				) : null}
			</div>

			<h2 className="mt-6 font-grotesk font-semibold text-[15px] text-night dark:text-foreground">
				{t("auth.codingAgents.consent.accessTitle")}
			</h2>
			<div className="mt-3">
				<ScopeList scopes={parseRequestedScopes(request.scope)} />
			</div>
			<p className="mt-4 font-sans text-[13px] text-night/60 leading-relaxed dark:text-foreground/60">
				{t("auth.codingAgents.consent.accessCoverage")}
			</p>

			<div className="mt-6 rounded-[16px] bg-night/[0.04] px-4 py-3 dark:bg-white/[0.05]">
				<p className={NOTE_CLASS}>
					{t("auth.codingAgents.consent.signedInAs")}
				</p>
				<p
					dir="ltr"
					className="ph-no-capture break-all text-start font-grotesk font-medium text-[14px] text-night dark:text-foreground"
				>
					{shownUser.displayEmail ?? shownUser.email}
				</p>
				<Button
					variant="link"
					size="sm"
					className="mt-1 h-auto px-0 font-grotesk text-ember-text"
					disabled={isBusy}
					onClick={() => void switchAccount()}
				>
					{t("auth.codingAgents.consent.switchAccount")}
				</Button>
			</div>

			<div className="mt-6 grid grid-cols-2 gap-3">
				<Button
					variant="outline"
					className={cn(PANEL_SECONDARY_BUTTON_CLASS, "h-11")}
					disabled={isBusy}
					onClick={() =>
						consent.mutate({ signedQuery: request.signedQuery, accept: false })
					}
				>
					{consent.isPending && consent.variables?.accept === false ? (
						<CircleNotchIcon aria-hidden className="animate-spin" />
					) : null}
					{t("auth.codingAgents.consent.deny")}
				</Button>
				<Button
					className={cn(PANEL_PRIMARY_BUTTON_CLASS, "h-11")}
					disabled={!isAllowArmed || isBusy || isSessionLoading || isSignedOut}
					onClick={() =>
						consent.mutate({ signedQuery: request.signedQuery, accept: true })
					}
				>
					{consent.isPending && consent.variables?.accept === true ? (
						<CircleNotchIcon aria-hidden className="animate-spin" />
					) : null}
					{t("auth.codingAgents.consent.allow")}
				</Button>
			</div>
			<p className={cn(NOTE_CLASS, "mt-4 text-center")}>
				{t("auth.codingAgents.consent.revokeHint")}
			</p>
		</OAuthCard>
	);
}
