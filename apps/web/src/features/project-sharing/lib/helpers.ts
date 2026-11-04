/**
 * Helpers of the Share dialog: the email field split and the clipboard
 * write. Called by components/share-dialog.tsx.
 */

/**
 * Splits the invite field into emails on commas, semicolons, spaces, and new
 * lines. Empty parts drop out. The contract schema then checks each email.
 */
export function splitEmails(text: string): string[] {
	return text.split(/[\s,;]+/).filter((part) => part !== "");
}

/**
 * Writes text to the clipboard. False, with a console error, when the browser
 * refuses. A copy of the app-builder helper: that feature barrel does not export it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		// The browser refuses the clipboard outside a user gesture or a secure origin.
		console.error("Copy to the clipboard failed", error);
		return false;
	}
}
