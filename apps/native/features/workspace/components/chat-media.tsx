// Shared chat media policy (web parity with parts/chat-media.tsx): one media
// item renders as a single capped block, two or more render as a fixed-height
// horizontal filmstrip — never a wall of stacked full-width blocks, never a
// nested vertical scroll. Images open a fullscreen viewer (arrows +
// download); videos play inline with native controls.

import { useTranslation } from "@wandit/internationalization/react";
import { useVideoPlayer, VideoView } from "expo-video";
import { useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Image,
	Modal,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";

import {
	downloadAndShareMedia,
	isMediaDownloadError,
	mediaFilenameFromUrl,
} from "../lib/download-media";

export type ChatMediaGalleryItem = {
	key: string;
	kind: "image" | "video";
	url: string;
	/** Accessible description. */
	label: string;
	/** Dedicated credentialed download endpoint; falls back to the media URL. */
	downloadUrl?: string;
};

export function ChatMediaGallery({ items }: { items: ChatMediaGalleryItem[] }) {
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);

	if (items.length === 0) return null;

	const single = items.length === 1;
	const rendered = items.map((item, index) =>
		item.kind === "video" ? (
			<InlineVideo key={item.key} item={item} single={single} />
		) : single ? (
			<Pressable
				key={item.key}
				accessibilityRole="imagebutton"
				accessibilityLabel={item.label}
				onPress={() => setViewerIndex(index)}
				className="overflow-hidden rounded-[14px] border border-border bg-surface-secondary active:opacity-85"
			>
				<Image
					source={{ uri: item.url }}
					resizeMode="contain"
					accessibilityLabel={item.label}
					style={{ width: "100%", height: 240, maxHeight: 320 }}
				/>
			</Pressable>
		) : (
			<StripImage
				key={item.key}
				item={item}
				onPress={() => setViewerIndex(index)}
			/>
		),
	);

	return (
		<>
			{single ? (
				<View>{rendered}</View>
			) : (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
				>
					{rendered}
				</ScrollView>
			)}

			{viewerIndex !== null && items[viewerIndex] ? (
				<ChatMediaViewer
					items={items}
					index={viewerIndex}
					onNavigate={setViewerIndex}
					onClose={() => setViewerIndex(null)}
				/>
			) : null}
		</>
	);
}

// Strip tiles keep the fixed 208pt row height but let the width follow the
// image's intrinsic aspect (web parity: h-52 w-auto max-w-80) so portrait and
// wide images stop centre-cropping to squares. Ratios come from
// Image.getSize, cached module-wide so re-rendered threads resolve instantly;
// until (or unless) a ratio resolves the tile stays a safe 208pt square.
const STRIP_TILE_HEIGHT = 208;
const STRIP_TILE_MAX_WIDTH = 280;
const STRIP_TILE_MIN_WIDTH = 44;
const stripRatioCache = new Map<string, number>();
const STRIP_RATIO_CACHE_LIMIT = 200;

function useImageAspectRatio(url: string): number | null {
	const [ratio, setRatio] = useState<number | null>(
		() => stripRatioCache.get(url) ?? null,
	);

	useEffect(() => {
		const cached = stripRatioCache.get(url);
		if (cached !== undefined) {
			setRatio(cached);
			return;
		}
		let cancelled = false;
		// A url swap on a live tile (e.g. a refreshed signed URL) must not keep
		// the previous image's width while the new metadata resolves.
		setRatio(null);
		Image.getSize(
			url,
			(width, height) => {
				if (width <= 0 || height <= 0) return;
				if (stripRatioCache.size >= STRIP_RATIO_CACHE_LIMIT) {
					stripRatioCache.clear();
				}
				stripRatioCache.set(url, width / height);
				if (!cancelled) setRatio(width / height);
			},
			() => {
				// Metadata lookup failed — the square fallback stays in place.
			},
		);
		return () => {
			cancelled = true;
		};
	}, [url]);

	return ratio;
}

function StripImage({
	item,
	onPress,
}: {
	item: ChatMediaGalleryItem;
	onPress: () => void;
}) {
	const ratio = useImageAspectRatio(item.url);
	const width =
		ratio === null
			? STRIP_TILE_HEIGHT
			: Math.min(
					STRIP_TILE_MAX_WIDTH,
					Math.max(STRIP_TILE_MIN_WIDTH, STRIP_TILE_HEIGHT * ratio),
				);

	return (
		<Pressable
			accessibilityRole="imagebutton"
			accessibilityLabel={item.label}
			onPress={onPress}
			className="overflow-hidden rounded-[14px] border border-border bg-surface-secondary active:opacity-85"
			style={{ height: STRIP_TILE_HEIGHT, width }}
		>
			<Image
				source={{ uri: item.url }}
				resizeMode="cover"
				accessibilityLabel={item.label}
				style={{ height: "100%", width: "100%" }}
			/>
		</Pressable>
	);
}

function InlineVideo({
	item,
	single,
}: {
	item: ChatMediaGalleryItem;
	single: boolean;
}) {
	const player = useVideoPlayer(item.url);

	return (
		<View
			className="overflow-hidden rounded-[14px] border border-border bg-surface-secondary"
			style={
				single ? { width: "100%", height: 240 } : { height: 208, width: 280 }
			}
		>
			<VideoView
				player={player}
				nativeControls
				contentFit="contain"
				style={{ width: "100%", height: "100%" }}
				accessibilityLabel={item.label}
			/>
		</View>
	);
}

/**
 * Full-screen media overlay: Download + Close on top, prev/next when the
 * gallery has more than one item, mono `i / n` counter. Exported for cards
 * that open a single item from their own chrome (the video card's stage).
 */
export function ChatMediaViewer({
	items,
	index,
	onNavigate,
	onClose,
}: {
	items: ChatMediaGalleryItem[];
	index: number;
	onNavigate: (index: number) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const foreground = useThemeColor("foreground");
	const background = useThemeColor("background");
	const [downloading, setDownloading] = useState(false);
	const [downloadFailed, setDownloadFailed] = useState(false);
	const item = items[index];
	const hasMany = items.length > 1;

	if (!item) return null;

	const step = (delta: number) => {
		setDownloadFailed(false);
		onNavigate((index + delta + items.length) % items.length);
	};

	const handleDownload = async () => {
		if (downloading) return;
		setDownloading(true);
		setDownloadFailed(false);
		try {
			await downloadAndShareMedia({
				url: item.downloadUrl ?? item.url,
				filename: mediaFilenameFromUrl(
					item.url,
					item.kind === "video" ? "wandit-video.mp4" : "wandit-image.jpg",
				),
			});
		} catch (error) {
			// Only a real download/write failure is disclosed; the share sheet
			// closing stays silent. The viewer stays open, the user can retry.
			if (isMediaDownloadError(error)) setDownloadFailed(true);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<Modal
			visible
			transparent
			animationType="fade"
			onRequestClose={onClose}
			supportedOrientations={["portrait", "landscape"]}
		>
			<View className="flex-1" style={{ backgroundColor: `${foreground}ee` }}>
				<Pressable
					accessibilityLabel={t("workspace.chat.media.close")}
					className="absolute inset-0"
					onPress={onClose}
				/>

				<View
					className="flex-row items-center justify-end gap-2 px-3"
					style={{ paddingTop: insets.top + 8 }}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("workspace.chat.media.download")}
						onPress={() => void handleDownload()}
						className="h-9 flex-row items-center gap-1.5 rounded-full px-3.5 active:opacity-80"
						style={{ backgroundColor: background }}
					>
						{downloading ? (
							<ActivityIndicator size="small" color={foreground} />
						) : (
							<WanditIcon name="download" size={14} color={foreground} />
						)}
						<Text className="font-sans-semibold text-[12.5px] text-foreground">
							{t("workspace.chat.media.download")}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("workspace.chat.media.close")}
						onPress={onClose}
						className="h-9 w-9 items-center justify-center rounded-full active:opacity-80"
						style={{ backgroundColor: background }}
					>
						<WanditIcon name="close" size={14} color={foreground} />
					</Pressable>
				</View>

				{downloadFailed ? (
					<Text
						accessibilityLiveRegion="polite"
						className="px-3 pt-2 text-center text-[12px] text-danger leading-[17px]"
					>
						{t("workspace.chat.media.downloadFailed")}
					</Text>
				) : null}

				<View className="flex-1 flex-row items-center justify-center gap-2 p-4">
					{hasMany ? (
						<ViewerStepButton
							label={t("workspace.chat.media.previous")}
							direction="previous"
							background={background}
							color={foreground}
							onPress={() => step(-1)}
						/>
					) : null}

					<View className="min-h-0 flex-1 items-center justify-center">
						{item.kind === "video" ? (
							<ViewerVideo item={item} />
						) : (
							<Image
								source={{ uri: item.url }}
								resizeMode="contain"
								accessibilityLabel={item.label}
								style={{ width: "100%", height: "100%" }}
							/>
						)}
					</View>

					{hasMany ? (
						<ViewerStepButton
							label={t("workspace.chat.media.next")}
							direction="next"
							background={background}
							color={foreground}
							onPress={() => step(1)}
						/>
					) : null}
				</View>

				{hasMany ? (
					<Text
						className="text-center font-mono text-[11px]"
						style={{
							color: background,
							paddingBottom: insets.bottom + 10,
							writingDirection: "ltr",
						}}
					>
						{index + 1} / {items.length}
					</Text>
				) : null}
			</View>
		</Modal>
	);
}

function ViewerVideo({ item }: { item: ChatMediaGalleryItem }) {
	const player = useVideoPlayer(item.url, (instance) => {
		instance.play();
	});

	return (
		<VideoView
			player={player}
			nativeControls
			contentFit="contain"
			style={{ width: "100%", height: "100%" }}
			accessibilityLabel={item.label}
		/>
	);
}

function ViewerStepButton({
	label,
	direction,
	background,
	color,
	onPress,
}: {
	label: string;
	direction: "previous" | "next";
	background: string;
	color: string;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-80"
			style={{
				backgroundColor: background,
				transform: [{ rotate: direction === "previous" ? "180deg" : "0deg" }],
			}}
		>
			<WanditIcon name="chevronRight" size={14} color={color} />
		</Pressable>
	);
}
