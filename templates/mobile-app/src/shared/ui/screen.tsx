/**
 * Frame for every route in src/app: the theme background, the safe areas,
 * the page padding, and keyboard avoidance for forms.
 */
import { cn } from "heroui-native";
import { KeyboardAvoidingView, View, type ViewProps } from "react-native";

import { AppSafeAreaView } from "./safe-area-view";

/** Props of the inner content View, not of the safe-area frame. */
export type ScreenProps = ViewProps & {
	/** Uniwind classes for the content area, for example `gap-6`. */
	className?: string;
};

/** Safe-area frame with page padding. The content moves up above the keyboard. */
export function Screen({ className, ...props }: ScreenProps) {
	return (
		<AppSafeAreaView className="flex-1 bg-background">
			<KeyboardAvoidingView
				// Expo Go draws Android edge to edge, so the window does not resize for the keyboard.
				// "padding" adds only the height that the keyboard covers, on iOS and Android.
				behavior="padding"
				style={{ flex: 1 }}
			>
				<View className={cn("flex-1 gap-4 p-6", className)} {...props} />
			</KeyboardAvoidingView>
		</AppSafeAreaView>
	);
}
