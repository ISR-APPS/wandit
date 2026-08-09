import { useRouter } from "@tanstack/react-router";
import {
	MCP_CONNECTED_PARAM,
	MCP_CONNECTOR_PARAM,
	MCP_ERROR_PARAM,
} from "@wandit/contracts";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { CONNECT_COMPLETE_PATH } from "../lib/connect-completion";

export function useConnectReturnToast() {
	const router = useRouter();
	const { t } = useTranslation();
	const handledRef = useRef(false);

	useEffect(() => {
		if (
			handledRef.current ||
			window.location.pathname === CONNECT_COMPLETE_PATH
		) {
			return;
		}

		const search = new URLSearchParams(window.location.search);
		const hasConnected = search.has(MCP_CONNECTED_PARAM);
		const hasConnector = search.has(MCP_CONNECTOR_PARAM);
		const hasError = search.has(MCP_ERROR_PARAM);

		if (!hasConnected && !hasConnector && !hasError) {
			return;
		}

		handledRef.current = true;

		if (hasConnected) {
			toast.success(t("projects.connectors.successToast"));
		} else if (search.get(MCP_ERROR_PARAM) === "access_denied") {
			toast.error(t("projects.connectors.deniedToast"));
		} else if (search.get(MCP_ERROR_PARAM) === "invalid_state") {
			toast.error(t("projects.connectors.invalidStateToast"));
		} else {
			toast.error(t("projects.connectors.failedToast"));
		}

		search.delete(MCP_CONNECTED_PARAM);
		search.delete(MCP_CONNECTOR_PARAM);
		search.delete(MCP_ERROR_PARAM);

		const nextSearch = search.toString();
		router.history.replace(
			`${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
			router.history.location.state,
		);
	}, [router, t]);
}
