// Copies a text to the clipboard and tells the user the result with a toast.
// The "Copy link" items of the row menus and the file page call it in their select or click handler.
import { toast } from "sonner";

/** `messages` are translated: `done` after a copy, `failed` when the browser refuses the clipboard. */
export async function copyToClipboard(
	text: string,
	messages: { done: string; failed: string },
): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(messages.done);
	} catch (error) {
		// A page without focus or without the clipboard permission rejects the write. The user can copy by hand.
		console.warn("clipboard write failed", error);
		toast.error(messages.failed);
	}
}

/** The full URL of the page of one file. The "Copy link" items put it on the clipboard. */
export function fileUrl(fileId: string): string {
	return new URL(
		`/app/files/${encodeURIComponent(fileId)}`,
		window.location.origin,
	).href;
}

/** The full URL of one folder in the Files page. The folder id goes in the `folder` search param. */
export function folderUrl(folderId: string): string {
	return new URL(
		`/app/files?folder=${encodeURIComponent(folderId)}`,
		window.location.origin,
	).href;
}
