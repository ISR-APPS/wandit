import type { ProjectAsset } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useVideoPlayer, VideoView } from "expo-video";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import {
	ActivityIndicator,
	Image,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";

import { useProjectAssetsQuery } from "../../api/project-assets.queries";
import { projectAssetDownloadUrl } from "../../api/project-assets.requests";
import {
	downloadAndShareMedia,
	isMediaDownloadError,
} from "../../lib/download-media";
import { useHubTimeAgo } from "../../lib/hub-time";
import { type ChatMediaGalleryItem, ChatMediaViewer } from "../chat-media";
import { HubRoundButton } from "./hub-round-button";

type AssetFilter = "all" | "image" | "video";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"];

// Same namespace the fixture book used — the labels predate the API wiring.
const SOURCE_LABEL_KEYS: Record<
	ProjectAsset["source"],
	| "native.workspace.assetsView.srcGeneration"
	| "native.workspace.assetsView.srcPageBuild"
> = {
	"image-generation": "native.workspace.assetsView.srcGeneration",
	"page-build": "native.workspace.assetsView.srcPageBuild",
};

type AssetsViewProps = {
	projectId: string;
	onToast: (message: string) => void;
};

/**
 * Assets section of the project hub (design frame "03 · Assets"), fed by the
 * project-assets endpoint: every media file the AI produced for this project
 * — standalone image generations and page-build media — newest
 * first (server order, web parity). A tile tap opens the shared full-screen
 * viewer; the download button forces the credentialed download and hands the
 * file to the OS share sheet.
 */
export function AssetsView({ projectId, onToast }: AssetsViewProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const muted = useThemeColor("muted");
	const danger = useThemeColor("danger");

	const assetsQuery = useProjectAssetsQuery(projectId);
	const [filter, setFilter] = useState<AssetFilter>("all");
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);

	const assets = assetsQuery.data ?? [];
	const visible = assets.filter(
		(asset) => filter === "all" || asset.kind === filter,
	);
	const countLabel =
		filter === "all"
			? t("native.workspace.assetsView.countAll", { count: assets.length })
			: filter === "image"
				? t("native.workspace.assetsView.countImages", {
						count: visible.length,
					})
				: t("native.workspace.assetsView.countVideos", {
						count: visible.length,
					});

	// The viewer walks the CURRENTLY filtered list — the modal covers the
	// filter chips, so the list cannot change under the open viewer.
	const viewerItems: ChatMediaGalleryItem[] = visible.map((asset) => ({
		downloadUrl: projectAssetDownloadUrl(projectId, asset.key),
		key: asset.id,
		kind: asset.kind,
		label: asset.name,
		url: asset.url,
	}));

	const chips: { key: AssetFilter; label: string }[] = [
		{ key: "all", label: t("native.workspace.assetsView.chipAll") },
		{ key: "image", label: t("native.workspace.assetsView.chipImages") },
		{ key: "video", label: t("native.workspace.assetsView.chipVideos") },
	];

	return (
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
						{t("native.workspace.dock.assets")}
					</Text>
					<Text className="mt-[3px] text-[12.5px] text-muted">
						{t("native.workspace.assetsView.subtitle")}
					</Text>
				</View>
				{!assetsQuery.isPending && visible.length > 0 ? (
					<Text
						className="mt-3 font-mono text-[11px] text-muted"
						style={{ fontVariant: ["tabular-nums"] }}
					>
						{countLabel}
					</Text>
				) : null}
				<HubRoundButton
					icon="refresh"
					label={t("native.workspace.assetsView.refreshLabel")}
					onPress={() => void assetsQuery.refetch()}
					spinning={assetsQuery.isFetching}
				/>
			</View>

			{/* Filter chips */}
			<View className="mt-3.5 flex-row gap-2">
				{chips.map((chip) => {
					const selected = filter === chip.key;
					return (
						<Pressable
							key={chip.key}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							onPress={() => setFilter(chip.key)}
							className={`h-[34px] items-center justify-center rounded-full border px-[15px] active:scale-[0.96] ${
								selected
									? "border-foreground bg-foreground"
									: "border-border bg-surface dark:bg-surface-secondary"
							}`}
						>
							<Text
								className={`font-sans-medium text-[13px] ${
									selected ? "text-background" : "text-muted"
								}`}
							>
								{chip.label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{assetsQuery.isPending ? (
				// Square placeholders where the grid will land.
				<View className="mt-3.5 flex-row flex-wrap gap-2.5">
					{SKELETON_KEYS.map((key) => (
						<View
							key={key}
							className="aspect-square basis-[48%] rounded-[16px] bg-surface-secondary"
						/>
					))}
				</View>
			) : assetsQuery.isError ? (
				<View className="mt-3.5 rounded-[16px] border border-danger/25 bg-danger/5 p-4">
					<View className="flex-row items-start gap-2.5">
						<WanditIcon name="alertTriangle" size={15} color={danger} />
						<View className="min-w-0 flex-1">
							<Text className="font-sans-medium text-[13.5px] text-foreground">
								{t("native.workspace.assetsView.loadError")}
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
									{t("native.workspace.assetsView.retry")}
								</Text>
							</Pressable>
						</View>
					</View>
				</View>
			) : visible.length === 0 ? (
				<View className="mt-3.5 items-center rounded-[16px] border border-border border-dashed px-6 py-10">
					<WanditIcon name="imageTile" size={22} color={muted} />
					<Text className="mt-3 font-sans-semibold text-[14.5px] text-foreground">
						{t("native.workspace.assetsView.emptyTitle")}
					</Text>
					<Text className="mt-1 text-center text-[12.5px] text-muted leading-[18px]">
						{t("native.workspace.assetsView.emptyBody")}
					</Text>
				</View>
			) : (
				<View className="mt-3.5 flex-row flex-wrap gap-2.5">
					{visible.map((asset, index) => (
						<AssetTile
							key={asset.id}
							asset={asset}
							projectId={projectId}
							mutedColor={muted}
							onOpen={() => setViewerIndex(index)}
							onDownloadError={() =>
								onToast(t("native.workspace.assetsView.downloadError"))
							}
						/>
					))}
				</View>
			)}

			{viewerIndex !== null && viewerItems[viewerIndex] ? (
				<ChatMediaViewer
					items={viewerItems}
					index={viewerIndex}
					onNavigate={setViewerIndex}
					onClose={() => setViewerIndex(null)}
				/>
			) : null}
		</ScrollView>
	);
}

function AssetTile({
	asset,
	projectId,
	mutedColor,
	onOpen,
	onDownloadError,
}: {
	asset: ProjectAsset;
	projectId: string;
	mutedColor: string;
	onOpen: () => void;
	onDownloadError: () => void;
}) {
	const { t } = useTranslation();
	const timeAgo = useHubTimeAgo();
	const [downloading, setDownloading] = useState(false);

	const timeLabel =
		asset.createdAt !== null
			? timeAgo((Date.now() - Date.parse(asset.createdAt)) / 60_000)
			: null;
	const metaLabel = `${t(SOURCE_LABEL_KEYS[asset.source])}${
		timeLabel ? ` · ${timeLabel}` : ""
	}`;

	const handleDownload = async () => {
		if (downloading) return;
		setDownloading(true);
		try {
			await downloadAndShareMedia({
				url: projectAssetDownloadUrl(projectId, asset.key),
				filename: asset.key.split("/").pop() ?? asset.name,
				mimeType: asset.mediaType,
			});
		} catch (error) {
			// Only a real download/write failure is disclosed; the share sheet
			// closing stays silent. The tile stays usable, the user can retry.
			if (isMediaDownloadError(error)) onDownloadError();
		} finally {
			setDownloading(false);
		}
	};

	return (
		<View className="basis-[48%] overflow-hidden rounded-[16px] border border-border bg-surface dark:bg-surface-secondary">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={asset.name}
				onPress={onOpen}
				className="relative aspect-square w-full bg-surface-secondary active:opacity-85"
			>
				{asset.kind === "image" ? (
					<Image
						source={{ uri: asset.url }}
						resizeMode="cover"
						accessibilityLabel={asset.name}
						style={{ width: "100%", height: "100%" }}
					/>
				) : (
					<VideoThumb url={asset.url} label={asset.name} />
				)}
			</Pressable>
			<View className="flex-row items-center gap-1 py-[9px] ps-3 pe-[7px]">
				<View className="min-w-0 flex-1">
					<Text
						numberOfLines={1}
						className="text-[12.5px] text-foreground"
						style={{ writingDirection: "ltr" }}
					>
						{asset.name}
					</Text>
					<Text
						numberOfLines={1}
						className="mt-[3px] font-mono text-[9.5px] text-muted uppercase tracking-[0.8px]"
					>
						{metaLabel}
					</Text>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.assetsView.downloadLabel")}
					accessibilityState={{ busy: downloading }}
					disabled={downloading}
					onPress={() => void handleDownload()}
					className="h-[30px] w-[30px] items-center justify-center rounded-full active:scale-[0.88]"
				>
					{downloading ? (
						<ActivityIndicator size="small" color={mutedColor} />
					) : (
						<WanditIcon
							name="download"
							size={14}
							color={mutedColor}
							strokeWidth={1.9}
						/>
					)}
				</Pressable>
			</View>
		</View>
	);
}

/** Paused first frame behind the play badge (web parity: preload metadata). */
function VideoThumb({ url, label }: { url: string; label: string }) {
	const player = useVideoPlayer(url);

	return (
		<>
			<VideoView
				player={player}
				nativeControls={false}
				contentFit="cover"
				style={{ width: "100%", height: "100%" }}
				accessibilityLabel={label}
			/>
			<View
				className="absolute inset-0 items-center justify-center"
				pointerEvents="none"
			>
				<View
					className="h-[38px] w-[38px] items-center justify-center rounded-full"
					style={{
						backgroundColor: "rgba(252,251,248,0.92)",
						boxShadow: "0 4px 14px -4px rgba(0,0,0,0.45)",
					}}
				>
					<View className="ms-0.5">
						<WanditIcon name="play" size={14} color="#241E1A" />
					</View>
				</View>
			</View>
		</>
	);
}
