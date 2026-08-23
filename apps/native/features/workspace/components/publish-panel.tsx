// Post-build payoff panel: once a build succeeds, show where the page LIVES.
// Published → "Published · Live" kicker, the {slug}.wandit.app pill (tap to
// copy) and a View-live-page CTA. Never published → the same panel sells the
// one-tap free publish; the POST runs the whole pipeline server-side and
// answers with the settled state, so there is no status polling here either.

import { useTranslation } from "@wandit/internationalization/react";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useThemeColor } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";
import {
	useDeploymentCurrentQuery,
	usePublishDeploymentMutation,
} from "@/features/workspace/api/deployments.queries";
import { AppButton } from "@/shared/ui/button";

const COPIED_RESET_MS = 1_600;

export function PublishPanel({ projectId }: { projectId: string }) {
	const { t } = useTranslation();
	const success = useThemeColor("success");
	const mutedColor = useThemeColor("muted");

	const query = useDeploymentCurrentQuery(projectId, true);
	const publishMutation = usePublishDeploymentMutation(projectId);

	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		},
		[],
	);

	// The panel is a bonus layer on the success card — while the snapshot is
	// unknown (loading, request failed) the card simply stands on its own.
	const current = query.data;
	if (!current) return null;

	const liveUrl = current.uiState === "published" ? current.liveUrl : null;

	if (liveUrl) {
		const host = liveUrl.replace(/^https?:\/\//, "");

		const handleCopy = () => {
			void Clipboard.setStringAsync(liveUrl).catch(() => undefined);
			setCopied(true);
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
			copiedTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
		};

		return (
			<View className="mt-3 gap-1 rounded-[14px] border border-success/25 bg-success/5 p-3.5">
				<View className="flex-row items-center gap-1.5">
					<View className="h-[14px] w-[14px] items-center justify-center rounded-full bg-success/15">
						<WanditIcon name="check" size={8} color={success} />
					</View>
					<Text className="font-mono text-[10px] text-success uppercase tracking-[1px]">
						{t("workspace.chat.pageBuild.live.kicker")}
					</Text>
				</View>
				<Text className="font-sans-semibold text-[14px] text-foreground">
					{t("workspace.chat.pageBuild.live.headline")}
				</Text>
				<Text className="text-[12px] text-muted leading-[17px]">
					{t("workspace.chat.pageBuild.live.subtitle")}
				</Text>
				<Pressable
					accessibilityRole="button"
					className="mt-1.5 flex-row items-center gap-2 rounded-[10px] bg-surface-tertiary px-3 py-2.5 active:opacity-75"
					onPress={handleCopy}
				>
					<View className="h-1.5 w-1.5 rounded-full bg-success" />
					<Text
						numberOfLines={1}
						className="min-w-0 flex-1 font-mono text-[12px] text-foreground"
					>
						{host}
					</Text>
					{copied ? (
						<WanditIcon name="check" size={13} color={success} />
					) : (
						<WanditIcon name="copy" size={13} color={mutedColor} />
					)}
				</Pressable>
				<AppButton
					className="mt-2"
					size="sm"
					onPress={() => {
						void WebBrowser.openBrowserAsync(liveUrl).catch(() => undefined);
					}}
				>
					{t("workspace.chat.pageBuild.live.view")}
				</AppButton>
			</View>
		);
	}

	const publishing =
		publishMutation.isPending || current.uiState === "publishing";
	const failedDetail =
		publishMutation.isError || current.uiState === "failed"
			? (current.error ?? t("workspace.chat.pageBuild.live.publishError"))
			: null;

	return (
		<View className="mt-3 gap-1 rounded-[14px] border border-border bg-surface-secondary p-3.5">
			<Text className="font-sans-semibold text-[14px] text-foreground">
				{t("workspace.chat.pageBuild.live.draftHeadline")}
			</Text>
			<Text className="text-[12px] text-muted leading-[17px]">
				{t("workspace.chat.pageBuild.live.draftSubtitle")}
			</Text>
			{failedDetail ? (
				<Text className="text-[12px] text-danger leading-[17px]">
					{failedDetail}
				</Text>
			) : null}
			<AppButton
				className="mt-2"
				isDisabled={publishing}
				size="sm"
				onPress={() => publishMutation.mutate({})}
			>
				{publishing
					? t("workspace.chat.pageBuild.live.publishing")
					: t("workspace.chat.pageBuild.live.publishCta")}
			</AppButton>
		</View>
	);
}
