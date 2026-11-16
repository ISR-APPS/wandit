// The accent full stop that closes the wordmark, the page title, and each section title.
// Wordmark and the section components render it directly after their text.
// It is punctuation, not a message, so it has no key in messages.ts.

/** One full stop in the accent color. It is the only ornament of the page. */
export function AccentDot() {
	return <span className="text-primary">.</span>;
}
