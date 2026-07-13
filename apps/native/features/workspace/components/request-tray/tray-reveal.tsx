// Open/close motion for the request tray — the tray GROWS out of the
// composer card instead of snapping in, the mobile twin of the web
// TrayReveal (motion/react height animation). Reanimated's custom
// entering/exiting builders receive the measured target/current height, so
// the same 0 → measured → 0 height+fade works without ResizeObserver
// plumbing. Key the component by toolCallId: one ask exits while the next
// mounts as its own animated tray.

import type { ReactNode } from "react";
import Animated, {
	Easing,
	type EntryAnimationsValues,
	type ExitAnimationsValues,
	withTiming,
} from "react-native-reanimated";

/** Calm, no-bounce ease for tray chrome — same curve as the web TRAY_EASE
    ("calm chrome; energy stays on the generated thing"). */
const TRAY_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const REVEAL_MS = 260;

function trayEntering(values: EntryAnimationsValues) {
	"worklet";
	return {
		initialValues: { height: 0, opacity: 0 },
		animations: {
			height: withTiming(values.targetHeight, {
				duration: REVEAL_MS,
				easing: TRAY_EASE,
			}),
			opacity: withTiming(1, { duration: REVEAL_MS }),
		},
	};
}

function trayExiting(values: ExitAnimationsValues) {
	"worklet";
	return {
		initialValues: { height: values.currentHeight, opacity: 1 },
		animations: {
			height: withTiming(0, { duration: REVEAL_MS, easing: TRAY_EASE }),
			opacity: withTiming(0, { duration: REVEAL_MS }),
		},
	};
}

export function TrayReveal({ children }: { children: ReactNode }) {
	return (
		<Animated.View
			entering={trayEntering}
			exiting={trayExiting}
			className="overflow-hidden"
		>
			{children}
		</Animated.View>
	);
}
