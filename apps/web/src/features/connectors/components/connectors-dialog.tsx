import type { McpConnectorListItem } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { Input } from "@wandit/ui/components/input";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Check, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import {
	useConnectMutation,
	useDisconnectMutation,
} from "../api/connectors.mutations";
import { useConnectorsQuery } from "../api/connectors.queries";
import { useConnectorsLiveState } from "../lib/use-connectors-live-state";

type ConnectorsDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function ConnectorsDialog({
	open,
	onOpenChange,
}: ConnectorsDialogProps) {
	const { t } = useTranslation();
	const [searchValue, setSearchValue] = useState("");
	const connectors = useConnectorsQuery({ enabled: open });
	const connect = useConnectMutation();
	const disconnect = useDisconnectMutation();
	const {
		clearAllConnecting,
		clearConnecting,
		connectingSlugs,
		startConnecting,
	} = useConnectorsLiveState({
		connectors: connectors.data,
		open,
	});
	const normalizedSearch = searchValue.trim().toLowerCase();
	const filteredConnectors = (connectors.data ?? []).filter(
		(connector) =>
			connector.name.toLowerCase().includes(normalizedSearch) ||
			connector.description.toLowerCase().includes(normalizedSearch),
	);

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);

		if (!nextOpen) {
			clearAllConnecting();
			window.setTimeout(() => setSearchValue(""), 150);
		}
	};

	const handleConnect = (slug: string) => {
		startConnecting(slug);
		connect.mutate(slug, {
			onError: () => clearConnecting(slug),
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
				closeLabel={t("common.close")}
			>
				<DialogHeader>
					<DialogTitle className="font-display">
						{t("projects.connectors.title")}
					</DialogTitle>
					<DialogDescription>
						{t("projects.connectors.description")}
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={searchValue}
						onChange={(event) => setSearchValue(event.target.value)}
						className="ps-9"
						placeholder={t("projects.connectors.searchPlaceholder")}
						aria-label={t("projects.connectors.searchPlaceholder")}
					/>
				</div>

				<div
					className="flex flex-col gap-2"
					aria-live="polite"
					aria-busy={connectors.isPending}
				>
					{connectors.isPending ? (
						<>
							<Skeleton className="h-16 rounded-lg" />
							<Skeleton className="h-16 rounded-lg" />
							<Skeleton className="h-16 rounded-lg" />
						</>
					) : null}

					{!connectors.isPending && connectors.isError ? (
						<div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
							<p className="text-destructive">
								{getApiErrorMessage(connectors.error)}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => void connectors.refetch()}
							>
								{t("projects.connectors.retry")}
							</Button>
						</div>
					) : null}

					{!connectors.isPending &&
					!connectors.isError &&
					filteredConnectors.length === 0 ? (
						<p className="py-6 text-center text-muted-foreground text-sm">
							{t("projects.connectors.noResults")}
						</p>
					) : null}

					{!connectors.isPending && !connectors.isError
						? filteredConnectors.map((connector) => (
								<ConnectorRow
									key={connector.slug}
									connector={connector}
									connecting={connectingSlugs.has(connector.slug)}
									disconnecting={
										disconnect.isPending &&
										disconnect.variables === connector.slug
									}
									connectDisabled={
										connectingSlugs.has(connector.slug) ||
										connect.isPending ||
										disconnect.isPending
									}
									onConnect={() => handleConnect(connector.slug)}
									onDisconnect={() => disconnect.mutate(connector.slug)}
								/>
							))
						: null}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ConnectorRow({
	connector,
	connecting,
	disconnecting,
	connectDisabled,
	onConnect,
	onDisconnect,
}: {
	connector: McpConnectorListItem;
	connecting: boolean;
	disconnecting: boolean;
	connectDisabled: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-3 rounded-lg border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
			<div className="flex min-w-0 items-center gap-3">
				<ConnectorIcon connector={connector} />
				<div className="min-w-0">
					<p dir="auto" className="truncate font-medium text-sm">
						{connector.name}
					</p>
					<p dir="auto" className="line-clamp-2 text-muted-foreground text-xs">
						{connector.description}
					</p>
				</div>
			</div>

			<div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
				{connector.status === "not_connected" ? (
					connector.available ? (
						<Button
							type="button"
							size="sm"
							disabled={connectDisabled}
							onClick={onConnect}
						>
							{connecting ? <Loader2 className="size-4 animate-spin" /> : null}
							{connecting
								? t("projects.connectors.connecting")
								: t("projects.connectors.connect")}
						</Button>
					) : (
						<span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-muted-foreground text-xs">
							{t("projects.connectors.comingSoon")}
						</span>
					)
				) : null}

				{connector.status === "connected" ? (
					<>
						<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
							<Check className="size-4 text-primary" />
							{t("projects.connectors.connected")}
						</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={connectDisabled}
							onClick={onDisconnect}
						>
							{disconnecting ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{t("projects.connectors.disconnect")}
						</Button>
					</>
				) : null}

				{connector.status === "expired" ? (
					<>
						<span className="text-amber-600 text-xs dark:text-amber-400">
							{t("projects.connectors.expired")}
						</span>
						<Button
							type="button"
							size="sm"
							disabled={connectDisabled}
							onClick={onConnect}
						>
							{connecting ? <Loader2 className="size-4 animate-spin" /> : null}
							{connecting
								? t("projects.connectors.connecting")
								: t("projects.connectors.reconnect")}
						</Button>
					</>
				) : null}
			</div>
		</div>
	);
}

function ConnectorIcon({ connector }: { connector: McpConnectorListItem }) {
	return (
		<span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/60 font-medium text-muted-foreground text-sm">
			{connector.iconUrl ? (
				<img
					src={connector.iconUrl}
					alt=""
					className="size-full object-cover"
				/>
			) : (
				<span aria-hidden>{connector.name.trim().charAt(0).toUpperCase()}</span>
			)}
		</span>
	);
}
