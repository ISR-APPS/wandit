import { Button, type ButtonRootProps, cn } from "heroui-native";
import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";

type HeroButtonProps = Omit<
	ButtonRootProps,
	"animation" | "children" | "feedbackVariant" | "size" | "variant"
>;

type FitCalInlineActionProps = Omit<
	HeroButtonProps,
	"children" | "size" | "variant"
> & {
	action: string;
	label: string;
};

export function FitCalInlineAction({
	action,
	className,
	label,
	...props
}: FitCalInlineActionProps) {
	const separator = label && action ? " · " : "";

	return (
		<Button
			className={cn("h-auto min-h-0 bg-transparent px-0 py-1", className)}
			feedbackVariant="scale"
			size="sm"
			variant="ghost"
			{...props}
		>
			<View className="flex-row items-center justify-center">
				<AppText allowFontScaling={false} className="text-[14px] text-muted">
					{label}
					{separator}
				</AppText>
				<AppText
					allowFontScaling={false}
					className="font-bold text-[14px] text-foreground"
				>
					{action}
				</AppText>
			</View>
		</Button>
	);
}
