/**
 * Our own successful save preserves any edits recorded after its request
 * snapshot. Once overview observes that new version, those edits are based on
 * the version we just created (wids remain stable across our own save).
 */
export function nextBaseVersionAfterOwnSave(
	activeVersionId: string,
	dirtyCount: number,
): string | null {
	return dirtyCount > 0 ? activeVersionId : null;
}

/**
 * Overview polling can observe our committed version before save() finishes
 * marking it in ownVersionIds. While a save promise is in flight, defer
 * foreign/own classification until that promise settles.
 */
export function shouldDeferVersionChangeWhileSaving(
	saveInFlight: boolean,
): boolean {
	return saveInFlight;
}

/** Pending changes belong to latest and must not act on an unseen canvas. */
export function shouldShowSaveBar(
	dirtyCount: number,
	isPreviewingHistorical: boolean,
): boolean {
	return dirtyCount > 0 && !isPreviewingHistorical;
}

/** Radix layers preventDefault when they consume Escape but still bubble it. */
export function shouldHandleWindowEscape(
	event: Pick<KeyboardEvent, "defaultPrevented" | "key">,
): boolean {
	return event.key === "Escape" && !event.defaultPrevented;
}

/** Physical KeyK keeps Cmd/Ctrl+K stable across keyboard layouts. */
export function isKeyKShortcut(
	event: Pick<KeyboardEvent, "code" | "key">,
): boolean {
	return event.code === "KeyK" || event.key.toLowerCase() === "k";
}
