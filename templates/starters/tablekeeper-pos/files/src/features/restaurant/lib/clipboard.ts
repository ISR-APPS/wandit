// Copies a text to the clipboard and tells the user the result with a toast.
// The "Copy ID" and "Copy email" items of the table row menus call it in their select handler.
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
