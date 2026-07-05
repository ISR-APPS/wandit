import { cn } from "heroui-native";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
	KeyboardAwareScrollView,
	type KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";

import {
	DEFAULT_SCREEN_CONTENT_CLASS_NAME,
	type ScreenInsetProps,
	useScreenInsetStyle,
} from "@/shared/ui/screen-layout";

type Props = PropsWithChildren<
	KeyboardAwareScrollViewProps &
		ScreenInsetProps & {
			className?: string;
			contentContainerClassName?: string;
			contentContainerStyle?: StyleProp<ViewStyle>;
		}
>;

export function ScreenScrollView({
	children,
	className,
	contentContainerClassName,
	contentContainerStyle,
	topInsetMode,
	includeTopInset,
	includeBottomInset,
	topSpacing,
	bottomSpacing,
	showsVerticalScrollIndicator = false,
	keyboardDismissMode = "on-drag",
	keyboardShouldPersistTaps = "handled",
	bottomOffset = 12,
	extraKeyboardSpace = 12,
	...props
}: PropsWithChildren<Props>) {
	const insetStyle = useScreenInsetStyle({
		topInsetMode,
		includeTopInset,
		includeBottomInset,
		topSpacing,
		bottomSpacing,
	});

	return (
		<KeyboardAwareScrollView
			bottomOffset={bottomOffset}
			className={cn("flex-1 bg-background", className)}
			contentContainerClassName={cn(
				"flex-grow",
				DEFAULT_SCREEN_CONTENT_CLASS_NAME,
				contentContainerClassName,
			)}
			contentContainerStyle={[
				insetStyle,
				{
					flexGrow: 1,
				},
				contentContainerStyle,
			]}
			extraKeyboardSpace={extraKeyboardSpace}
			keyboardDismissMode={keyboardDismissMode}
			keyboardShouldPersistTaps={keyboardShouldPersistTaps}
			showsVerticalScrollIndicator={showsVerticalScrollIndicator}
			{...props}
		>
			{children}
		</KeyboardAwareScrollView>
	);
}
