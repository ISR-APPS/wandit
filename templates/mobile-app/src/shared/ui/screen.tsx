/**
 * Frame for every screen in src/features/<feature>/screens: the theme
 * background, the safe areas, the page padding, scrolling, and keyboard
 * avoidance for forms. A list screen uses a FlatList in AppSafeAreaView instead.
 */
import { useHeaderHeight } from "expo-router/react-navigation";
import { cn } from "heroui-native";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	type ScrollViewProps,
} from "react-native";

import { AppSafeAreaView } from "./safe-area-view";

/** Props of the inner ScrollView, not of the safe-area frame. */
export type ScreenProps = ScrollViewProps & {
	/** Uniwind classes for the content area, for example `gap-6`. */
	className?: string;
};

/** Safe-area frame with page padding. The content scrolls and moves up above the keyboard. */
export function Screen({ className, ...props }: ScreenProps) {
	// 0 when the stack hides its header, so a tab root screen gets no offset.
	const headerHeight = useHeaderHeight();
	return (
		// The native safe-area view pads only the edges it overlaps: no top inset under a header.
		<AppSafeAreaView className="flex-1 bg-background">
			<KeyboardAvoidingView
				// Expo Go draws Android edge to edge, so the window does not resize for the keyboard.
				// "padding" adds only the height that the keyboard covers.
				behavior="padding"
				// iOS: the view measures itself inside a modal sheet, not in the window, so its
				// padding is too small. The ScrollView below handles the keyboard there instead.
				enabled={Platform.OS !== "ios"}
				// The view measures itself below the header, so the header height must be added.
				keyboardVerticalOffset={headerHeight}
				style={{ flex: 1 }}
			>
				<ScrollView
					// iOS only: the inset follows the keyboard in window coordinates, also in a modal.
					automaticallyAdjustKeyboardInsets
					contentContainerClassName={cn("grow gap-4 p-5", className)}
					keyboardShouldPersistTaps="handled"
					{...props}
				/>
			</KeyboardAvoidingView>
		</AppSafeAreaView>
	);
}
