import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Dark confirmation pill from the prototype: drops in under the header,
// auto-dismisses after 1.9 s. Kept mounted and driven by opacity — no
// reanimated exit animations (they crash Fabric, see shared/ui/skeleton-group).
const TOAST_DURATION_MS = 1900;
const TOAST_BG = "#241E1A";

export function useHubToast() {
	const [message, setMessage] = useState<string | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const show = useCallback((next: string) => {
		if (timer.current) {
			clearTimeout(timer.current);
		}
		setMessage(next);
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

type HubToastProps = {
	message: string | null;
};

export function HubToast({ message }: HubToastProps) {
	const insets = useSafeAreaInsets();
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
		transform: [{ translateY: (visible.value - 1) * 8 }],
	}));

	if (!displayed) {
		return null;
	}

	return (
		<Animated.View
			pointerEvents="none"
			className="absolute inset-x-0 items-center"
			style={[{ top: insets.top + 60, zIndex: 60 }, animatedStyle]}
		>
			<Text
				numberOfLines={1}
				className="max-w-[330px] overflow-hidden rounded-full px-[18px] py-2.5 font-sans-medium text-[13.5px]"
				style={{
					color: "#FCFBF8",
					backgroundColor: TOAST_BG,
					boxShadow: "0 12px 30px -10px rgba(0,0,0,0.4)",
				}}
			>
				{displayed}
			</Text>
		</Animated.View>
	);
}
