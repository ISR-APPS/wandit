import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { McpConnectorListItem } from "@wandit/contracts";
import { toast } from "sonner";

import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { CONNECT_COMPLETE_PATH } from "../lib/connect-completion";
import { connectorKeys } from "./connectors.queries";
import { disconnectConnector, startConnect } from "./connectors.services";

export function useConnectMutation() {
	const { t } = useTranslation();

	return useMutation({
		mutationFn: async (slug: string) => {
			const currentUrl = window.location.href;
			const { authorizeUrl } = await startConnect(
				slug,
				`${window.location.origin}${CONNECT_COMPLETE_PATH}`,
			);
			const popup = window.open("", "_blank");

			if (popup) {
				popup.opener = null;
				popup.location.href = authorizeUrl;
				return;
			}

			const fallback = await startConnect(slug, currentUrl);
			window.location.assign(fallback.authorizeUrl);
		},
		onError: (error) => {
			toast.error(
				isApiClientError(error) && error.statusCode === 503
					? t("projects.connectors.notConfigured")
					: getApiErrorMessage(error),
			);
		},
	});
}

export function useDisconnectMutation() {
	const queryClient = useQueryClient();
	const { t } = useTranslation();

	return useMutation({
		mutationFn: disconnectConnector,
		onSuccess: (disconnectedConnector) => {
			queryClient.setQueryData<McpConnectorListItem[]>(
				connectorKeys.list(),
				(connectors) =>
					connectors?.map((connector) =>
						connector.slug === disconnectedConnector.slug
							? disconnectedConnector
							: connector,
					),
			);
			toast.success(t("projects.connectors.disconnectedToast"));
		},
		onError: (error) => {
			toast.error(getApiErrorMessage(error));
		},
	});
}
