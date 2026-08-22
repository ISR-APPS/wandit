import { useState } from "react";
import { View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

// Ember gradient stops from the web sweep thumbs (mcp-tool-part / connector
// live card).
const SWEEP_FROM = "rgba(198,95,51,0)";
const SWEEP_CORE = "#c65f33";
const SWEEP_TO = "rgba(198,95,51,0)";

/**
 * Indeterminate progress: a one-third-width ember sweep gliding across a
 * quiet track, 1.4 s loop (web parity with the MCP LiveRail and the
 * connector live card). Forced LTR — the sweep must travel the same way in
 * RTL locales, matching web.
 */
export function SweepBar({ height = 3 }: { height?: number }) {
	const [trackWidth, setTrackWidth] = useState(0);
	const progress = useSharedValue(0);

	const thumbWidth = trackWidth / 3;
	const thumbStyle = useAnimatedStyle(() => ({
		transform: [
			{
				// -100% → 300% of the thumb width spans the track and fully exits
				// on both sides before wrapping.
				translateX: -thumbWidth + progress.value * (trackWidth + thumbWidth),
			},
		],
	}));

	return (
		<View
			className="w-full overflow-hidden rounded-full bg-surface-secondary dark:bg-surface-tertiary"
			style={{ height, direction: "ltr" }}
			onLayout={(event) => {
				const width = event.nativeEvent.layout.width;
				setTrackWidth(width);
				if (width > 0) {
					progress.value = 0;
					progress.value = withRepeat(
						withTiming(1, {
							duration: 1400,
							easing: Easing.inOut(Easing.ease),
						}),
						-1,
					);
				}
			}}
		>
			{trackWidth > 0 ? (
				<Animated.View
					style={[{ width: thumbWidth, height: "100%" }, thumbStyle]}
				>
					<Svg width="100%" height="100%">
						<Defs>
							<LinearGradient id="sweepBarFill" x1="0" y1="0" x2="1" y2="0">
								<Stop offset="0" stopColor={SWEEP_FROM} />
								<Stop offset="0.5" stopColor={SWEEP_CORE} />
								<Stop offset="1" stopColor={SWEEP_TO} />
							</LinearGradient>
						</Defs>
						<Rect
							x="0"
							y="0"
							width="100%"
							height="100%"
							fill="url(#sweepBarFill)"
						/>
					</Svg>
				</Animated.View>
			) : null}
		</View>
	);
}
