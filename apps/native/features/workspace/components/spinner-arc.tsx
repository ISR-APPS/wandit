import { useThemeColor } from "heroui-native";
import Animated from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

/**
 * Spinning ember arc on a stone track — the shared "working" marker (web
 * parity with tray-signals.tsx SpinnerArc). Replaces ActivityIndicator in
 * chat cards so the working state reads as brand, not system chrome.
 */
export function SpinnerArc({ size = 15 }: { size?: number }) {
	const border = useThemeColor("border");
	const accent = useThemeColor("accent");

	return (
		<Animated.View
			accessibilityElementsHidden
			style={{
				width: size,
				height: size,
				animationName: {
					from: { transform: [{ rotate: "0deg" }] },
					to: { transform: [{ rotate: "360deg" }] },
				},
				animationDuration: "1000ms",
				animationIterationCount: "infinite",
				animationTimingFunction: "linear",
			}}
		>
			<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
				<Circle cx={12} cy={12} r={9} stroke={border} strokeWidth={2.5} />
				<Path
					d="M12 3a9 9 0 0 1 9 9"
					stroke={accent}
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
			</Svg>
		</Animated.View>
	);
}
