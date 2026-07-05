import {
	type FieldErrorRootProps,
	FieldError as HeroFieldError,
} from "heroui-native";
import { forwardRef } from "react";
import type { View } from "react-native";

export type AppFieldErrorProps = FieldErrorRootProps;

const AppFieldErrorRoot = forwardRef<View, AppFieldErrorProps>((props, ref) => (
	<HeroFieldError ref={ref} {...props} />
));

AppFieldErrorRoot.displayName = "AppFieldError";

export const AppFieldError = AppFieldErrorRoot;
