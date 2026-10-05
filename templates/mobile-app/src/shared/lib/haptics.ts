// Haptic feedback for the phone. The tab bar and the forms call these functions.
// The web preview gets none: expo-haptics on the web clicks a hidden switch
// to fake a tap, which does nothing useful in the preview iframe.
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function logFailure(error: unknown) {
	// A missing haptic motor must never break the action that asked for it.
	console.warn("[haptics] feedback failed", error);
}

/** A light tap: a tab change, a toggle, or a choice in a list. */
export function tapFeedback() {
	if (Platform.OS !== "web") {
		Haptics.selectionAsync().catch(logFailure);
	}
}

/** A success pulse after a save or a sign-in. */
export function successFeedback() {
	if (Platform.OS !== "web") {
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			logFailure,
		);
	}
}
