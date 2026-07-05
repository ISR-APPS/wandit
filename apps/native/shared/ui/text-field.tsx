import {
	Description,
	type DescriptionProps,
	FieldError,
	type FieldErrorRootProps,
	TextField as HeroTextField,
	Input,
	type InputProps,
	Label,
	type LabelProps,
	type TextFieldRootProps,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppTextFieldProps = TextFieldRootProps;
export type AppTextFieldLabelProps = LabelProps;
export type AppTextFieldInputProps = InputProps;
export type AppTextFieldDescriptionProps = DescriptionProps;
export type AppTextFieldErrorProps = FieldErrorRootProps;

const AppTextFieldRoot = forwardRef<View, AppTextFieldProps>((props, ref) => (
	<HeroTextField ref={ref} {...props} />
));

AppTextFieldRoot.displayName = "AppTextField";

export const AppTextField = Object.assign(AppTextFieldRoot, {
	Label,
	Input,
	Description,
	Error: FieldError,
	FieldError,
});
