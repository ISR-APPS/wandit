/**
 * Hooks of the workspaces feature that are not queries or mutations.
 * The People page sections call `useCopyLink` for invite and invitation links.
 */
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";

/** Copies a link and shows a toast. The browser can refuse, so a failure shows its own toast. */
export function useCopyLink(): (url: string) => Promise<void> {
	const { t } = useTranslation();

	return async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			toast.success(t("workspaces.people.linkCopied"));
		} catch (error) {
			// The browser refuses the clipboard outside a secure origin or a user gesture.
			console.error("Copy to the clipboard failed", error);
			toast.error(t("workspaces.people.copyFailed"));
		}
	};
}
