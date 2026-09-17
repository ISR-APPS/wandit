/**
 * Mints and renews the signed preview URL of the running sandbox
 * through `GET /api/v2/projects/:id/preview-token`. PreviewPanel calls
 * it; `refresh` and `markNotRunning` are for the preview message
 * bridge (WANDIT-173). On `SANDBOX_NOT_RUNNING` it polls until a mint
 * succeeds.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
	getApiErrorMessage,
	getGenericApiErrorMessage,
	isApiClientError,
} from "@/lib/api-client";
import { getPreviewToken } from "../api/app-builder.services";

/** Lead before `expiresAt` at which the next mint fires, ms. The token lives 15 minutes; one minute of lead keeps the frame alive across the swap. */
const TOKEN_REFRESH_LEAD_MS = 60_000;

/** Delay between two mints while the sandbox starts, ms. The route is rate limited at 30 requests per user per minute. */
// LIMIT: one waking tab per user. Upgrade: treat 429 as waking with a 10 s delay.
const SANDBOX_POLL_MS = 3_000;

/**
 * The render state of the preview iframe. `previewUrl` stays null until
 * the first mint succeeds; `errorText` holds the user-facing text of a
 * non-waking failure.
 */
export type PreviewTokenState = {
	/** `loading`: no answer yet. `waking`: no sandbox runs yet; a poll mints again. */
	status: "loading" | "ready" | "waking" | "error";
	/** The signed iframe URL, or null while it is unknown. */
	previewUrl: string | null;
	/** User-facing error text of the last failed mint, or null. */
	errorText: string | null;
};

/** Injected services, for the spec seam. */
export type PreviewTokenDeps = {
	getPreviewToken: typeof getPreviewToken;
};

/** Return of `usePreviewToken`: the render state plus the two bridge commands. */
export type UsePreviewToken = PreviewTokenState & {
	/** Mints a token now. The preview bridge and the retry button call it. A token-expired report on a fresh token shows the retry state instead of minting. */
	refresh: () => void;
	/** Enters the waking state and starts the poll. The preview bridge calls it on a dead-sandbox report. */
	markNotRunning: () => void;
};

const defaultDeps: PreviewTokenDeps = { getPreviewToken };

const INITIAL_STATE: PreviewTokenState = {
	status: "loading",
	previewUrl: null,
	errorText: null,
};

/**
 * Mints a token on mount and on every `reloadKey` change. A reload mints
 * a new token; the new iframe src reloads the frame. A success schedules
 * the next mint at `expiresAt - 1 min`. A `SANDBOX_NOT_RUNNING` answer
 * polls every 3 s. Any other error shows the retry state.
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
	// Expiry of the token the frame shows, ms since epoch. Null while no frame lives.
	const expiresAtMsRef = useRef<number | null>(null);

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
						status: "ready",
						previewUrl: token.previewUrl,
						errorText: null,
					});
					// LIMIT: the frame reloads on every re-mint. Upgrade: a cookie refresh on the proxy without a reload.
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
							errorText: null,
						});
						timerIdRef.current = setTimeout(mintToken, SANDBOX_POLL_MS);
						return;
					}
					expiresAtMsRef.current = null;
					// LIMIT: a failed background re-mint drops the frame up to 60 s early. Upgrade: keep the frame until expiresAt and retry once.
					setState({
						status: "error",
						previewUrl: null,
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
			errorText: null,
		});
		// LIMIT: a proxy 503 on a running row re-mints every 3 s. Upgrade: wait the retry-after of the proxy, or back off after two reports.
		timerIdRef.current = setTimeout(mint, SANDBOX_POLL_MS);
	}, [clearTimer, mint]);

	// A reload mints a new token: every reloadKey change re-runs this effect.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is an intentional re-mint trigger
	useEffect(() => {
		mint();
		return () => {
			// In-flight answers of this run must not update a newer run.
			generationRef.current += 1;
			clearTimer();
		};
	}, [mint, reloadKey, clearTimer]);

	const refresh = useCallback(() => {
		const expiresAtMs = expiresAtMsRef.current;
		// The proxy also posts token-expired when the browser drops its cookie.
		// A token with more than the lead left proves the report is not a real
		// expiry. A mint would loop at network speed until the API answers 429.
		// LIMIT: a client clock off by more than the lead breaks the auto
		// re-mint. Upgrade: measure the token age from the mint time with
		// PREVIEW_TOKEN_TTL_SECONDS from contracts.
		if (
			expiresAtMs !== null &&
			expiresAtMs - Date.now() > TOKEN_REFRESH_LEAD_MS
		) {
			expiresAtMsRef.current = null;
			// In-flight mints and the scheduled re-mint must not resurrect the frame.
			generationRef.current += 1;
			clearTimer();
			// LIMIT: a blocked cross-site cookie shows the retry state, never the app. Upgrade: a Partitioned cookie on the proxy, or the token in the path.
			setState({
				status: "error",
				previewUrl: null,
				// Not an API failure: the generic text and the retry button fit.
				errorText: getGenericApiErrorMessage(),
			});
			return;
		}
		mint();
	}, [clearTimer, mint]);

	return { ...state, refresh, markNotRunning };
}
