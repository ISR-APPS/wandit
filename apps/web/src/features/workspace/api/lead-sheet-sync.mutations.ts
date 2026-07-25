// TanStack Query mutation wrapping lead-sheet-sync.services.ts: the server
// answers a sync with the fresh state (sheet URL, count, timestamp), so
// onSuccess writes it straight into the cache — no optimistic update and no
// invalidation round-trip needed.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { sheetSyncKeys } from "./lead-sheet-sync.queries";
import { syncSheetNow } from "./lead-sheet-sync.services";

export function useSyncSheetNow(projectId: string) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	return useMutation({
		mutationFn: () => syncSheetNow(projectId),
		onSuccess: (state) => {
			queryClient.setQueryData(sheetSyncKeys.state(projectId), state);
			toast.success(
				t("leads.sheetSync.syncedToast", {
					count: state.sheet?.syncedLeadCount ?? 0,
				}),
			);
		},
		onError: (error) => {
			// The server's 409s are actionable ("reconnect Google Sheets…",
			// Google's own refusal text) — show them; anything opaque gets the
			// sheet-specific fallback.
			toast.error(
				isApiClientError(error) && error.hasServerEnvelopeMessage
					? getApiErrorMessage(error)
					: t("leads.sheetSync.errorToast"),
			);
		},
	});
}
