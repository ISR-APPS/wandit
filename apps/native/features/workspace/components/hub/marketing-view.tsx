import type { MarketingAsset, MarketingAssetType } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { ICON_STROKE } from "@/shared/lib/brand";

import {
	useMarketingAssetHtmlQuery,
	useMarketingAssetsQuery,
} from "../../api/generation.queries";
import { marketingAssetDownloadUrl } from "../../api/generation.requests";
import {
	downloadAndShareMedia,
	isMediaDownloadError,
} from "../../lib/download-media";
import { useHubTimeAgo } from "../../lib/hub-time";
import { SpinnerArc } from "../spinner-arc";
import { HubRoundButton } from "./hub-round-button";

const OVERLAY_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const SKELETON_KEYS = ["a", "b", "c", "d"];

// Same icon/label vocabulary as the web Marketing tab (marketing-tab.tsx).
const TYPE_META: Record<
	MarketingAssetType,
	{
		icon: WanditIconName;
		labelKey:
			| "workspace.marketing.types.adCopy"
			| "workspace.marketing.types.marketingStrategy"
			| "workspace.marketing.types.videoScript"
			| "workspace.marketing.types.creativeBrief"
			| "workspace.marketing.types.htmlAsset";
	}
> = {
	"ad-copy": {
		icon: "megaphone",
		labelKey: "workspace.marketing.types.adCopy",
	},
	"marketing-strategy": {
		icon: "route",
		labelKey: "workspace.marketing.types.marketingStrategy",
	},
	"video-script": {
		icon: "clap",
		labelKey: "workspace.marketing.types.videoScript",
	},
	"creative-brief": {
		icon: "docText",
		labelKey: "workspace.marketing.types.creativeBrief",
	},
	"html-asset": {
		icon: "layout",
		labelKey: "workspace.marketing.types.htmlAsset",
	},
};

type MarketingViewProps = {
	projectId: string;
	onToast: (message: string) => void;
};

/**
 * Marketing section of the project hub (design frame "02 · Marketing"), fed
 * by the marketing-assets endpoint: every AI-generated deliverable (ad copy,
 * strategy, video script, creative brief, HTML asset) as a card, newest
 * first. The list polls only while a card is queued/generating (web parity).
 * Tapping a finished card slides in the document in a sandboxed WebView.
 */
export function MarketingView({ projectId, onToast }: MarketingViewProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");

	const assetsQuery = useMarketingAssetsQuery(projectId);
	const assets = assetsQuery.data ?? [];

	// `open` gates interactivity; `openAssetId` keeps content through the
	// fade-out instead of blanking mid-animation, then unmounts the WebView.
	const [open, setOpen] = useState(false);
	const [openAssetId, setOpenAssetId] = useState<string | null>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const openAsset = assets.find((asset) => asset.id === openAssetId) ?? null;

	useEffect(
		() => () => {
			if (closeTimer.current) clearTimeout(closeTimer.current);
		},
		[],
	);

	// The overlay stays mounted (no reanimated exit animations — they abort
	// Fabric unmounts) and slides/fades on this progress value.
	const overlayProgress = useSharedValue(0);
	const overlayStyle = useAnimatedStyle(() => ({
		opacity: overlayProgress.value,
		transform: [{ translateX: (1 - overlayProgress.value) * 24 }],
	}));

	function openDetail(asset: MarketingAsset) {
		if (asset.status !== "succeeded") {
			if (asset.status === "queued" || asset.status === "generating") {
				onToast(t("native.workspace.marketingView.generatingToast"));
			}
			return;
		}
		if (closeTimer.current) clearTimeout(closeTimer.current);
		setOpenAssetId(asset.id);
		setOpen(true);
		overlayProgress.value = withTiming(1, {
			duration: 380,
			easing: OVERLAY_EASING,
		});
	}

	function closeDetail() {
		setOpen(false);
		overlayProgress.value = withTiming(0, { duration: 300 });
		// Drop the WebView once the fade-out finished — an invisible document
		// should not keep running scripts behind the list.
		closeTimer.current = setTimeout(() => setOpenAssetId(null), 320);
	}

	return (
		<View className="relative flex-1">
			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 15,
					paddingTop: 2,
					paddingBottom: insets.bottom + 118,
				}}
			>
				{/* Title row */}
				<View className="flex-row items-start gap-2.5">
					<View className="min-w-0 flex-1">
						<Text className="font-sans-semibold text-[23px] text-foreground leading-[26px]">
							{t("native.workspace.dock.marketing")}
						</Text>
						<Text className="mt-[3px] text-[12.5px] text-muted">
							{t("native.workspace.marketingView.subtitle")}
						</Text>
					</View>
					{!assetsQuery.isPending && assets.length > 0 ? (
						<Text
							className="mt-3 font-mono text-[11px] text-muted"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{t("workspace.marketing.countLabel", { count: assets.length })}
						</Text>
					) : null}
					<HubRoundButton
						icon="refresh"
						label={t("native.workspace.marketingView.refreshLabel")}
						onPress={() => void assetsQuery.refetch()}
						spinning={assetsQuery.isFetching}
					/>
				</View>

				{assetsQuery.isPending ? (
					// Card-shaped placeholders where the list will land.
					<View className="mt-4 gap-2.5">
						{SKELETON_KEYS.map((key) => (
							<View
								key={key}
								className="h-[68px] rounded-[16px] bg-surface-secondary"
							/>
						))}
					</View>
				) : assetsQuery.isError ? (
					<View className="mt-4 rounded-[16px] border border-danger/25 bg-danger/5 p-4">
						<View className="flex-row items-start gap-2.5">
							<WanditIcon name="alertTriangle" size={15} color={danger} />
							<View className="min-w-0 flex-1">
								<Text className="font-sans-medium text-[13.5px] text-foreground">
									{t("workspace.marketing.loadError")}
								</Text>
								<Pressable
									accessibilityRole="button"
									onPress={() => void assetsQuery.refetch()}
									disabled={assetsQuery.isFetching}
									className="mt-2.5 h-[32px] flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 active:scale-95"
								>
									{assetsQuery.isFetching ? (
										<ActivityIndicator size="small" color={muted} />
									) : (
										<WanditIcon name="refresh" size={12} color={muted} />
									)}
									<Text className="font-sans-semibold text-[12px] text-foreground">
										{t("workspace.marketing.retry")}
									</Text>
								</Pressable>
							</View>
						</View>
					</View>
				) : assets.length === 0 ? (
					<View className="mt-4 items-center rounded-[16px] border border-border border-dashed px-6 py-10">
						<WanditIcon name="megaphone" size={22} color={muted} />
						<Text className="mt-3 font-sans-semibold text-[14.5px] text-foreground">
							{t("workspace.marketing.emptyTitle")}
						</Text>
						<Text className="mt-1 text-center text-[12.5px] text-muted leading-[18px]">
							{t("workspace.marketing.emptyBody")}
						</Text>
					</View>
				) : (
					<View className="mt-4 gap-2.5">
						{assets.map((asset) => (
							<MarketingCard
								key={asset.id}
								asset={asset}
								onPress={() => openDetail(asset)}
							/>
						))}
					</View>
				)}
			</ScrollView>

			{/* Document overlay (slides in from the trailing edge) */}
			<Animated.View
				pointerEvents={open ? "auto" : "none"}
				className="absolute inset-0 bg-background"
				style={[{ zIndex: 45 }, overlayStyle]}
			>
				{openAsset ? (
					<MarketingAssetDetail
						asset={openAsset}
						onBack={closeDetail}
						onToast={onToast}
					/>
				) : null}
			</Animated.View>
		</View>
	);
}

function MarketingCard({
	asset,
	onPress,
}: {
	asset: MarketingAsset;
	onPress: () => void;
}) {
	const { t } = useTranslation();
	const { isDark } = useAppTheme();
	const timeAgo = useHubTimeAgo();
	const accent = useThemeColor("accent");
	const danger = useThemeColor("danger");
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const meta = TYPE_META[asset.assetType];
	const working = asset.status === "queued" || asset.status === "generating";
	const failed = asset.status === "failed";
	const minutesAgo = (Date.now() - Date.parse(asset.createdAt)) / 60_000;
	const timeLabel =
		minutesAgo < 1 ? t("native.workspace.hub.justNow") : timeAgo(minutesAgo);

	const card = (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className={`overflow-hidden rounded-[16px] border bg-surface active:scale-[0.985] dark:bg-surface-secondary ${
				failed ? "border-danger/30 bg-danger/5" : "border-border"
			}`}
		>
			<View className="flex-row items-center gap-[11px] px-3.5 py-3">
				<View
					className="h-[38px] w-[38px] items-center justify-center rounded-[12px]"
					style={{
						backgroundColor: failed
							? "rgba(220,68,50,0.1)"
							: "rgba(209,96,34,0.1)",
					}}
				>
					{working ? (
						<SpinnerArc size={16} />
					) : (
						<WanditIcon
							name={failed ? "alertTriangle" : meta.icon}
							size={19}
							color={failed ? danger : accent}
							strokeWidth={1.8}
						/>
					)}
				</View>
				<View className="min-w-0 flex-1">
					<Text
						numberOfLines={1}
						className="font-sans-semibold text-[14.5px] text-foreground leading-[19px]"
					>
						{asset.name}
					</Text>
					<Text className="mt-[3px] font-mono text-[10px] text-muted uppercase tracking-[1.2px]">
						{`${t(meta.labelKey)} · ${timeLabel}`}
					</Text>
				</View>
				{working ? (
					<Text
						className="font-sans-medium text-[12px]"
						style={{ color: accent }}
					>
						{asset.status === "generating"
							? t("workspace.marketing.generating")
							: t("workspace.marketing.queued")}
					</Text>
				) : failed ? (
					<Text
						numberOfLines={1}
						className="max-w-[40%] font-sans-medium text-[12px]"
						style={{ color: danger }}
					>
						{t("workspace.marketing.failed")}
					</Text>
				) : (
					<View className="opacity-45">
						<WanditIcon name="chevronRight" size={16} color={iconStroke} />
					</View>
				)}
			</View>
		</Pressable>
	);

	if (!working) {
		return card;
	}

	// Whole-card generation pulse (design wd-cardpulse).
	return (
		<Animated.View
			style={{
				animationName: {
					"0%": { opacity: 1 },
					"50%": { opacity: 0.55 },
					"100%": { opacity: 1 },
				},
				animationDuration: "2400ms",
				animationIterationCount: "infinite",
				animationTimingFunction: "ease-in-out",
			}}
		>
			{card}
		</Animated.View>
	);
}

function MarketingAssetDetail({
	asset,
	onBack,
	onToast,
}: {
	asset: MarketingAsset;
	onBack: () => void;
	onToast: (message: string) => void;
}) {
	const { t } = useTranslation();
	const timeAgo = useHubTimeAgo();
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");
	const { isDark } = useAppTheme();
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const htmlQuery = useMarketingAssetHtmlQuery(asset.id);
	const [downloading, setDownloading] = useState(false);

	const minutesAgo = (Date.now() - Date.parse(asset.createdAt)) / 60_000;
	const timeLabel =
		minutesAgo < 1 ? t("native.workspace.hub.justNow") : timeAgo(minutesAgo);

	const handleDownload = async () => {
		if (downloading) return;
		setDownloading(true);
		try {
			await downloadAndShareMedia({
				url: marketingAssetDownloadUrl(asset.id),
				filename: `${asset.name.replace(/[\\/:*?"<>|]/g, "-")}.html`,
				mimeType: "text/html",
			});
		} catch (error) {
			// Only a real download/write failure is disclosed; the share sheet
			// closing stays silent. The button stays usable, the user can retry.
			if (isMediaDownloadError(error)) {
				onToast(t("native.workspace.marketingView.downloadError"));
			}
		} finally {
			setDownloading(false);
		}
	};

	return (
		<>
			<View className="flex-row items-center gap-[9px] border-border border-b bg-background px-3 py-2.5">
				<Pressable
					accessibilityRole="button"
					onPress={onBack}
					className="h-[38px] w-[38px] items-center justify-center rounded-full border border-border bg-surface active:scale-[0.92] dark:bg-surface-secondary"
				>
					<View style={{ transform: [{ rotate: "180deg" }] }}>
						<WanditIcon name="arrowRight" size={15} color={iconStroke} />
					</View>
				</Pressable>
				<View className="min-w-0 flex-1">
					<Text
						numberOfLines={1}
						className="font-sans-semibold text-[14px] text-foreground"
					>
						{asset.name}
					</Text>
					<Text className="mt-px font-mono text-[9.5px] text-muted uppercase tracking-[1.2px]">
						{`${t(TYPE_META[asset.assetType].labelKey)} · ${timeLabel}`}
					</Text>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.marketingView.downloadLabel")}
					accessibilityState={{ busy: downloading }}
					disabled={downloading}
					onPress={() => void handleDownload()}
					className="h-[38px] w-[38px] items-center justify-center rounded-full border border-border bg-surface active:scale-[0.92] dark:bg-surface-secondary"
				>
					{downloading ? (
						<ActivityIndicator size="small" color={muted} />
					) : (
						<WanditIcon name="download" size={15} color={iconStroke} />
					)}
				</Pressable>
			</View>

			{htmlQuery.isPending ? (
				<View className="m-3 flex-1 items-center justify-center rounded-[16px] bg-surface-secondary">
					<ActivityIndicator color={muted} />
				</View>
			) : htmlQuery.isError ? (
				<View className="m-3 rounded-[16px] border border-danger/25 bg-danger/5 p-4">
					<View className="flex-row items-start gap-2.5">
						<WanditIcon name="alertTriangle" size={15} color={danger} />
						<View className="min-w-0 flex-1">
							<Text className="font-sans-medium text-[13.5px] text-foreground">
								{t("workspace.marketing.loadError")}
							</Text>
							<Pressable
								accessibilityRole="button"
								onPress={() => void htmlQuery.refetch()}
								disabled={htmlQuery.isFetching}
								className="mt-2.5 h-[32px] flex-row items-center gap-1.5 self-start rounded-full border border-border px-3 active:scale-95"
							>
								{htmlQuery.isFetching ? (
									<ActivityIndicator size="small" color={muted} />
								) : (
									<WanditIcon name="refresh" size={12} color={muted} />
								)}
								<Text className="font-sans-semibold text-[12px] text-foreground">
									{t("workspace.marketing.retry")}
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			) : (
				// Documents are authored on white — same fixed ground as the web's
				// sandboxed iframe (bg-white), independent of the app theme.
				<View className="m-3 flex-1 overflow-hidden rounded-[16px] border border-border">
					<WebView
						source={{ html: htmlQuery.data.html }}
						originWhitelist={["about:blank"]}
						// The document never navigates: link taps are inert, exactly
						// like the web's sandboxed iframe.
						onShouldStartLoadWithRequest={(request) =>
							request.url === "about:blank" || request.url.startsWith("data:")
						}
						setSupportMultipleWindows={false}
						javaScriptEnabled
						domStorageEnabled={false}
						allowsLinkPreview={false}
						style={{ flex: 1, backgroundColor: "#FFFFFF" }}
					/>
				</View>
			)}
		</>
	);
}
