/**
 * Long pastes of the V2 prompt boxes. A long paste becomes a text chip, as in
 * other chat apps, and goes with the message. The dashboard prompt box and the
 * V2 builder composer call these helpers. They call no other module.
 */

import type { ClipboardEvent } from "react";

import type { Locale } from "@/lib/i18n";

/** One text chip of the next message. Client state only: the text is not uploaded. */
export type PastedText = {
	/** Local id of the chip, from `crypto.randomUUID`. */
	id: string;
	/** The full pasted text, as the clipboard gave it. */
	text: string;
};

// 2,000 chars, the old message limit: a paste that did not fit before becomes a chip.
const PASTED_TEXT_CHIP_MIN_LENGTH = 2_000;

// The chip shows only the start. A 50K-char line in the chip slows the layout for nothing.
const PREVIEW_LENGTH = 80;

/**
 * Returns the plain text of a paste that is long enough for a chip, or null.
 * On null the caller lets the browser put the paste into the textarea.
 */
export function readLongPaste(
	event: ClipboardEvent<HTMLTextAreaElement>,
): string | null {
	const text = event.clipboardData.getData("text/plain");
	// A blank chip sends a blank message, and the turn route refuses that.
	if (text.length < PASTED_TEXT_CHIP_MIN_LENGTH || text.trim() === "") {
		return null;
	}
	return text;
}

/**
 * The message a prompt box sends: the trimmed typed text first, then each
 * chip text, with a blank line between blocks. An empty typed text is skipped.
 */
export function joinPastedText(
	typed: string,
	pastedTexts: readonly PastedText[],
): string {
	const blocks = pastedTexts.map((pasted) => pasted.text);
	const trimmed = typed.trim();
	return (trimmed === "" ? blocks : [trimmed, ...blocks]).join("\n\n");
}

/**
 * The two texts of a chip: the start of the text, and its length in compact
 * digits of the UI locale ("2K" in English, "2 k" in French).
 */
export function describePastedText(
	text: string,
	locale: Locale,
): { preview: string; size: string } {
	return {
		preview: text.trim().slice(0, PREVIEW_LENGTH),
		size: new Intl.NumberFormat(locale, { notation: "compact" }).format(
			text.length,
		),
	};
}
