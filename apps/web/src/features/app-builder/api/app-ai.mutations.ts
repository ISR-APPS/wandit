/**
 * The key write of the AI panel of the More view: turn on, rotate, or turn
 * off the app AI gateway. It calls app-ai.services.ts, then refreshes the AI
 * status and the secret list. Called by components/more/ai-panel.tsx.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppAiStatus } from "@wandit/contracts";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { appAiKeys } from "./app-ai.queries";
import { disableAppAi, enableAppAi, rotateAppAiKey } from "./app-ai.services";
import { cloudKeys } from "./cloud.queries";

/** A key write of the AI panel. Each one asks for a confirm first. */
export type AppAiKeyAction = "enable" | "rotate" | "disable";

/**
 * Runs one key write and puts the new status in the cache at once. The
 * mutation answers the status, or null after a disable (204 with no body).
 * The error toast shows the mapped API code, for example `BACKEND_PAUSED`.
 */
export function useChangeAppAiKey(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: [...appAiKeys.status(projectId), "change"],
		mutationFn: async (action: AppAiKeyAction): Promise<AppAiStatus | null> => {
			switch (action) {
				case "enable":
					return enableAppAi(projectId);
				case "rotate":
					return rotateAppAiKey(projectId);
				case "disable":
					await disableAppAi(projectId);
					return null;
				default: {
					// The compiler fails here when AppAiKeyAction gains a value without a case above.
					const unhandled: never = action;
					return unhandled;
				}
			}
		},
		onSuccess: (status) => {
			// Write the answer now. Before a refetch ends, a click on "Rotate key"
			// after "Turn off" turns the gateway on again.
			queryClient.setQueryData<AppAiStatus>(
				appAiKeys.status(projectId),
				(old) =>
					status ?? (old && { ...old, enabled: false, keyUpdatedAt: null }),
			);
			// The key is a `system` row of the project secrets, so the Secrets panel list changes too.
			void queryClient.invalidateQueries({
				queryKey: cloudKeys.secrets(projectId),
			});
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}
