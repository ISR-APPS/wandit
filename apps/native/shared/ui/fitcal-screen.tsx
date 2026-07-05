import { cn } from "heroui-native";
import type { ComponentProps } from "react";

import { Screen } from "@/shared/ui/screen";

type FitCalScreenProps = ComponentProps<typeof Screen>;

export function FitCalScreen({
	bottomSpacing = 16,
	children,
	contentClassName,
	...props
}: FitCalScreenProps) {
	return (
		<Screen
			bottomSpacing={bottomSpacing}
			contentClassName={cn("px-[22px]", contentClassName)}
			{...props}
		>
			{children}
		</Screen>
	);
}
