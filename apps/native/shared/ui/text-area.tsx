import { TextArea as HeroTextArea, type TextAreaProps } from "heroui-native";
import { forwardRef } from "react";
import type { TextInput } from "react-native";

export type AppTextAreaProps = TextAreaProps;
export type AppTextAreaRef = TextInput;

const AppTextAreaRoot = forwardRef<AppTextAreaRef, AppTextAreaProps>(
	(props, ref) => <HeroTextArea ref={ref} {...props} />,
);

AppTextAreaRoot.displayName = "AppTextArea";

export const AppTextArea = AppTextAreaRoot;
