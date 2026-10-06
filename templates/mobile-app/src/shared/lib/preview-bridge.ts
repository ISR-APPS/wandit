// Dev-only bridge between the web build in the builder phone frame and the wandit host.
// src/app/_layout.tsx imports it first. It posts uncaught errors, Metro compile errors, and
// rejected promises to window.parent. The host then shows its "Try to fix" banner.
// It copies the error part of the web template bridge (src/wandit/preview-bridge.ts there).
// On a phone, in a production build, and outside the frame, it does nothing.
import { Platform } from "react-native";

type BridgeMessage =
	| { type: "wandit:bridge-ready" }
	| { type: "wandit:runtime-error"; message: string; stack?: string };

// The host drops a longer text, so the bridge cuts each text to these lengths.
const MESSAGE_MAX_LENGTH = 1000;
const STACK_MAX_LENGTH = 4000;

function post(message: BridgeMessage) {
	// The bridge does not know the host origin. The preview proxy lets only the wandit origins frame the app.
	window.parent.postMessage(message, "*");
}

/**
 * The first `max` UTF-16 units of `text`. A cut through an emoji leaves half a pair.
 * The database of the host refuses that text, so this function removes the half.
 */
function cut(text: string, max: number): string {
	return text.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
}

function postError(message: string, stack?: string) {
	// The stack frames name the dev server origin. Without it, the agent reads plain file paths.
	const shortStack =
		stack === undefined
			? undefined
			: cut(stack.replaceAll(window.location.origin, ""), STACK_MAX_LENGTH);
	post({
		type: "wandit:runtime-error",
		message: cut(message, MESSAGE_MAX_LENGTH) || "Unknown error",
		stack: shortStack,
	});
}

// React Native also has a `window` on a phone, with no parent and no listeners.
// So the platform check comes first.
if (Platform.OS === "web" && __DEV__ && window.parent !== window) {
	// The Expo HMR client throws a Metro compile error, so it arrives here too.
	window.addEventListener("error", (event) => {
		postError(
			event.message,
			event.error instanceof Error ? event.error.stack : undefined,
		);
	});

	window.addEventListener("unhandledrejection", (event) => {
		const reason: unknown = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason);
		const stack = reason instanceof Error ? reason.stack : undefined;
		postError(message, stack);
	});

	// Each page load runs this module again. The host then drops the errors of the old page.
	post({ type: "wandit:bridge-ready" });
}
