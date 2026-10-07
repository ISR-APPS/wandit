/**
 * Mints and renews the signed preview URL of the running sandbox
 * through `GET /api/v2/projects/:id/preview-token`. PreviewPanel calls
 * it; `refresh` and `markNotRunning` are for the preview message
 * bridge (WANDIT-173). On `SANDBOX_NOT_RUNNING` it polls until a mint
 * succeeds.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { getPreviewToken } from "../api/app-builder.services";

/** Lead before `expiresAt` at which the next mint fires, ms. The token lives 15 minutes; one minute of lead keeps the frame alive across the swap. */
const TOKEN_REFRESH_LEAD_MS = 60_000;

/** Delay between two mints while the sandbox starts, ms. The route is rate limited at 30 requests per user per minute. */
const SANDBOX_POLL_MS = 3_000;

/**
 * Delay before the next mint after a 429, or after a failed re-mint while the
 * token still lives, ms. Two waking tabs poll 40 times per minute, above the
 * 30 of the rate limit. A 10 s wait tries again at most 6 times before the
 * 60 s window resets.
 */
const MINT_RETRY_MS = 10_000;

/**
 * The render state of the preview iframe. `previewUrl` stays null until
 * the first mint succeeds; `errorText` holds the user-facing text of a
 * non-waking failure.
 */
export type PreviewTokenState = {
	/**
	 * `loading`: no answer yet. `waking`: no sandbox runs yet; a poll mints again.
	 * `blocked`: the sandbox runs, but the proxy answers 401 to a fresh token inside the frame.
	 */
	status: "loading" | "ready" | "waking" | "error" | "blocked";
	/** The signed iframe URL on the `f-` frame host, or null while it is unknown. */
	previewUrl: string | null;
	/**
	 * The signed URL on the `r-` run host for a top-level tab, null together with `previewUrl`.
	 * `blocked` keeps a fresh one. The frame host label is a bearer secret, so no address bar may show it.
	 */
	tabUrl: string | null;
	/** User-facing error text of the last failed mint, or null. */
	errorText: string | null;
};

/** Injected services, for the spec seam. */
export type PreviewTokenDeps = {
	getPreviewToken: typeof getPreviewToken;
};

/** Return of `usePreviewToken`: the render state plus the two bridge commands. */
export type UsePreviewToken = PreviewTokenState & {
	/** Mints a token now. The preview bridge and the retry button call it. A token-expired report on a fresh token shows the blocked state instead of minting. */
	refresh: () => void;
	/** Enters the waking state and starts the poll. The preview bridge calls it on a dead-sandbox report. */
	markNotRunning: () => void;
};

const defaultDeps: PreviewTokenDeps = { getPreviewToken };

const INITIAL_STATE: PreviewTokenState = {
	status: "loading",
	previewUrl: null,
	tabUrl: null,
	errorText: null,
};

/**
 * Mints a token on mount and on every `reloadKey` change. A reload mints
 * a new token; the new iframe src reloads the frame. A success schedules
 * the next mint at `expiresAt - 1 min`. A `SANDBOX_NOT_RUNNING` answer
 * polls every 3 s. A 429, or a failed re-mint while the token lives, keeps
 * the screen and mints again in 10 s. Any other error shows the retry
 * state. After a blocked frame, every mint shows `blocked` until the next
 * `reloadKey` change.
 */
export function usePreviewToken(
	projectId: string,
	/** Bump from the reload button. Every change mints a new token. */
	reloadKey: number,
	deps: PreviewTokenDeps = defaultDeps,
): UsePreviewToken {
	const [state, setState] = useState<PreviewTokenState>(INITIAL_STATE);

	const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const generationRef = useRef(0);
	// Expiry of the last minted token, ms since epoch. Null after a waking or failed mint.
	const expiresAtMsRef = useRef<number | null>(null);
	// True after a token-expired report on a fresh token: the proxy answers 401 to a live token in the frame.
	// Then the frame claims are gone, or an `r-` host lost its cookie. No frame mounts again until a reload.
	const isFrameBlockedRef = useRef(false);

	// The function is the dep, not the deps object: an inline `{ getPreviewToken }` literal must not re-mint on every render.
	const { getPreviewToken } = deps;

	const clearTimer = useCallback(() => {
		if (timerIdRef.current !== null) {
			clearTimeout(timerIdRef.current);
			timerIdRef.current = null;
		}
	}, []);

	// The timers call `mintToken` by name, so they reach this same closure.
	const mint = useCallback(
		function mintToken() {
			const generation = ++generationRef.current;
			clearTimer();
			void getPreviewToken(projectId)
				.then((token) => {
					// A stale answer must not overwrite a newer token.
					if (generation !== generationRef.current) {
						return;
					}
					expiresAtMsRef.current = Date.parse(token.expiresAt);
					setState({
						status: isFrameBlockedRef.current ? "blocked" : "ready",
						previewUrl: token.previewUrl,
						tabUrl: token.tabUrl,
						errorText: null,
					});
					// LIMIT: the frame reloads on every re-mint. Upgrade: renew the frame claims on the proxy without a reload.
					timerIdRef.current = setTimeout(
						mintToken,
						// A client clock ahead of the server gives a delay under 0; the poll interval is the floor.
						Math.max(
							Date.parse(token.expiresAt) - Date.now() - TOKEN_REFRESH_LEAD_MS,
							SANDBOX_POLL_MS,
						),
					);
				})
				.catch((error: unknown) => {
					if (generation !== generationRef.current) {
						return;
					}
					// No sandbox runs yet: show the waking state and keep polling.
					if (isApiClientError(error) && error.code === "SANDBOX_NOT_RUNNING") {
						expiresAtMsRef.current = null;
						setState({
							status: "waking",
							previewUrl: null,
							tabUrl: null,
							errorText: null,
						});
						timerIdRef.current = setTimeout(mintToken, SANDBOX_POLL_MS);
						return;
					}
					// A 429 keeps the waking, ready, or blocked screen. A failed
					// re-mint keeps the frame while its token still lives.
					const expiresAtMs = expiresAtMsRef.current;
					if (
						(isApiClientError(error) && error.code === "RATE_LIMITED") ||
						(expiresAtMs !== null && expiresAtMs > Date.now())
					) {
						console.warn("Preview token mint failed, retrying", error);
						timerIdRef.current = setTimeout(mintToken, MINT_RETRY_MS);
						return;
					}
					expiresAtMsRef.current = null;
					setState({
						status: "error",
						previewUrl: null,
						tabUrl: null,
						errorText: getApiErrorMessage(error),
					});
				});
		},
		[clearTimer, getPreviewToken, projectId],
	);

	const markNotRunning = useCallback(() => {
		clearTimer();
		expiresAtMsRef.current = null;
		// In-flight mints lose the race with the new poll run.
		generationRef.current += 1;
		setState({
			status: "waking",
			previewUrl: null,
			tabUrl: null,
			errorText: null,
		});
		// LIMIT: a proxy 503 on a running row re-mints every 3 s. Upgrade: wait the retry-after of the proxy, or back off after two reports.
		timerIdRef.current = setTimeout(mint, SANDBOX_POLL_MS);
	}, [clearTimer, mint]);

	// A reload mints a new token: every reloadKey change re-runs this effect.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is an intentional re-mint trigger
	useEffect(() => {
		// A reload tries the frame again: the new `?wt=` stores the frame claims again, or the report was wrong.
		isFrameBlockedRef.current = false;
		mint();
		return () => {
			// In-flight answers of this run must not update a newer run.
			generationRef.current += 1;
			clearTimer();
		};
	}, [mint, reloadKey, clearTimer]);

	const refresh = useCallback(() => {
		const expiresAtMs = expiresAtMsRef.current;
		// The proxy posts token-expired on every 401 of a navigation, also when
		// the frame host has no claims. A token with more than the lead left
		// proves the report is not a real expiry. A mint would loop at network
		// speed until the API answers 429.
		// LIMIT: a client clock off by more than the lead breaks the auto
		// re-mint. Upgrade: measure the token age from the mint time with
		// PREVIEW_TOKEN_TTL_SECONDS from contracts.
		if (
			expiresAtMs !== null &&
			expiresAtMs - Date.now() > TOKEN_REFRESH_LEAD_MS
		) {
			// The builder frame uses the `f-` frame host, which needs no cookie. A report on a fresh
			// token then means the frame claims are gone, or an `r-` host lost its cookie.
			// The scheduled re-mint keeps running, so `tabUrl` stays valid for "Open in a new tab".
			// The new tab opens the `r-` run host, which sets a first-party cookie.
			// LIMIT: in the blocked state, nothing renews the token of the new tab. The tab works for 1 to 15 min.
			// Then it shows the proxy expired page, which posts its restart message to a parent frame only.
			// Upgrade: a top-level expired page that tells the user to open the tab again.
			isFrameBlockedRef.current = true;
			setState((current) => ({ ...current, status: "blocked" }));
			return;
		}
		mint();
	}, [mint]);

	return { ...state, refresh, markNotRunning };
}
