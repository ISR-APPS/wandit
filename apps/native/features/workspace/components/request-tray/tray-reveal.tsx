// Open/close motion for the request tray — the tray GROWS out of the
// composer card instead of snapping in, the mobile twin of the web
// TrayReveal (motion/react height animation driven by a ResizeObserver).
// The content renders inside an absolutely-positioned measuring view whose
// onLayout height drives an animated container height, so content that
// grows AFTER mount — streamed ask_user input arriving chunk by chunk —
// keeps animating toward its real size.
//
// Exit is owned HERE, not by Reanimated's `exiting` prop: an exit clone
// freezes its props, so a clone-based collapse stays hittable for its whole
// 260 ms — a tap on the outgoing X could land on chrome wired to a settled
// ask. Keeping the outgoing subtree mounted ourselves lets us drop
// pointerEvents to "none" the moment it starts collapsing (web parity with
// the exiting tray's pointer-events guard).

import { type ReactNode, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

/** Calm, no-bounce ease for tray chrome — same curve as the web TRAY_EASE
    ("calm chrome; energy stays on the generated thing"). */
const TRAY_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const REVEAL_MS = 260;

type TrayEntry = { key: string; node: ReactNode };

export function TrayReveal({
	revealKey,
	children,
}: {
	/** Identity of the docked ask; null collapses the tray. */
	revealKey: string | null;
	children: ReactNode;
}) {
	const activeEntry: TrayEntry | null =
		revealKey !== null && children ? { key: revealKey, node: children } : null;
	const [exitingEntry, setExitingEntry] = useState<TrayEntry | null>(null);
	// The entry the previous render painted — the snapshot that collapses when
	// the docked ask changes or clears.
	const paintedRef = useRef<TrayEntry | null>(null);
	const activeKey = activeEntry?.key ?? null;

	const painted = paintedRef.current;
	if (
		painted &&
		painted.key !== activeKey &&
		exitingEntry?.key !== painted.key
	) {
		// Adjust-during-render (the sanctioned derive-from-props escape hatch):
		// the outgoing snapshot becomes the inert collapsing frame immediately,
		// in the same render that mounts the incoming tray.
		setExitingEntry(painted);
	}
	paintedRef.current = activeEntry;

	useEffect(() => {
		if (!exitingEntry) return;
		const timeout = setTimeout(() => setExitingEntry(null), REVEAL_MS + 40);
		return () => clearTimeout(timeout);
	}, [exitingEntry]);

	return (
		<>
			{exitingEntry && exitingEntry.key !== activeKey ? (
				<CollapsingFrame key={`exit:${exitingEntry.key}`}>
					{exitingEntry.node}
				</CollapsingFrame>
			) : null}
			{activeEntry ? (
				<GrowingFrame key={activeEntry.key}>{activeEntry.node}</GrowingFrame>
			) : null}
		</>
	);
}

function GrowingFrame({ children }: { children: ReactNode }) {
	const height = useSharedValue(0);
	const opacity = useSharedValue(0);

	const animatedStyle = useAnimatedStyle(() => ({
		height: height.value,
		opacity: opacity.value,
	}));

	return (
		<Animated.View style={animatedStyle} className="overflow-hidden">
			<View
				// Absolute so the content lays out at its natural height, unclamped
				// by the animated container — its measurement IS the target height.
				style={{ position: "absolute", top: 0, left: 0, right: 0 }}
				onLayout={(event) => {
					const next = event.nativeEvent.layout.height;
					height.value = withTiming(next, {
						duration: REVEAL_MS,
						easing: TRAY_EASE,
					});
					opacity.value = withTiming(1, { duration: REVEAL_MS });
				}}
			>
				{children}
			</View>
		</Animated.View>
	);
}

function CollapsingFrame({ children }: { children: ReactNode }) {
	const height = useSharedValue<number>(-1);
	const opacity = useSharedValue(1);

	const animatedStyle = useAnimatedStyle(() =>
		height.value < 0
			? { opacity: opacity.value }
			: { height: height.value, opacity: opacity.value },
	);

	return (
		<Animated.View
			// The whole point of this frame: a collapsing tray takes no touches.
			pointerEvents="none"
			style={animatedStyle}
			className="overflow-hidden"
		>
			<View
				onLayout={(event) => {
					if (height.value >= 0) return;
					// Seed at the measured height (the size it already had while
					// active — no visual jump), then collapse.
					height.value = event.nativeEvent.layout.height;
					height.value = withTiming(0, {
						duration: REVEAL_MS,
						easing: TRAY_EASE,
					});
					opacity.value = withTiming(0, { duration: REVEAL_MS });
				}}
			>
				{children}
			</View>
		</Animated.View>
	);
}
