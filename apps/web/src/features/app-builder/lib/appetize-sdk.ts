/**
 * Loads the Appetize JS SDK once and types the parts that the device panel
 * uses (WANDIT-196). components/preview/device-panel.tsx calls `loadAppetize`.
 * The SDK ships no types, so this file declares them. Event data stays raw
 * here; the panel parses it with the contracts schemas.
 */
import type { StartDeviceSessionResponse } from "@wandit/contracts";

/** Script of the Appetize JS SDK. `apps/web/vercel.json` sets no script CSP, so it loads. */
const APPETIZE_SDK_URL = "https://js.appetize.io/embed.js";

/** Config of `getClient`, built from the start route answer. */
export type AppetizeClientConfig = {
	/** The Appetize app id (the public key) of the Expo Go build. */
	buildId: string;
	device: string;
	osVersion: string;
	/** `exps://` phone link that Expo Go opens at launch. */
	launchUrl: string;
	params: StartDeviceSessionResponse["params"];
	/** `auto` fits the device into the iframe. */
	scale: "auto";
	codec: "h264";
};

/** One running Appetize session: the methods the panel calls. */
export type AppetizeSession = {
	/** The Appetize session token. The end route stores it for the minute bill. */
	token: string;
	/** `data` is `{ secondsRemaining }`, raw from the SDK. */
	on(event: "inactivityWarning", listener: (data: unknown) => void): void;
	/** Resets the idle timer of Appetize. */
	heartbeat(): Promise<void>;
	restartApp(): Promise<void>;
	/** Shakes the device: Expo Go opens its dev menu. */
	shake(): Promise<void>;
};

/** The Appetize client of one embed iframe. */
export type AppetizeClient = {
	/** `queue` data is `{ type, position }`; `error` and `sessionError` carry an Error. All raw from the SDK. */
	on(
		event: "queue" | "error" | "sessionError",
		listener: (data: unknown) => void,
	): void;
	on(event: "session", listener: (session: AppetizeSession) => void): void;
	on(event: "queueEnd" | "sessionEnded", listener: () => void): void;
	startSession(): Promise<AppetizeSession>;
	/** Ends the session, or leaves the queue when no session runs yet. */
	endSession(): Promise<void>;
};

/** The `window.appetize` object that the script defines. */
export type AppetizeSdk = {
	getClient(
		selector: string,
		config: AppetizeClientConfig,
	): Promise<AppetizeClient>;
};

declare global {
	interface Window {
		/** Set by the Appetize script after it loads. */
		appetize?: AppetizeSdk;
	}
}

let sdkLoad: Promise<AppetizeSdk> | null = null;

/**
 * Appends the SDK script once and resolves with `window.appetize`. A load
 * failure clears the cache, so the next start tries the network again.
 */
export function loadAppetize(): Promise<AppetizeSdk> {
	if (sdkLoad !== null) return sdkLoad;
	const load = new Promise<AppetizeSdk>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = APPETIZE_SDK_URL;
		script.async = true;
		script.onload = () => {
			if (window.appetize) {
				resolve(window.appetize);
			} else {
				sdkLoad = null;
				reject(new Error("The Appetize script loaded without window.appetize"));
			}
		};
		script.onerror = () => {
			sdkLoad = null;
			script.remove();
			reject(new Error("The Appetize script failed to load"));
		};
		document.head.append(script);
	});
	sdkLoad = load;
	return load;
}
