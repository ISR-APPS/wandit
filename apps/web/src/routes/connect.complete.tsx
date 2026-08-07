import { createFileRoute } from "@tanstack/react-router";
import {
	MCP_CONNECTED_PARAM,
	MCP_CONNECTOR_PARAM,
	MCP_ERROR_PARAM,
} from "@wandit/contracts";
import { useEffect } from "react";

import {
	MCP_CONNECTORS_CHANNEL,
	type McpConnectMessage,
	type McpConnectOutcome,
} from "@/features/connectors/lib/connect-completion";
import { pageTitle, useTranslation } from "@/lib/i18n";

type ConnectCompleteSearch = {
	app_connected?: string;
	app_connector?: string;
	app_error?: string;
};

export const Route = createFileRoute("/connect/complete")({
	validateSearch: (search: Record<string, unknown>): ConnectCompleteSearch => ({
		[MCP_CONNECTED_PARAM]: searchValue(search[MCP_CONNECTED_PARAM]),
		[MCP_CONNECTOR_PARAM]: searchValue(search[MCP_CONNECTOR_PARAM]),
		[MCP_ERROR_PARAM]: searchValue(search[MCP_ERROR_PARAM]),
	}),
	head: () => ({
		meta: [{ title: pageTitle("projects.connectors.completeTitle") }],
	}),
	component: ConnectCompleteRoute,
});

function ConnectCompleteRoute() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const connectedSlug = search[MCP_CONNECTED_PARAM];
	const error = search[MCP_ERROR_PARAM];
	const slug = connectedSlug ?? search[MCP_CONNECTOR_PARAM] ?? null;
	const hasResult = Boolean(connectedSlug || error || slug);
	const outcome: McpConnectOutcome = connectedSlug
		? "success"
		: error === "access_denied"
			? "denied"
			: error === "invalid_state"
				? "invalid_state"
				: "failed";

	useEffect(() => {
		if (!hasResult) {
			return;
		}

		const channel = new BroadcastChannel(MCP_CONNECTORS_CHANNEL);
		channel.postMessage({ outcome, slug } satisfies McpConnectMessage);
		channel.close();
		window.close();
	}, [hasResult, outcome, slug]);

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-6">
			<section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				<h1 className="font-display font-semibold text-2xl tracking-tight">
					{t("projects.connectors.completeTitle")}
				</h1>
				<p className="mt-3 text-muted-foreground text-sm">
					{outcome === "success"
						? t("projects.connectors.completeConnected")
						: t("projects.connectors.completeError")}
				</p>
				<p className="mt-6 text-muted-foreground text-xs">
					{t("projects.connectors.completeCloseHint")}
				</p>
			</section>
		</main>
	);
}

function searchValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
