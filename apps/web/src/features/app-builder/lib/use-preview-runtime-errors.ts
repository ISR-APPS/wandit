/**
 * The runtime errors that the dev bridge of the app in the preview posted
 * (WANDIT-173). WebPreview and PhonePreview call the hook. PreviewErrorBanner
 * shows the list and sends the "Try to fix" chat message that `tryToFixMessage`
 * builds. When a turn ends with errors in the list, the hook asks for a reload
 * of the frame. The preview clears the list when the new page of the app says ready.
 */

import {
	type PreviewBridgeMessage,
	projectPromptMaxLength,
} from "@wandit/contracts";
import { useState } from "react";

/** One error that the bridge posted: an uncaught error, a rejected promise, or a `console.error` call. */
export type PreviewRuntimeError = Omit<
	Extract<PreviewBridgeMessage, { type: "wandit:runtime-error" }>,
	"type"
>;

/** The errors since the last clear. */
export type PreviewRuntimeErrors = {
	/** The first error, then the newest ones, oldest first. At most `ERRORS_KEPT`. */
	errors: PreviewRuntimeError[];
	/** New errors since the last clear. An error that left `errors` counts again when it comes back. */
	count: number;
};

// "Try to fix" names at most 5 errors: the first one is often the cause,
// and the newest ones show the state of the app now.
const ERRORS_KEPT = 5;

// 5 errors of 300 characters and the intro sentence stay under the 2000
// characters that the turn route accepts.
const ERROR_TEXT_MAX_LENGTH = 300;

const NO_ERRORS: PreviewRuntimeErrors = { errors: [], count: 0 };

/** Adds `error` unless the same message is in the list. Keeps the first error and the newest ones. */
function withError(
	current: PreviewRuntimeErrors,
	error: PreviewRuntimeError,
): PreviewRuntimeErrors {
	// A render loop posts the same error many times; it counts once.
	if (current.errors.some((kept) => kept.message === error.message)) {
		return current;
	}
	const errors = [...current.errors, error];
	// Over the limit the second error drops. The first stays: it is often the cause.
	if (errors.length > ERRORS_KEPT) errors.splice(1, 1);
	return { errors, count: current.count + 1 };
}

/**
 * Holds the error list of one preview. `isTurnRunning` comes from the page.
 * When a turn ends with errors, `ownReloads` grows by one. The preview adds it
 * to its reload key, so the frame loads the app again. The list stays until the
 * new page says ready. So a page that cannot start (a compile error) still shows
 * the errors of the turn.
 */
export function usePreviewRuntimeErrors(isTurnRunning: boolean) {
	const [state, setState] = useState(NO_ERRORS);
	const [wasTurnRunning, setWasTurnRunning] = useState(isTurnRunning);
	const [ownReloads, setOwnReloads] = useState(0);
	// True from an own reload until the new page loads. Then the banner shows only the
	// errors of the final code. When the new page cannot start, it shows the kept errors.
	const [isReloadPending, setIsReloadPending] = useState(false);
	if (isTurnRunning !== wasTurnRunning) {
		setWasTurnRunning(isTurnRunning);
		// A turn changes the app, and an error during a turn can come from a
		// half-written file. A reload at the end keeps only the errors of the final code.
		if (!isTurnRunning && state.count > 0) {
			setOwnReloads((count) => count + 1);
			setIsReloadPending(true);
		}
	}
	return {
		...state,
		/** Reloads that this hook asked for. The preview adds them to the reload key of the page. */
		ownReloads,
		/** False while a turn runs and until its reload loads: those errors are not final. */
		isBannerShown: !isTurnRunning && !isReloadPending,
		add: (error: PreviewRuntimeError) =>
			setState((current) => withError(current, error)),
		clear: () => setState(NO_ERRORS),
		/** The preview passes it to the `load` event of the iframe. */
		onFrameLoad: () => setIsReloadPending(false),
	};
}

/**
 * The chat message of "Try to fix": `intro`, then one fenced block with one
 * numbered entry per error: its message and the stack lines below it.
 */
export function tryToFixMessage(
	intro: string,
	errors: PreviewRuntimeError[],
): string {
	const blocks = errors.map((error, index) => {
		const stackLines = (error.stack ?? "")
			.split("\n")
			.map((line) => line.trim())
			// The first stack line of V8 repeats the message, so it drops.
			.filter(
				(line, lineIndex) =>
					line.length > 0 && !(lineIndex === 0 && line.includes(error.message)),
			);
		// The app controls this text. Without a fence mark it cannot end the block and pose as the user.
		const text = [error.message, ...stackLines]
			.join("\n")
			.replaceAll("```", "'''");
		return `${index + 1}. ${text.slice(0, ERROR_TEXT_MAX_LENGTH)}`;
	});
	// The turn route refuses a longer message. The app text or a cut can hold
	// half of a UTF-16 pair; Postgres refuses it, so each one becomes U+FFFD.
	return `${intro}\n\n\`\`\`\n${blocks.join("\n\n")}\n\`\`\``
		.slice(0, projectPromptMaxLength)
		.replace(/\p{Cs}/gu, "\uFFFD");
}
