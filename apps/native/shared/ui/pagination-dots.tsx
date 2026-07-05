import { cn } from "heroui-native";
import { View, type ViewProps } from "react-native";

type FitCalPaginationDotsProps = ViewProps & {
	activeIndex: number;
	count: number;
};

export function FitCalPaginationDots({
	activeIndex,
	count,
	className,
	...props
}: FitCalPaginationDotsProps) {
	return (
		<View className={cn("flex-row gap-[7px]", className)} {...props}>
			{Array.from({ length: count }, (_, index) => (
				<View
					className={cn(
						"h-[7px] rounded-full",
						index === activeIndex
							? "w-[26px] bg-foreground"
							: "w-[7px] bg-separator",
					)}
					key={index}
				/>
			))}
		</View>
	);
}
