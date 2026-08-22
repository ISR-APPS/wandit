import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Text, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

// Dark confirmation pill over the page preview (same pattern as the drawer
// toast): rises above the floating bars, auto-dismisses after 2.4 s. Kept
// mounted and driven by opacity — no reanimated exit animations (they crash
// Fabric, see shared/ui/skeleton-group).
const TOAST_DURATION_MS = 2400;
const TOAST_BG = "#241E1A";
const TOAST_EMBER = "#E8A33C";

export function usePageToast() {
	const [message, setMessage] = useState<string | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const show = useCallback((next: string) => {
		if (timer.current) {
			clearTimeout(timer.current);
		}
		setMessage(next);
		// Android reads accessibilityLiveRegion; iOS VoiceOver needs an
		// explicit announcement.
		if (Platform.OS === "ios") {
			AccessibilityInfo.announceForAccessibility(next);
		}
		timer.current = setTimeout(() => {
			setMessage(null);
			timer.current = null;
		}, TOAST_DURATION_MS);
	}, []);

	useEffect(
		() => () => {
			if (timer.current) {
				clearTimeout(timer.current);
			}
		},
		[],
	);

	return { message, show };
}

type PageToastProps = {
	message: string | null;
	/** Distance from the screen bottom, above the floating chrome. */
	bottomOffset: number;
};

export function PageToast({ message, bottomOffset }: PageToastProps) {
	const visible = useSharedValue(0);
	// The pill keeps showing the last message while it fades out.
	const [displayed, setDisplayed] = useState<string | null>(null);

	useEffect(() => {
		if (message) {
			setDisplayed(message);
		}
		visible.value = withTiming(message ? 1 : 0, { duration: 220 });
	}, [message, visible]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: visible.value,
		transform: [{ translateY: (1 - visible.value) * 8 }],
	}));

	if (!displayed) {
		return null;
	}

	return (
		<Animated.View
			pointerEvents="none"
			accessibilityLiveRegion="polite"
			// The faded-out pill stays mounted (no exit animations on Fabric) —
			// keep it out of the a11y tree while hidden.
			accessibilityElementsHidden={!message}
			importantForAccessibility={message ? "auto" : "no-hide-descendants"}
			className="absolute inset-x-4 z-10 flex-row items-center gap-2.5 rounded-[14px] px-[15px] py-[13px]"
			style={[
				{
					bottom: bottomOffset,
					backgroundColor: TOAST_BG,
					boxShadow: "0 20px 40px -18px rgba(0,0,0,0.5)",
				},
				animatedStyle,
			]}
		>
			<View
				className="h-1.5 w-1.5 rounded-full"
				style={{ backgroundColor: TOAST_EMBER }}
			/>
			<Text
				numberOfLines={2}
				className="flex-1 font-sans-medium text-[13.5px]"
				style={{ color: "#FCFBF8" }}
			>
				{displayed}
			</Text>
		</Animated.View>
	);
}
