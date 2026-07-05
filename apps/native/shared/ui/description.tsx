import {
	type DescriptionProps,
	type DescriptionRef,
	Description as HeroDescription,
} from "heroui-native";
import { forwardRef } from "react";

export type AppDescriptionProps = DescriptionProps;
export type AppDescriptionRef = DescriptionRef;

const AppDescriptionRoot = forwardRef<AppDescriptionRef, AppDescriptionProps>(
	(props, ref) => <HeroDescription ref={ref} {...props} />,
);

AppDescriptionRoot.displayName = "AppDescription";

export const AppDescription = AppDescriptionRoot;
