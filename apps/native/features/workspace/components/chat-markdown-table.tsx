// Web parity with real-message.tsx's table treatment: long tables cap at a
// fixed height with the header row pinned, and a fullscreen modal shows the
// whole table. The header pins because the thead element renders OUTSIDE the
// vertical ScrollView but inside the same width-giving table View — th/td
// keep the library's flex:1, so every row divides the table width equally and
// header/body columns stay aligned without measurement.

import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { type ReactNode, useRef, useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	type StyleProp,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WanditIcon } from "@/components/wandit-icon";

// Same numbers as the web's max-h-[420px] / ~10 visible rows.
const CAP_HEIGHT = 420;
const MAX_INLINE_ROWS = 10;

export function MarkdownTable({
	header,
	body,
	bodyRowCount,
	tableStyle,
}: {
	header: ReactNode;
	body: ReactNode;
	bodyRowCount: number;
	tableStyle: StyleProp<ViewStyle>;
}) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	const [fullscreen, setFullscreen] = useState(false);
	const [overflowing, setOverflowing] = useState(false);
	const layoutWidth = useRef(0);
	const contentWidth = useRef(0);

	const sync = () => {
		setOverflowing(contentWidth.current > layoutWidth.current + 1);
	};

	const capped = bodyRowCount > MAX_INLINE_ROWS;

	return (
		<View style={{ marginBottom: 10 }}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ flexDirection: "column" }}
				onLayout={(e) => {
					layoutWidth.current = e.nativeEvent.layout.width;
					sync();
				}}
				onContentSizeChange={(w) => {
					contentWidth.current = w;
					sync();
				}}
			>
				<View style={[tableStyle, { marginBottom: 0 }]}>
					{header}
					{capped ? (
						// Android needs nestedScrollEnabled for a scroller inside the
						// thread scroller.
						<ScrollView style={{ maxHeight: CAP_HEIGHT }} nestedScrollEnabled>
							{body}
						</ScrollView>
					) : (
						body
					)}
				</View>
			</ScrollView>

			{capped || overflowing ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("workspace.chat.markdown.expandTable")}
					onPress={() => setFullscreen(true)}
					className="mt-1.5 flex-row items-center gap-1.5 self-end active:opacity-70"
				>
					<WanditIcon name="maximize" size={11} color={muted} />
					<Text
						className="text-[11.5px] text-muted"
						style={{ writingDirection: "auto" }}
					>
						{t("workspace.chat.markdown.expandTable")}
					</Text>
				</Pressable>
			) : null}

			{fullscreen ? (
				// Rendering the same header/body element objects here and in the
				// inline tree is legal React — they are plain descriptors.
				<FullscreenTable
					tableStyle={tableStyle}
					onClose={() => setFullscreen(false)}
				>
					{header}
					{body}
				</FullscreenTable>
			) : null}
		</View>
	);
}

function FullscreenTable({
	tableStyle,
	onClose,
	children,
}: {
	tableStyle: StyleProp<ViewStyle>;
	onClose: () => void;
	children: ReactNode;
}) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const foreground = useThemeColor("foreground");

	return (
		<Modal
			visible
			animationType="fade"
			onRequestClose={onClose}
			supportedOrientations={["portrait", "landscape"]}
		>
			<View className="flex-1 bg-background">
				<View
					className="flex-row items-center justify-end px-3"
					style={{ paddingTop: insets.top + 8 }}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("workspace.chat.markdown.closeTable")}
						onPress={onClose}
						className="h-9 w-9 items-center justify-center rounded-full bg-surface-secondary active:opacity-80"
					>
						<WanditIcon name="close" size={14} color={foreground} />
					</Pressable>
				</View>

				<ScrollView
					contentContainerStyle={{
						padding: 16,
						paddingBottom: insets.bottom + 24,
					}}
				>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ flexDirection: "column" }}
					>
						<View style={tableStyle}>{children}</View>
					</ScrollView>
				</ScrollView>
			</View>
		</Modal>
	);
}
