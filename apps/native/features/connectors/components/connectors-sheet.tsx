import type { McpConnectorListItem } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import { isApiClientError } from "@/shared/lib/api-client";
import { AppBottomSheet } from "@/shared/ui/bottom-sheet";
import {
	type ConnectOutcome,
	useConnectMutation,
	useDisconnectMutation,
} from "../api/connectors.mutations";
import { useConnectors } from "../api/connectors.queries";

type ConnectorsSheetProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * Connect apps — the native twin of the web ConnectorsDialog. Lists the MCP
 * connector catalog with per-row status (Connect / Connecting… / Connected +
 * Disconnect / Expired + Reconnect / Coming soon) and runs the OAuth flow in
 * the system auth browser.
 */
export function ConnectorsSheet({
	isOpen,
	onOpenChange,
}: ConnectorsSheetProps) {
	const { t } = useTranslation();
	const accent = useThemeColor("accent");
	const connectors = useConnectors({ enabled: isOpen });
	const connect = useConnectMutation();
	const disconnect = useDisconnectMutation();
	const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
	const [notice, setNotice] = useState<{
		kind: "success" | "error";
		text: string;
	} | null>(null);

	const busy = connectingSlug !== null || disconnect.isPending;

	const noticeForOutcome = (outcome: ConnectOutcome): typeof notice => {
		switch (outcome) {
			case "success":
				return { kind: "success", text: t("projects.connectors.successToast") };
			case "denied":
				return { kind: "error", text: t("projects.connectors.deniedToast") };
			case "invalid_state":
				return {
					kind: "error",
					text: t("projects.connectors.invalidStateToast"),
				};
			case "dismissed":
				return null;
			case "failed":
				return { kind: "error", text: t("projects.connectors.failedToast") };
		}
	};

	const handleConnect = (slug: string) => {
		setNotice(null);
		setConnectingSlug(slug);
		connect.mutate(slug, {
			onSuccess: ({ outcome }) => setNotice(noticeForOutcome(outcome)),
			onError: (error) =>
				setNotice({
					kind: "error",
					text:
						isApiClientError(error) && error.statusCode === 503
							? t("projects.connectors.notConfigured")
							: t("projects.connectors.failedToast"),
				}),
			onSettled: () => setConnectingSlug(null),
		});
	};

	const handleDisconnect = (slug: string) => {
		setNotice(null);
		disconnect.mutate(slug, {
			onSuccess: () =>
				setNotice({
					kind: "success",
					text: t("projects.connectors.disconnectedToast"),
				}),
			onError: () =>
				setNotice({
					kind: "error",
					text: t("projects.connectors.failedToast"),
				}),
		});
	};

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (!nextOpen) setNotice(null);
	};

	return (
		<AppBottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
			<AppBottomSheet.Portal>
				<AppBottomSheet.Overlay />
				<AppBottomSheet.Content
					backgroundClassName="bg-background rounded-t-[26px]"
					handleIndicatorClassName="w-[42px] bg-foreground/15"
					contentContainerClassName="px-4 pb-12"
				>
					<Text className="font-display text-[19px] text-foreground">
						{t("projects.connectors.title")}
					</Text>
					<Text className="mt-1 text-[13px] text-muted leading-[18px]">
						{t("projects.connectors.description")}
					</Text>

					{notice ? (
						<View
							className={`mt-3 rounded-[12px] border px-3 py-2.5 ${
								notice.kind === "success"
									? "border-success/35 bg-success/10"
									: "border-danger/35 bg-danger/10"
							}`}
						>
							<Text className="text-[12.5px] text-foreground/90">
								{notice.text}
							</Text>
						</View>
					) : null}

					<View className="mt-4 gap-2.5">
						{connectors.isPending ? (
							<View className="items-center py-8">
								<ActivityIndicator size="small" color={accent} />
							</View>
						) : null}

						{!connectors.isPending && connectors.isError ? (
							<View className="flex-row items-center justify-between gap-3 rounded-[14px] border border-danger/35 bg-danger/10 px-3.5 py-3">
								<Text className="flex-1 text-[13px] text-foreground/90">
									{t("projects.connectors.failedToast")}
								</Text>
								<Pressable
									accessibilityRole="button"
									onPress={() => void connectors.refetch()}
									className="rounded-full border border-border px-3 py-1.5 active:scale-95"
								>
									<Text className="font-sans-semibold text-[12.5px] text-foreground">
										{t("projects.connectors.retry")}
									</Text>
								</Pressable>
							</View>
						) : null}

						{(connectors.data ?? []).map((connector) => (
							<ConnectorRow
								key={connector.slug}
								connector={connector}
								connecting={connectingSlug === connector.slug}
								disconnecting={
									disconnect.isPending &&
									disconnect.variables === connector.slug
								}
								actionsDisabled={busy}
								onConnect={() => handleConnect(connector.slug)}
								onDisconnect={() => handleDisconnect(connector.slug)}
							/>
						))}
					</View>
				</AppBottomSheet.Content>
			</AppBottomSheet.Portal>
		</AppBottomSheet>
	);
}

function ConnectorRow({
	connector,
	connecting,
	disconnecting,
	actionsDisabled,
	onConnect,
	onDisconnect,
}: {
	connector: McpConnectorListItem;
	connecting: boolean;
	disconnecting: boolean;
	actionsDisabled: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
}) {
	const { t } = useTranslation();
	const success = useThemeColor("success");
	const warning = useThemeColor("warning");

	return (
		<View className="gap-3 rounded-[16px] border border-border bg-surface px-3.5 py-3 dark:bg-surface-secondary">
			<View className="flex-row items-center gap-3">
				<ConnectorIcon connector={connector} />
				<View className="min-w-0 flex-1">
					<Text
						numberOfLines={1}
						className="font-sans-semibold text-[14px] text-foreground"
					>
						{connector.name}
					</Text>
					<Text numberOfLines={2} className="text-[12px] text-muted leading-4">
						{connector.description}
					</Text>
				</View>
			</View>

			<View className="flex-row items-center justify-end gap-2.5">
				{connector.status === "connected" ? (
					<View className="me-auto flex-row items-center gap-1.5">
						<WanditIcon name="check" size={11} color={success} />
						<Text className="text-[12px] text-muted">
							{t("projects.connectors.connected")}
						</Text>
					</View>
				) : null}
				{connector.status === "expired" ? (
					<Text className="me-auto text-[12px]" style={{ color: warning }}>
						{t("projects.connectors.expired")}
					</Text>
				) : null}

				{connector.status === "not_connected" && !connector.available ? (
					<View className="rounded-full border border-border bg-surface-secondary px-3 py-1.5 dark:bg-surface-tertiary">
						<Text className="text-[12px] text-muted">
							{t("projects.connectors.comingSoon")}
						</Text>
					</View>
				) : null}

				{connector.status === "not_connected" && connector.available ? (
					<ActionButton
						label={
							connecting
								? t("projects.connectors.connecting")
								: t("projects.connectors.connect")
						}
						emphasized
						busy={connecting}
						disabled={actionsDisabled}
						onPress={onConnect}
					/>
				) : null}

				{connector.status === "expired" ? (
					<ActionButton
						label={
							connecting
								? t("projects.connectors.connecting")
								: t("projects.connectors.reconnect")
						}
						emphasized
						busy={connecting}
						disabled={actionsDisabled}
						onPress={onConnect}
					/>
				) : null}

				{connector.status === "connected" ? (
					<ActionButton
						label={t("projects.connectors.disconnect")}
						busy={disconnecting}
						disabled={actionsDisabled}
						onPress={onDisconnect}
					/>
				) : null}
			</View>
		</View>
	);
}

function ActionButton({
	label,
	onPress,
	busy = false,
	disabled = false,
	emphasized = false,
}: {
	label: string;
	onPress: () => void;
	busy?: boolean;
	disabled?: boolean;
	emphasized?: boolean;
}) {
	const accentForeground = useThemeColor("accent-foreground");
	const foreground = useThemeColor("foreground");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ busy, disabled }}
			disabled={disabled}
			onPress={onPress}
			className={`h-[32px] flex-row items-center gap-1.5 rounded-full px-3.5 active:scale-95 ${
				emphasized ? "bg-accent" : "border border-border"
			} ${disabled && !busy ? "opacity-45" : ""}`}
		>
			{busy ? (
				<ActivityIndicator
					size="small"
					color={emphasized ? accentForeground : foreground}
				/>
			) : null}
			<Text
				className={`font-sans-semibold text-[12.5px] ${
					emphasized ? "text-accent-foreground" : "text-foreground"
				}`}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function ConnectorIcon({ connector }: { connector: McpConnectorListItem }) {
	const muted = useThemeColor("muted");

	return (
		<View className="h-10 w-10 items-center justify-center overflow-hidden rounded-[12px] border border-border bg-surface-secondary dark:bg-surface-tertiary">
			{connector.iconUrl ? (
				<Image
					source={{ uri: connector.iconUrl }}
					resizeMode="cover"
					className="h-full w-full"
					accessibilityLabel=""
				/>
			) : (
				<Text
					className="font-sans-semibold text-[15px]"
					style={{ color: muted }}
				>
					{connector.name.trim().charAt(0).toUpperCase()}
				</Text>
			)}
		</View>
	);
}
