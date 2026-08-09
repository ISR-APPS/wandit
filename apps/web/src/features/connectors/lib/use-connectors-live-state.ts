import { useQueryClient } from "@tanstack/react-query";
import type { McpConnectorListItem } from "@wandit/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { connectorKeys } from "../api/connectors.queries";
import {
	isMcpConnectMessage,
	MCP_CONNECTORS_CHANNEL,
} from "./connect-completion";

const CONNECTING_TIMEOUT_MS = 5 * 60 * 1_000;

export function useConnectorsLiveState({
	connectors,
	open,
}: {
	connectors: McpConnectorListItem[] | undefined;
	open: boolean;
}) {
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const [connectingSlugs, setConnectingSlugs] = useState<Set<string>>(
		() => new Set(),
	);
	const timeoutIdsRef = useRef(new Map<string, number>());
	const openRef = useRef(open);
	openRef.current = open;

	const clearConnecting = useCallback((slug: string) => {
		const timeoutId = timeoutIdsRef.current.get(slug);

		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId);
			timeoutIdsRef.current.delete(slug);
		}

		setConnectingSlugs((current) => {
			if (!current.has(slug)) {
				return current;
			}

			const next = new Set(current);
			next.delete(slug);
			return next;
		});
	}, []);

	const clearAllConnecting = useCallback(() => {
		for (const timeoutId of timeoutIdsRef.current.values()) {
			window.clearTimeout(timeoutId);
		}
		timeoutIdsRef.current.clear();
		setConnectingSlugs((current) => (current.size === 0 ? current : new Set()));
	}, []);

	const startConnecting = useCallback(
		(slug: string) => {
			const existingTimeoutId = timeoutIdsRef.current.get(slug);
			if (existingTimeoutId !== undefined) {
				window.clearTimeout(existingTimeoutId);
			}

			setConnectingSlugs((current) => {
				if (current.has(slug)) {
					return current;
				}

				const next = new Set(current);
				next.add(slug);
				return next;
			});

			timeoutIdsRef.current.set(
				slug,
				window.setTimeout(() => clearConnecting(slug), CONNECTING_TIMEOUT_MS),
			);
		},
		[clearConnecting],
	);

	useEffect(() => {
		for (const connector of connectors ?? []) {
			if (connector.status === "connected") {
				clearConnecting(connector.slug);
			}
		}
	}, [clearConnecting, connectors]);

	useEffect(() => {
		if (!open) {
			clearAllConnecting();
		}
	}, [clearAllConnecting, open]);

	useEffect(
		() => () => {
			for (const timeoutId of timeoutIdsRef.current.values()) {
				window.clearTimeout(timeoutId);
			}
			timeoutIdsRef.current.clear();
		},
		[],
	);

	useEffect(() => {
		const channel = new BroadcastChannel(MCP_CONNECTORS_CHANNEL);
		const handleMessage = (event: MessageEvent<unknown>) => {
			if (!isMcpConnectMessage(event.data)) {
				return;
			}

			void queryClient.invalidateQueries({
				queryKey: connectorKeys.list(),
			});

			if (openRef.current) {
				switch (event.data.outcome) {
					case "success":
						toast.success(t("projects.connectors.successToast"));
						break;
					case "denied":
						toast.error(t("projects.connectors.deniedToast"));
						break;
					case "invalid_state":
						toast.error(t("projects.connectors.invalidStateToast"));
						break;
					case "failed":
						toast.error(t("projects.connectors.failedToast"));
						break;
				}
			}

			if (event.data.slug) {
				clearConnecting(event.data.slug);
			} else {
				clearAllConnecting();
			}
		};

		channel.addEventListener("message", handleMessage);

		return () => {
			channel.removeEventListener("message", handleMessage);
			channel.close();
		};
	}, [clearAllConnecting, clearConnecting, queryClient, t]);

	return {
		clearAllConnecting,
		clearConnecting,
		connectingSlugs,
		startConnecting,
	};
}
