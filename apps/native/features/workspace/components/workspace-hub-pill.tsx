import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WanditIcon, type WanditIconName } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { ICON_STROKE } from "@/shared/lib/brand";

/** The three sibling project views the hub switches between. */
export type WorkspaceHubView = "assets" | "marketing" | "leads";

export type WorkspaceHubSection = {
	view: WorkspaceHubView;
	icon: WanditIconName;
	title: string;
	/** Live stat inside the collapsed pill, e.g. "4 aujourd’hui". */
	stat: string;
	/** Sub-line on the expanded card, e.g. "7 leads · 4 aujourd’hui". */
	cardSub: string;
};

type WorkspaceHubPillProps = {
	sections: readonly WorkspaceHubSection[];
	active: WorkspaceHubView;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (view: WorkspaceHubView) => void;
};

// Dark pill chrome from prototype riff 2a — hex twins of the design oklch:
//   shell oklch(0.21 0.015 50 / 0.97) · icon oklch(0.93 0.05 65)
//   stat oklch(0.74 0.02 65) · chevron disc oklch(0.55 0.16 45)
const PILL_BG = "rgba(30,22,18,0.97)";
const PILL_TEXT = "#FCFBF8";
const PILL_ICON = "#FFE2C6";
const PILL_STAT = "#B4A99E";
const PILL_DISC = "#B94A00";
const SCRIM_BG = "rgba(54,43,36,0.26)";
// Design tint is accent at 7% alpha, but the cards float over scrimmed
// content — pre-composited on the card surface so nothing bleeds through.
const ACCENT_SOFT = { light: "#FCF4F0", dark: "#393228" };

// Prototype motion: cards rise 16pt with a 45ms stagger on open only.
const CARD_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const CARD_STAGGER_MS = 45;

/**
 * Hub switcher (prototype riff 2a): one floating pill shows the current
 * section and its live stat; a tap fans the three sections out as stacked
 * cards over a scrim, and picking one swaps the view in place. Everything
 * stays mounted — reanimated exit animations abort Fabric unmounts (see
 * shared/ui/skeleton-group.tsx), so open/close is opacity + translate only.
 */
export function WorkspaceHubPill({
	sections,
	active,
	open,
	onOpenChange,
	onSelect,
}: WorkspaceHubPillProps) {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();

	const activeSection =
		sections.find((section) => section.view === active) ?? sections[0];
	const bottom = insets.bottom + 14;

	const progress = useSharedValue(0);
	useEffect(() => {
		progress.value = withTiming(open ? 1 : 0, { duration: 300 });
	}, [open, progress]);

	const scrimStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
	}));
	const chevronStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${progress.value * 180}deg` }],
	}));

	return (
		<>
			<Animated.View
				pointerEvents={open ? "auto" : "none"}
				className="absolute inset-0"
				style={[{ backgroundColor: SCRIM_BG, zIndex: 46 }, scrimStyle]}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.hub.closeLabel")}
					onPress={() => onOpenChange(false)}
					className="flex-1"
				/>
			</Animated.View>

			<View
				pointerEvents="box-none"
				className="absolute inset-x-[26px] gap-[9px]"
				style={{ bottom: bottom + 54 + 18, zIndex: 47 }}
			>
				{sections.map((section, index) => (
					<HubSectionCard
						key={section.view}
						section={section}
						selected={section.view === active}
						open={open}
						openDelayMs={index * CARD_STAGGER_MS}
						onPress={() => {
							onSelect(section.view);
							onOpenChange(false);
						}}
					/>
				))}
			</View>

			<View
				pointerEvents="box-none"
				className="absolute inset-x-0 items-center"
				style={{ bottom, zIndex: 48 }}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("native.workspace.hub.switchLabel")}
					accessibilityState={{ expanded: open }}
					onPress={() => onOpenChange(!open)}
					className="h-[54px] flex-row items-center rounded-full px-[7px] active:scale-[0.97]"
					style={{
						backgroundColor: PILL_BG,
						boxShadow:
							"0 20px 44px -16px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.07)",
					}}
				>
					<View
						className="h-10 w-10 items-center justify-center rounded-full"
						style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
					>
						<WanditIcon
							name={activeSection.icon}
							size={17}
							color={PILL_ICON}
							strokeWidth={1.8}
						/>
					</View>
					<View className="flex-row items-center gap-2.5 ps-3 pe-[13px]">
						<Text
							className="font-sans-semibold text-[14.5px]"
							style={{ color: PILL_TEXT }}
						>
							{activeSection.title}
						</Text>
						<View
							className="h-4 w-px"
							style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
						/>
						<Text
							className="font-mono text-[11px]"
							style={{ color: PILL_STAT, fontVariant: ["tabular-nums"] }}
						>
							{activeSection.stat}
						</Text>
					</View>
					<View
						className="h-10 w-10 items-center justify-center rounded-full"
						style={{ backgroundColor: PILL_DISC }}
					>
						<Animated.View style={chevronStyle}>
							<WanditIcon
								name="chevronUp"
								size={16}
								color={PILL_TEXT}
								strokeWidth={2.2}
							/>
						</Animated.View>
					</View>
				</Pressable>
			</View>
		</>
	);
}

type HubSectionCardProps = {
	section: WorkspaceHubSection;
	selected: boolean;
	open: boolean;
	openDelayMs: number;
	onPress: () => void;
};

function HubSectionCard({
	section,
	selected,
	open,
	openDelayMs,
	onPress,
}: HubSectionCardProps) {
	const { isDark } = useAppTheme();
	const accent = useThemeColor("accent");
	const iconStroke = isDark ? ICON_STROKE.dark : ICON_STROKE.light;

	const progress = useSharedValue(0);
	useEffect(() => {
		// Stagger only while opening (top card first); closing is immediate.
		const delay = open ? openDelayMs : 0;
		progress.value = withDelay(
			delay,
			withTiming(open ? 1 : 0, { duration: 320, easing: CARD_EASING }),
		);
	}, [open, openDelayMs, progress]);

	const cardStyle = useAnimatedStyle(() => ({
		opacity: progress.value,
		transform: [{ translateY: (1 - progress.value) * 16 }],
	}));

	return (
		<Animated.View pointerEvents={open ? "auto" : "none"} style={cardStyle}>
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ selected }}
				onPress={onPress}
				className={
					selected
						? "w-full flex-row items-center gap-3 rounded-[18px] border-[1.5px] p-3 pe-3.5 active:scale-[0.98]"
						: "w-full flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-3 pe-3.5 active:scale-[0.98] dark:bg-surface-secondary"
				}
				style={[
					{ boxShadow: "0 10px 26px -14px rgba(0,0,0,0.25)" },
					selected
						? {
								borderColor: accent,
								backgroundColor: isDark ? ACCENT_SOFT.dark : ACCENT_SOFT.light,
							}
						: undefined,
				]}
			>
				<View className="h-10 w-10 items-center justify-center rounded-[13px] bg-surface-secondary dark:bg-surface-tertiary">
					<WanditIcon
						name={section.icon}
						size={18}
						color={selected ? accent : iconStroke}
						strokeWidth={1.8}
					/>
				</View>
				<View className="min-w-0 flex-1">
					<Text className="font-sans-semibold text-[15px] text-foreground">
						{section.title}
					</Text>
					<Text className="mt-px font-mono text-[10px] text-muted uppercase tracking-[0.8px]">
						{section.cardSub}
					</Text>
				</View>
				{selected ? (
					<WanditIcon name="check" size={19} color={accent} strokeWidth={2.4} />
				) : null}
			</Pressable>
		</Animated.View>
	);
}
