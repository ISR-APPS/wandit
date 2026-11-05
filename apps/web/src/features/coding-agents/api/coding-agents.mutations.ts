/**
 * TanStack mutations of the coding-agents feature. The connected-agents list calls the revoke mutation.
 * It calls coding-agents.services.ts and reads the list again after each revoke.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { codingAgentKeys } from "./coding-agents.queries";
import { revokeConnectedAgent } from "./coding-agents.services";

/** Revokes one coding agent by its consent id. The list reads again, also after a failure. */
export function useRevokeConnectedAgentMutation() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	return useMutation({
		mutationKey: [...codingAgentKeys.list(), "revoke"],
		mutationFn: revokeConnectedAgent,
		onSuccess: () => {
			toast.success(t("auth.codingAgents.revoke.done"));
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
		// A 404 means that another tab revoked the agent first. So the list reads again after a failure too.
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: codingAgentKeys.list() }),
	});
}
