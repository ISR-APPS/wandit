import { useTranslation } from "@wandit/internationalization/react";
import { Pressable, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { WanditIcon } from "@/components/wandit-icon";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";

import { PAGE_CHROME } from "./chrome";

type PageViewBarProps = {
	onBackToChat: () => void;
	onStartComment: () => void;
	onStartEdit: () => void;
	onOpenPublish: () => void;
	/** Relabels the publish pill "Update" once the page is live. */
	published: boolean;
	/** Page theme background — the bar fades the page out into itself. */
	fadeColor: string;
};

/** Default floating toolbar over the page (prototype "showPageBar"):
    ‹ Chat pill on the leading edge, then comment · Edit · the ember
    Publish primary. Always dark chrome, whatever the page palette. */
export function PageViewBar({
	onBackToChat,
	onStartComment,
	onStartEdit,
	onOpenPublish,
	published,
	fadeColor,
}: PageViewBarProps) {
	const { t } = useTranslation();

	return (
		<View className="flex-row items-center gap-2 px-3.5">
			<Svg
				pointerEvents="none"
				style={{
					position: "absolute",
					insetInlineStart: 0,
					insetInlineEnd: 0,
					bottom: -60,
					height: 150,
				}}
			>
				<Defs>
					<LinearGradient id="pageBarFade" x1="0" y1="0" x2="0" y2="1">
						<Stop offset="0" stopColor={fadeColor} stopOpacity={0} />
						<Stop offset="0.55" stopColor={fadeColor} stopOpacity={0.9} />
						<Stop offset="1" stopColor={fadeColor} stopOpacity={1} />
					</LinearGradient>
				</Defs>
				<Rect x="0" y="0" width="100%" height="100%" fill="url(#pageBarFade)" />
			</Svg>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("native.page.bar.chat")}
				onPress={onBackToChat}
				className="h-[46px] flex-row items-center gap-1 rounded-full ps-2.5 pe-4 active:scale-[0.96]"
				style={{ backgroundColor: PAGE_CHROME.bar }}
			>
				<View style={{ transform: [{ rotate: "180deg" }] }}>
					<WanditIcon
						name="chevronRight"
						size={14}
						color={PAGE_CHROME.text}
						strokeWidth={2.4}
					/>
				</View>
				<Text
					className="font-sans-semibold text-[14px]"
					style={{ color: PAGE_CHROME.text }}
				>
					{t("native.page.bar.chat")}
				</Text>
			</Pressable>
			<View className="flex-1" />
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("native.page.bar.comment")}
				onPress={onStartComment}
				className="h-[46px] w-[46px] items-center justify-center rounded-full active:scale-[0.94]"
				style={{ backgroundColor: PAGE_CHROME.bar }}
			>
				<WanditIcon name="bubble" size={17} color={PAGE_CHROME.text} />
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("native.page.bar.edit")}
				onPress={onStartEdit}
				className="h-[46px] flex-row items-center gap-1.5 rounded-full px-3.5 active:scale-[0.96]"
				style={{ backgroundColor: PAGE_CHROME.bar }}
			>
				<WanditIcon
					name="pencil"
					size={15}
					color={PAGE_CHROME.text}
					strokeWidth={1.9}
				/>
				<Text
					className="font-sans-semibold text-[14px]"
					style={{ color: PAGE_CHROME.text }}
				>
					{t("native.page.bar.edit")}
				</Text>
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={
					published
						? t("native.page.publish.update")
						: t("native.page.publish.publish")
				}
				onPress={onOpenPublish}
				className="relative h-[46px] flex-row items-center gap-1.5 overflow-hidden rounded-full px-4 active:scale-[0.96]"
			>
				<BrandGradientFill radius={23} />
				<WanditIcon name="spark" size={13} color="#FFFFFF" />
				<Text className="font-sans-bold text-[14px] text-white">
					{published
						? t("native.page.publish.update")
						: t("native.page.publish.publish")}
				</Text>
			</Pressable>
		</View>
	);
}
