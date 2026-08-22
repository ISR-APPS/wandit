import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	MCP_CODE_PARAM,
	MCP_ERROR_PARAM,
	MCP_STATE_PARAM,
	type McpConnectorListItem,
} from "@wandit/contracts";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { connectorKeys } from "./connectors.queries";
import {
	completeConnect,
	disconnectConnector,
	startConnect,
} from "./connectors.requests";

/**
 * connectors.mutations.ts — the native OAuth round-trip.
 *
 * Unlike the web (popup + BroadcastChannel), the whole flow awaits inside one
 * mutation: the system auth browser closes itself when the server callback
 * 302s to our deep link, and openAuthSessionAsync resolves with that URL.
 */

export type ConnectOutcome =
	| "success" // tokens stored, connector now connected
	| "denied" // the user refused on the provider's consent screen
	| "dismissed" // the user closed the auth browser before finishing
	| "invalid_state" // stale/expired connect attempt
	| "failed"; // exchange or transport failure

export type ConnectResult = {
	outcome: ConnectOutcome;
	slug: string;
};

export function useConnectMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (slug: string): Promise<ConnectResult> => {
			// exp://…/--/connect/complete in Expo Go, wandit://connect/complete in
			// release builds — both allowlisted server-side next to the web origin.
			const returnUrl = Linking.createURL("connect/complete");
			const { authorizeUrl } = await startConnect(slug, returnUrl);

			const result = await WebBrowser.openAuthSessionAsync(
				authorizeUrl,
				returnUrl,
			);

			if (result.type !== "success") {
				return { outcome: "dismissed", slug };
			}

			// URL.searchParams, not Linking.parse: expo-linking decodes values a
			// second time, corrupting opaque authorization codes that contain
			// percent sequences.
			const params = parseQueryParams(result.url);
			const oauthError = params.get(MCP_ERROR_PARAM);

			if (oauthError) {
				return {
					outcome:
						oauthError === "access_denied"
							? "denied"
							: oauthError === "invalid_state"
								? "invalid_state"
								: "failed",
					slug,
				};
			}

			const code = params.get(MCP_CODE_PARAM);
			const state = params.get(MCP_STATE_PARAM);

			if (!code || !state) {
				return { outcome: "failed", slug };
			}

			const connector = await completeConnect({ code, state });
			replaceListItem(queryClient.setQueryData.bind(queryClient), connector);

			return { outcome: "success", slug };
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: connectorKeys.list() });
		},
	});
}

export function useDisconnectMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: disconnectConnector,
		onSuccess: async (disconnected) => {
			// An in-flight list GET started before the disconnect would overwrite
			// the patched cache with stale "connected" data — cancel it first.
			await queryClient.cancelQueries({ queryKey: connectorKeys.list() });
			replaceListItem(queryClient.setQueryData.bind(queryClient), disconnected);
		},
	});
}

function replaceListItem(
	setQueryData: (
		key: readonly unknown[],
		updater: (
			current: McpConnectorListItem[] | undefined,
		) => McpConnectorListItem[] | undefined,
	) => unknown,
	item: McpConnectorListItem,
) {
	setQueryData(connectorKeys.list(), (connectors) =>
		connectors?.map((connector) =>
			connector.slug === item.slug ? item : connector,
		),
	);
}

function parseQueryParams(url: string): URLSearchParams {
	try {
		return new URL(url).searchParams;
	} catch {
		// Custom-scheme URLs that the URL polyfill refuses (wandit://…) — fall
		// back to slicing the query string manually.
		const queryStart = url.indexOf("?");
		return new URLSearchParams(
			queryStart >= 0 ? url.slice(queryStart + 1) : "",
		);
	}
}
