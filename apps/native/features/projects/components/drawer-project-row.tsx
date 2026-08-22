import type { Project } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { memo, useId, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, {
	Circle,
	Defs,
	LinearGradient,
	RadialGradient,
	Rect,
	Stop,
} from "react-native-svg";

import { SpinnerArc } from "@/features/workspace/components/spinner-arc";
import { BRAND_GRADIENT_LIGHT } from "@/shared/lib/brand";

/**
 * Drawer project row from the prototype: a preview thumb of the last build,
 * the name, and a status meta line (building spinner / live slug + leads /
 * draft age). Tap opens the project; press-and-hold lifts it into the
 * actions sheet.
 */

type DrawerProjectRowProps = {
	accessibilityLabel: string;
	project: Project;
	/** Relative age used by the draft meta line. */
	updatedAtLabel: string;
	onPress: (project: Project) => void;
	/** Press-and-hold (or the accessibility long-press action). */
	onLongPress: (project: Project) => void;
};

// Memoized so drawer-level state churn (search keystrokes, focus) stops at
// the row: props are stable callbacks, cache-stable projects, and strings.
export const DrawerProjectRow = memo(function DrawerProjectRow({
	accessibilityLabel,
	project,
	updatedAtLabel,
	onPress,
	onLongPress,
}: DrawerProjectRowProps) {
	const { t } = useTranslation();
	const success = useThemeColor("success");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={t("native.drawer.projectActionsHint")}
			accessibilityActions={[
				{
					name: "longpress",
					// iOS VoiceOver only exposes custom actions that carry a label.
					label: t("native.drawer.projectActionsLabel", {
						project: project.name,
					}),
				},
			]}
			onAccessibilityAction={(event) => {
				if (event.nativeEvent.actionName === "longpress") {
					onLongPress(project);
				}
			}}
			delayLongPress={400}
			onPress={() => onPress(project)}
			onLongPress={() => onLongPress(project)}
			className="-mx-1.5 flex-row items-center gap-3 rounded-[12px] px-1.5 py-2 active:bg-surface-secondary/70 dark:active:bg-surface-tertiary/50"
		>
			<ProjectThumb project={project} />
			<View className="min-w-0 flex-1">
				<Text
					numberOfLines={1}
					className="font-sans-medium text-[14.5px] text-foreground"
				>
					{project.name}
				</Text>
				{project.status === "publishing" ? (
					<BuildingMeta label={t("native.drawer.buildingMeta")} />
				) : project.status === "published" && project.publishedSlug ? (
					<View className="mt-1 flex-row items-center gap-1.5">
						<View
							className="h-[5px] w-[5px] rounded-full"
							style={{ backgroundColor: success }}
						/>
						<Text
							numberOfLines={1}
							className="shrink font-sans-medium text-[12px] text-muted"
							style={{ writingDirection: "ltr" }}
						>
							{project.publishedSlug}
							{t("projects.publishedDomain")}
						</Text>
						<Text
							numberOfLines={1}
							className="shrink-0 font-sans-medium text-[12px] text-muted"
						>
							{"· "}
							{t("projects.leadCount", { count: project.leadCount })}
						</Text>
					</View>
				) : (
					<Text
						numberOfLines={1}
						className="mt-1 font-sans-medium text-[12px] text-muted"
					>
						{t("native.drawer.draftMeta", { time: updatedAtLabel })}
					</Text>
				)}
			</View>
		</Pressable>
	);
});

function BuildingMeta({ label }: { label: string }) {
	const accent = useThemeColor("accent");

	return (
		<Animated.View
			className="mt-1 flex-row items-center"
			style={{
				animationName: {
					"0%": { opacity: 1 },
					"50%": { opacity: 0.45 },
					"100%": { opacity: 1 },
				},
				animationDuration: "1600ms",
				animationIterationCount: "infinite",
				animationTimingFunction: "ease-in-out",
			}}
		>
			<Text
				numberOfLines={1}
				className="font-sans-medium text-[12px]"
				style={{ color: accent }}
			>
				{label}
			</Text>
		</Animated.View>
	);
}

type ProjectThumbProps = {
	project: Project;
	width?: number;
	height?: number;
};

/** 56×44 build-preview thumb: real screenshot when one exists, gradient
 * letter tile otherwise, spinner overlay while a deployment is in flight. */
export function ProjectThumb({
	project,
	width = 56,
	height = 44,
}: ProjectThumbProps) {
	// Track the URL that failed (not a boolean) so a new preview URL retries.
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const showImage =
		!!project.previewImageUrl && project.previewImageUrl !== failedUrl;

	return (
		<View
			className="shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
			style={{ width, height, backgroundColor: TILE_BG }}
		>
			{showImage ? (
				<Image
					source={{ uri: project.previewImageUrl ?? undefined }}
					resizeMode="cover"
					style={StyleSheet.absoluteFill}
					onError={() => setFailedUrl(project.previewImageUrl ?? null)}
				/>
			) : (
				<DesignTile project={project} />
			)}
			{project.status === "publishing" ? (
				<View className="absolute inset-0 items-center justify-center bg-black/35">
					<SpinnerArc size={16} />
				</View>
			) : null}
		</View>
	);
}

// Prototype thumb palette: a near-black warm tile (oklch(0.145 0.011 46)),
// a vivid ember wash (oklch(0.7 0.19 h) across the brand's hue range), and
// cream content bars (oklch(0.96 0.02 80)).
const TILE_BG = "#0E0907";
const TILE_CREAM = "#F9F1E3";
const WASH_COLORS = ["#FD6844", "#FD6A3A", "#FA6E1D", "#F47600", "#E68300"];

/**
 * The prototype's fake-page thumb for projects without a build screenshot:
 * dark tile, a radial hue wash seeded per project, two content bars, and
 * either an ember chip or a soft dot — so same-named projects stop being
 * interchangeable. Drawn in a fixed 56×44 design space and scaled.
 */
function DesignTile({ project }: { project: Project }) {
	const idPrefix = useId().replace(/[^a-zA-Z0-9]/g, "");
	const washId = `wash${idPrefix}`;
	const emberId = `ember${idPrefix}`;
	const seed = Math.abs(Math.trunc(project.thumbnailSeed));
	const wash = WASH_COLORS[seed % WASH_COLORS.length];
	const washX = 25 + ((seed * 13) % 60);
	const washY = (seed * 29) % 90;
	const emberChip = seed % 2 === 1;
	const [emberFrom, emberTo] = BRAND_GRADIENT_LIGHT;

	return (
		<Svg
			style={StyleSheet.absoluteFill}
			pointerEvents="none"
			viewBox="0 0 56 44"
			preserveAspectRatio="xMidYMid slice"
		>
			<Defs>
				<RadialGradient id={washId} cx={`${washX}%`} cy={`${washY}%`} r="95%">
					<Stop offset="0" stopColor={wash} stopOpacity={0.5} />
					<Stop offset="0.7" stopColor={wash} stopOpacity={0} />
				</RadialGradient>
				<LinearGradient id={emberId} x1="0" y1="0" x2="1" y2="1">
					<Stop offset="0" stopColor={emberFrom} />
					<Stop offset="1" stopColor={emberTo} />
				</LinearGradient>
			</Defs>
			<Rect width="56" height="44" fill={`url(#${washId})`} />
			<Rect
				x="6"
				y="9"
				width="24"
				height="4"
				rx="2"
				fill={TILE_CREAM}
				fillOpacity={0.7}
			/>
			<Rect
				x="6"
				y="18"
				width="32"
				height="3"
				rx="1.5"
				fill={TILE_CREAM}
				fillOpacity={0.32}
			/>
			{emberChip ? (
				<Rect
					x="6"
					y="29"
					width="26"
					height="8"
					rx="3"
					fill={`url(#${emberId})`}
				/>
			) : (
				<Circle cx="43" cy="30" r="7" fill={TILE_CREAM} fillOpacity={0.22} />
			)}
		</Svg>
	);
}
