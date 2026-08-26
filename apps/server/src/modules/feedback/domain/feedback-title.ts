const TITLE_MAX_LENGTH = 70;

/** Builds the short message title used by Linear and the admin panel. */
export function feedbackTitle(message: string): string {
	const oneLine = message.replace(/\s+/g, " ").trim();

	return oneLine.length > TITLE_MAX_LENGTH
		? `${oneLine.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`
		: oneLine;
}
