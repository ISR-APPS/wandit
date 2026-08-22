// Deferred inline markdown image: the URL is never fetched before the tap —
// the chip discloses what would load (alt text, or the URL filename) and the
// real <Image> mounts only on opt-in; load failure falls quietly back to the
// chip with a retry hint.

import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { WanditIcon } from "@/components/wandit-icon";

import { mediaFilenameFromUrl } from "../lib/download-media";

export function MarkdownImage({ src, alt }: { src: string; alt: string }) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	const [phase, setPhase] = useState<"idle" | "shown" | "failed">("idle");

	if (phase === "shown") {
		return (
			<View className="mb-2.5 overflow-hidden rounded-[14px] border border-border bg-surface-secondary">
				<Image
					source={{ uri: src }}
					resizeMode="contain"
					accessibilityLabel={alt || undefined}
					onError={() => setPhase("failed")}
					style={{ width: "100%", height: 240, maxHeight: 320 }}
				/>
			</View>
		);
	}

	const label = alt || mediaFilenameFromUrl(src, src);
	const hint =
		phase === "failed"
			? t("workspace.chat.markdown.imageLoadFailed")
			: t("workspace.chat.markdown.tapToLoadImage");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label} — ${hint}`}
			onPress={() => setPhase("shown")}
			className="mb-2.5 flex-row items-center gap-2.5 self-start rounded-[14px] border border-border bg-surface-secondary px-3 py-2.5 active:opacity-85"
		>
			<WanditIcon name="image" size={16} color={muted} />
			<View className="shrink">
				<Text
					numberOfLines={1}
					className="font-sans-medium text-[12.5px] text-foreground"
					// Alt is model content → auto; a filename/URL → ltr.
					style={{ writingDirection: alt ? "auto" : "ltr" }}
				>
					{label}
				</Text>
				<Text
					className="text-[11px] text-muted"
					style={{ writingDirection: "auto" }}
				>
					{hint}
				</Text>
			</View>
		</Pressable>
	);
}
