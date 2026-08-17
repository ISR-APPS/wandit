import { env } from "@wandit/env/web";

// Thin wrapper over the Chatwoot website SDK (`window.$chatwoot`). This is
// the only file that touches the global; components go through it.
//
// SDK facts that shape this file (chatwoot/chatwoot sdk.js + Help Center):
// - `chatwootSDK.run()` returns early if `window.$chatwoot` exists, so the
//   script is loaded once and settings are read a single time inside run().
// - Calls made before the widget iframe reports `chatwoot:ready` are lost
//   (setUser included), so every call goes through `whenChatwootReady`.
// - There is no destroy API; only hide/show the launcher bubble.

type ChatwootUser = {
	name?: string;
	email?: string;
	avatar_url?: string;
	identifier_hash?: string;
};

export type ChatwootApi = {
	hasLoaded?: boolean;
	// SDK internals (verified against the deployed app.chatwoot.com bundle):
	// `hideMessageBubble` is read when the launcher is built on iframe load;
	// `resetTriggered` suppresses `chatwoot:ready` after reset(); `user` is
	// re-sent (malformed) on iframe load. resetSupportChat() re-arms them.
	hideMessageBubble?: boolean;
	resetTriggered?: boolean;
	user?: ChatwootUser;
	setUser(identifier: string, user: ChatwootUser): void;
	setCustomAttributes(attributes: Record<string, string | number>): void;
	setLocale(locale: string): void;
	// In the SDK source but not yet in the Help Center docs — call guarded.
	setColorScheme?(scheme: "light" | "dark" | "auto"): void;
	toggle(state?: "open" | "close"): void;
	toggleBubbleVisibility(state: "show" | "hide"): void;
	reset(): void;
};

export type ChatwootSettings = {
	hideMessageBubble?: boolean;
	showUnreadMessagesDialog?: boolean;
	position?: "left" | "right";
	locale?: string;
	useBrowserLanguage?: boolean;
	type?: "standard" | "expanded_bubble";
	launcherTitle?: string;
	darkMode?: "light" | "auto";
	showPopoutButton?: boolean;
};

declare global {
	interface Window {
		$chatwoot?: ChatwootApi;
		chatwootSDK?: {
			run(options: { websiteToken: string; baseUrl: string }): void;
		};
		chatwootSettings?: ChatwootSettings;
	}
}

const CHATWOOT_READY_EVENT = "chatwoot:ready";

const baseUrl = env.VITE_CHATWOOT_BASE_URL;
const websiteToken = env.VITE_CHATWOOT_WEBSITE_TOKEN;

export const isChatwootConfigured = Boolean(baseUrl && websiteToken);

let loadStarted = false;

// Injects the SDK script once. `settings` must be on window BEFORE run() —
// the SDK reads them a single time and ignores later changes.
export function loadChatwoot(settings: ChatwootSettings): void {
	if (
		loadStarted ||
		!baseUrl ||
		!websiteToken ||
		typeof document === "undefined"
	) {
		return;
	}
	loadStarted = true;

	window.chatwootSettings = {
		type: "standard",
		hideMessageBubble: false,
		...settings,
	};

	const script = document.createElement("script");
	script.src = `${baseUrl}/packs/js/sdk.js`;
	script.async = true;
	script.onload = () => {
		window.chatwootSDK?.run({ websiteToken, baseUrl });
	};
	document.head.appendChild(script);
}

// Runs `callback` once the widget iframe is ready (now, if it already is).
// Returns an unsubscribe for effect cleanups.
export function whenChatwootReady(
	callback: (api: ChatwootApi) => void,
): () => void {
	if (typeof window === "undefined") {
		return () => {};
	}
	const api = window.$chatwoot;
	if (api?.hasLoaded) {
		callback(api);
		return () => {};
	}
	const handler = () => {
		if (window.$chatwoot) {
			callback(window.$chatwoot);
		}
	};
	window.addEventListener(CHATWOOT_READY_EVENT, handler, { once: true });
	return () => window.removeEventListener(CHATWOOT_READY_EVENT, handler);
}

// Public actions used by other features (sidebar "Support", sign-out).

export function openSupportChat(): void {
	whenChatwootReady((api) => api.toggle("open"));
}

export function setSupportChatBubbleVisible(visible: boolean): void {
	const api = typeof window === "undefined" ? undefined : window.$chatwoot;
	if (api && !api.hasLoaded) {
		// The SDK builds the launcher from this flag when the iframe loads.
		// Setting it now covers the window where the iframe is (re)loading and
		// no ready callback would run in time — e.g. sign-out during load.
		api.hideMessageBubble = !visible;
	}
	whenChatwootReady((ready) =>
		ready.toggleBubbleVisibility(visible ? "show" : "hide"),
	);
}

// The SDK's cookies are host-only, path "/" (js-cookie defaults). Expiring
// them by hand is what reset() does internally.
function expireCookie(name: string): void {
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in Firefox and older Safari; a plain expire write is enough here.
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

// Chatwoot docs: call reset() when the user logs out. It clears the
// cw_conversation / cw_user_* cookies and reloads the widget iframe, so the
// next person on this browser does not see the previous user's chat.
export function resetSupportChat(): void {
	if (typeof window === "undefined" || !websiteToken) {
		return;
	}
	const api = window.$chatwoot;
	if (!api) {
		// The SDK never ran on this page (sign-out from a public route, or
		// before the script executed). Clear the cookies reset() would clear,
		// otherwise the next widget boot resumes the previous conversation.
		expireCookie("cw_conversation");
		expireCookie(`cw_user_${websiteToken}`);
		return;
	}
	api.reset();
	// reset() reloads the iframe but leaves `hasLoaded` true and sets
	// `resetTriggered`, which suppresses the next `chatwoot:ready`. Re-arm so
	// whenChatwootReady() waits for the reloaded frame instead of posting to
	// a frame that is not there yet. Drop the cached user too: the SDK would
	// re-send it on load without its identifier.
	api.hasLoaded = false;
	api.resetTriggered = false;
	api.user = undefined;
}
